import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Vibration } from 'react-native';

import { ESCALATION_MINUTES } from './config';
import {
  cancelDoseReminders,
  dismissDeliveredNotifications,
  doseKey,
  logScheduledCount,
  resetAllNotifications,
  scheduleDoseReminders,
} from './notifications';
import {
  addPill as addPillToStorage,
  DoseLogEntry,
  getDoseLog,
  getFamilyPhone,
  getNextPendingPill,
  getPills,
  getTodayCounts,
  Pill,
  recordDose,
  todayDateString,
} from './storage';
import { sendMissedDoseAlert } from './telegram';

const CHECK_INTERVAL_MS = 15_000;

export type ActiveAlarm = {
  pill: Pill;
  scheduledAt: Date;
  escalated: boolean;
};

// Returns today's occurrence of `time` ("HH:MM"), or tomorrow's if it has
// already passed relative to `now`.
function nextOccurrence(time: string, now: Date): Date {
  const [h, m] = time.split(':').map(Number);
  const candidate = new Date(now);
  candidate.setHours(h, m, 0, 0);
  if (candidate.getTime() < now.getTime() - 60_000) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate;
}

// Like nextOccurrence, but skips any day that's already logged "taken" for
// this pill (covers confirming a dose before its scheduled time arrives,
// where the naive next occurrence would still land on today).
function nextUnresolvedOccurrence(
  pill: Pill,
  log: DoseLogEntry[],
  now: Date
): Date {
  let occurrence = nextOccurrence(pill.time, now);
  let guard = 0;
  while (
    guard++ < 7 &&
    log.some(
      (e) =>
        e.pillId === pill.id &&
        e.date === todayDateString(occurrence) &&
        e.status === 'taken'
    )
  ) {
    occurrence = new Date(occurrence.getTime() + 24 * 60 * 60 * 1000);
  }
  return occurrence;
}

function todayOccurrence(time: string, now: Date): Date {
  const [h, m] = time.split(':').map(Number);
  const candidate = new Date(now);
  candidate.setHours(h, m, 0, 0);
  return candidate;
}

