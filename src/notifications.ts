import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Pill } from './storage';

const REMINDER_COUNT = 10; // extra reminders, one per minute, after the dose time
const REMINDER_INTERVAL_MINUTES = 1;

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

// Schedules the dose-time notification plus repeat nudges every minute for
// REMINDER_COUNT minutes. Returns the ids so they can all be cancelled once
// the dose is confirmed.
export async function scheduleDoseReminders(
  pill: Pill,
  doseTime: Date
): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i <= REMINDER_COUNT; i++) {
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
  return ids;
}

export async function cancelDoseReminders(ids: string[]): Promise<void> {
  await Promise.all(
    ids.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
    )
  );
}
