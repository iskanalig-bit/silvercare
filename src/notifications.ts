import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Pill } from './storage';

const MAX_REMINDERS_PER_DOSE = 10; // dose-time notification + follow-ups, capped for iOS's 64-pending limit
const REMINDER_INTERVAL_MINUTES = 1;
const NOTIF_IDS_KEY = '@silvercare/notificationIds';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
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

async function setIdsForKey(key: string, ids: string[]): Promise<void> {
  const map = await getNotifIdMap();
  if (ids.length === 0) {
    delete map[key];
  } else {
    map[key] = ids;
  }
  await writeNotifIdMap(map);
}

// Cancels whatever is currently scheduled for this dose slot (if anything)
// and forgets its ids. Safe to call even if nothing was ever scheduled.
export async function cancelDoseReminders(key: string): Promise<void> {
  const map = await getNotifIdMap();
  const ids = map[key] ?? [];
  await Promise.all(
    ids.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
    )
  );
  if (ids.length > 0) {
    delete map[key];
    await writeNotifIdMap(map);
  }
}

// Cancels every scheduled reminder for a pill regardless of which date it's
// currently tracked under (a pill only ever has one active dose slot at a
// time, but we don't want to have to know which date that is). Used when a
// pill is deleted entirely.
export async function cancelAllForPill(pillId: string): Promise<void> {
  const map = await getNotifIdMap();
  const prefix = `${pillId}:`;
  const keys = Object.keys(map).filter((k) => k.startsWith(prefix));
  const ids = keys.flatMap((k) => map[k]);
  await Promise.all(
    ids.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
    )
  );
  if (keys.length > 0) {
    for (const k of keys) delete map[k];
    await writeNotifIdMap(map);
  }
}

// Schedules the dose-time notification plus one-minute follow-ups (capped at
// MAX_REMINDERS_PER_DOSE total). Idempotent: always cancels any reminders
// already scheduled for this exact dose slot first, so re-scheduling the
// same dose (e.g. when its alarm fires) can never create duplicates.
export async function scheduleDoseReminders(
  pill: Pill,
  doseTime: Date,
  date: string
): Promise<string[]> {
  const key = doseKey(pill.id, date);
  await cancelDoseReminders(key);

  const ids: string[] = [];
  for (let i = 0; i < MAX_REMINDERS_PER_DOSE; i++) {
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
    } catch {
      // Ignore scheduling failures (e.g. unsupported in this environment).
    }
  }
  await setIdsForKey(key, ids);
  await logScheduledCount(`after scheduling ${pill.name}`);
  return ids;
}

// Wipes every OS-level scheduled notification and our own id map. Call once
// on app start before re-scheduling from storage, so notifications orphaned
// by a previous crash/reload/bug can never accumulate.
export async function resetAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // ignore
  }
  await AsyncStorage.removeItem(NOTIF_IDS_KEY);
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
