import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Pill } from './storage';

const FOLLOWUP_COUNT = 5; // follow-up reminders after the dose-time one
const REMINDER_INTERVAL_MINUTES = 2;
const NOTIF_IDS_KEY = '@silvercare/notificationIds';

// While the in-app alarm screen is showing, the OS notification would just
// be redundant noise on top of the alarm's own speech/vibration/flash — so
// it's delivered silently (still shows in the notification list/history).
let alarmScreenVisible = false;
export function setAlarmScreenVisible(visible: boolean): void {
  alarmScreenVisible = visible;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: !alarmScreenVisible,
    shouldShowList: true,
    shouldPlaySound: !alarmScreenVisible,
    shouldSetBadge: false,
  }),
});

export async function configureNotifications(): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'SilverCare',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
      });
    }
    await Notifications.requestPermissionsAsync();
  } catch {
    // Expo Go / platform limitations shouldn't crash the app — the in-app
    // alarm screen is the primary, reliable reminder mechanism.
  }
}

// One dose slot = one pill on one calendar date ("HH:MM" comes from the pill
// itself, so pillId + date is a unique key for "this pill's occurrence on
// this day").
export function doseKey(pillId: string, date: string): string {
  return `${pillId}:${date}`;
}

async function getNotifIdMap(): Promise<Record<string, string[]>> {
  const raw = await AsyncStorage.getItem(NOTIF_IDS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string[]>;
  } catch {
    return {};
  }
}

async function writeNotifIdMap(map: Record<string, string[]>): Promise<void> {
  await AsyncStorage.setItem(NOTIF_IDS_KEY, JSON.stringify(map));
}

// All read-modify-write access to the id map goes through one queue, so two
// concurrent updates (even for different dose keys) can't overwrite each
// other's entries.
let mapChain: Promise<unknown> = Promise.resolve();
function mutateMap<T>(
  mutate: (map: Record<string, string[]>) => T
): Promise<T> {
  const run = mapChain
    .catch(() => {})
    .then(async () => {
      const map = await getNotifIdMap();
      const result = mutate(map);
      await writeNotifIdMap(map);
      return result;
    });
  mapChain = run;
  return run;
}

// Merges ids into a dose key's tracked list (never replaces it), so an id is
// only ever forgotten when it is explicitly cancelled.
function addIdForKey(key: string, id: string): Promise<void> {
  return mutateMap((map) => {
    map[key] = Array.from(new Set([...(map[key] ?? []), id]));
  });
}

// Per-dose-key queue: scheduling/cancelling the same dose slot never runs
// in parallel, so parallel callers can't leave orphan notifications.
const keyQueues = new Map<string, Promise<unknown>>();
function serializeForKey<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = keyQueues.get(key) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(task);
  keyQueues.set(key, next);
  next
    .catch(() => {})
    .then(() => {
      if (keyQueues.get(key) === next) keyQueues.delete(key);
    });
  return next;
}

// Cancels every tracked notification for this key and forgets them. Must
// only be called while holding the key's queue slot.
async function cancelKeyNow(key: string): Promise<void> {
  const ids = (await getNotifIdMap())[key] ?? [];
  await Promise.all(
    ids.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
    )
  );
  await mutateMap((map) => {
    delete map[key];
  });
}

// Cancels whatever is currently scheduled for this dose slot (if anything)
// and forgets its ids. Safe to call even if nothing was ever scheduled.
export function cancelDoseReminders(key: string): Promise<void> {
  return serializeForKey(key, () => cancelKeyNow(key));
}

async function cancelKeysWithPrefix(prefix: string): Promise<void> {
  const keys = Object.keys(await getNotifIdMap()).filter((k) =>
    k.startsWith(prefix)
  );
  await Promise.all(keys.map((k) => cancelDoseReminders(k)));
}

// Cancels every scheduled reminder for a pill regardless of which date it's
// currently tracked under (a pill only ever has one active dose slot at a
// time, but we don't want to have to know which date that is). Used when a
// pill is deleted entirely.
export function cancelAllForPill(pillId: string): Promise<void> {
  return cancelKeysWithPrefix(`${pillId}:`);
}

// Demo pills (id "demo-...") exist only for the demo alarm; once it's
// dismissed nothing of theirs may stay scheduled.
export function cancelAllDemoReminders(): Promise<void> {
  return cancelKeysWithPrefix('demo');
}

// Schedules the dose-time notification plus FOLLOWUP_COUNT follow-ups every
// REMINDER_INTERVAL_MINUTES. Idempotent: always cancels any reminders
// already scheduled for this exact dose slot first, so re-scheduling the
// same dose (e.g. when its alarm fires) can never create duplicates.
export function scheduleDoseReminders(
  pill: Pill,
  doseTime: Date,
  date: string
): Promise<string[]> {
  const key = doseKey(pill.id, date);
  return serializeForKey(key, async () => {
    await cancelKeyNow(key);

    const ids: string[] = [];
    for (let i = 0; i <= FOLLOWUP_COUNT; i++) {
      const fireDate = new Date(
        doseTime.getTime() + i * REMINDER_INTERVAL_MINUTES * 60 * 1000
      );
      if (fireDate.getTime() <= Date.now()) continue;
      try {
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Пора принять лекарство',
            body: `${pill.name} — пожалуйста, подтвердите приём в приложении SilverCare`,
            sound: true,
            data: { pillId: pill.id, date },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: fireDate,
            channelId: 'default',
          },
        });
        ids.push(id);
        // Track it immediately, merged into the key's list, so a cancel or
        // reset that lands mid-loop still sees every id scheduled so far.
        await addIdForKey(key, id);
      } catch {
        // Ignore scheduling failures (e.g. unsupported in this environment).
      }
    }
    await logScheduledCount(`after scheduling ${pill.name}`);
    return ids;
  });
}

// Wipes every OS-level scheduled notification and our own id map. Call once
// on app start before re-scheduling from storage, so notifications orphaned
// by a previous crash/reload/bug can never accumulate.
export async function resetAllNotifications(): Promise<void> {
  // Let any in-flight schedule/cancel finish first so it can't re-add ids to
  // the map we're about to wipe.
  await Promise.all([...keyQueues.values()].map((p) => p.catch(() => {})));
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // ignore
  }
  await mutateMap((map) => {
    for (const k of Object.keys(map)) delete map[k];
  });
}

export async function dismissDeliveredNotifications(): Promise<void> {
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch {
    // ignore
  }
}

// Fires when the user taps a delivered notification (from the tray, or the
// in-app banner while the app is foregrounded). Used to route straight into
// the same confirmDose() the main screen and alarm screen use.
export function addNotificationTapListener(
  handler: (pillId: string) => void
): { remove: () => void } {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const pillId = response.notification.request.content.data?.pillId;
      if (typeof pillId === 'string') handler(pillId);
    }
  );
  return { remove: () => subscription.remove() };
}

export async function logScheduledCount(label: string): Promise<void> {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`[SilverCare] scheduled notifications (${label}): ${all.length}`);
  } catch {
    // ignore
  }
}