export function useDoseManager() {
  const [pills, setPills] = useState<Pill[]>([]);
  const [doseLog, setDoseLog] = useState<DoseLogEntry[]>([]);
  const [familyPhone, setFamilyPhoneState] = useState<string>('');
  const [activeAlarm, setActiveAlarm] = useState<ActiveAlarm | null>(null);

  const activeAlarmRef = useRef<ActiveAlarm | null>(null);
  useEffect(() => {
    activeAlarmRef.current = activeAlarm;
  }, [activeAlarm]);

  const pillsRef = useRef<Pill[]>([]);
  useEffect(() => {
    pillsRef.current = pills;
  }, [pills]);

  const doseLogRef = useRef<DoseLogEntry[]>([]);
  useEffect(() => {
    doseLogRef.current = doseLog;
  }, [doseLog]);

  // scheduleDoseReminders is itself idempotent (cancels any reminders
  // already scheduled for this exact pill+date before scheduling new ones),
  // so calling this again for the same dose slot can never create
  // duplicates or orphan old notification ids.
  const scheduleAndTrack = useCallback(async (pill: Pill, at: Date) => {
    await scheduleDoseReminders(pill, at, todayDateString(at));
  }, []);

  // Timer that, unless cleared by a confirm, marks the dose missed and
  // notifies the family once ESCALATION_MINUTES have passed.
  const escalationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearEscalationTimer = useCallback(() => {
    if (escalationTimerRef.current) {
      clearTimeout(escalationTimerRef.current);
      escalationTimerRef.current = null;
    }
  }, []);

  const escalate = useCallback(async (pill: Pill) => {
    if (activeAlarmRef.current?.pill.id !== pill.id) return;
    setActiveAlarm((prev) =>
      prev && prev.pill.id === pill.id ? { ...prev, escalated: true } : prev
    );
    const log = await recordDose({
      pillId: pill.id,
      pillName: pill.name,
      date: todayDateString(),
      time: pill.time,
      status: 'missed',
      at: new Date().toISOString(),
    });
    setDoseLog(log);
    sendMissedDoseAlert(pill.name, pill.time).catch(() => {});
  }, []);

  const activateAlarm = useCallback(
    async (pill: Pill, scheduledAt: Date) => {
      await scheduleAndTrack(pill, scheduledAt);
      setActiveAlarm({ pill, scheduledAt, escalated: false });
      clearEscalationTimer();
      escalationTimerRef.current = setTimeout(
        () => escalate(pill),
        ESCALATION_MINUTES * 60 * 1000
      );
    },
    [scheduleAndTrack, clearEscalationTimer, escalate]
  );

  const checkDue = useCallback(async () => {
    if (activeAlarmRef.current) return;
    const now = new Date();
    const today = todayDateString(now);
    for (const pill of pillsRef.current) {
      const scheduled = todayOccurrence(pill.time, now);
      if (scheduled.getTime() > now.getTime()) continue;
      const alreadyLogged = doseLogRef.current.some(
        (e) =>
          e.pillId === pill.id && e.date === today && e.time === pill.time
      );
      if (alreadyLogged) continue;
      await activateAlarm(pill, scheduled);
      return;
    }
  }, [activateAlarm]);

  // initial load
  useEffect(() => {
    (async () => {
      const [loadedPills, loadedLog, phone] = await Promise.all([
        getPills(),
        getDoseLog(),
        getFamilyPhone(),
      ]);
      setPills(loadedPills);
      setDoseLog(loadedLog);
      setFamilyPhoneState(phone);

      // Wipe every OS-level scheduled notification and our own id map, then
      // reschedule only pills that don't already have a taken dose logged
      // for their next occurrence. This guarantees a clean slate on every
      // launch, so notifications orphaned by a previous bug/crash/reload
      // can never accumulate.
      await resetAllNotifications();
      const now = new Date();
      for (const pill of loadedPills) {
        const occurrence = nextUnresolvedOccurrence(pill, loadedLog, now);
        await scheduleAndTrack(pill, occurrence);
      }
      await logScheduledCount('app start');
    })();
  }, [scheduleAndTrack]);

  // periodic + app-resume due check
  useEffect(() => {
    checkDue();
    const interval = setInterval(checkDue, CHECK_INTERVAL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkDue();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
      clearEscalationTimer();
    };
  }, [checkDue, clearEscalationTimer]);

  const addPill = useCallback(
    async (name: string, time: string) => {
      const pill = await addPillToStorage(name, time);
      setPills((prev) => [...prev, pill]);
      await scheduleAndTrack(
        pill,
        nextUnresolvedOccurrence(pill, doseLogRef.current, new Date())
      );
      return pill;
    },
    [scheduleAndTrack]
  );

  // Confirms a dose whether or not its alarm is currently showing: cancels
  // every reminder scheduled for today's slot, dismisses any already
  // delivered, stops the alarm's speech/vibration, logs the dose as taken,
  // clears a matching active alarm + its escalation timer, and schedules the
  // pill's following occurrence.
  const confirmDose = useCallback(
    async (pill: Pill) => {
      const today = todayDateString();
      await cancelDoseReminders(doseKey(pill.id, today));
      await dismissDeliveredNotifications();
      Speech.stop();
      Vibration.cancel();

      const log = await recordDose({
        pillId: pill.id,
        pillName: pill.name,
        date: today,
        time: pill.time,
        status: 'taken',
        at: new Date().toISOString(),
      });
      setDoseLog(log);

      if (activeAlarmRef.current?.pill.id === pill.id) {
        setActiveAlarm(null);
        clearEscalationTimer();
      }

      await scheduleAndTrack(
        pill,
        nextUnresolvedOccurrence(pill, log, new Date())
      );
      await logScheduledCount('after confirm');
    },
    [scheduleAndTrack, clearEscalationTimer]
  );

  const confirmNextPendingDose = useCallback(async () => {
    const pending = getNextPendingPill(pillsRef.current, doseLogRef.current);
    if (pending) await confirmDose(pending);
  }, [confirmDose]);

  const triggerDemoAlarm = useCallback(() => {
    setTimeout(() => {
      if (activeAlarmRef.current) return;
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const demoPill: Pill = {
        id: `demo-${now.getTime()}`,
        name: 'Демо-лекарство',
        time: `${hh}:${mm}`,
      };
      activateAlarm(demoPill, now);
    }, 10_000);
  }, [activateAlarm]);

  const todayCounts = getTodayCounts(doseLog);
  const nextPendingPill = getNextPendingPill(pills, doseLog);

  return {
    pills,
    doseLog,
    todayCounts,
    nextPendingPill,
    familyPhone,
    activeAlarm,
    addPill,
    confirmDose,
    confirmNextPendingDose,
    triggerDemoAlarm,
  };
}
