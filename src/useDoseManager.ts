import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { cancelDoseReminders, scheduleDoseReminders } from './notifications';
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

const CHECK_INTERVAL_MS = 15_000;

export type ActiveAlarm = {
  pill: Pill;
  scheduledAt: Date;
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

  // Notification ids currently scheduled for each pill's next occurrence, so
  // they can be cancelled precisely once that dose is confirmed.
  const notifIdsRef = useRef<Record<string, string[]>>({});

  const scheduleAndTrack = useCallback(async (pill: Pill, at: Date) => {
    const ids = await scheduleDoseReminders(pill, at);
    notifIdsRef.current[pill.id] = ids;
  }, []);

  const activateAlarm = useCallback(
    async (pill: Pill, scheduledAt: Date) => {
      await scheduleAndTrack(pill, scheduledAt);
      setActiveAlarm({ pill, scheduledAt });
    },
    [scheduleAndTrack]
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
      // Make sure every pill has its next occurrence backed by a local
      // notification, even after an app restart.
      const now = new Date();
      for (const pill of loadedPills) {
        scheduleAndTrack(pill, nextOccurrence(pill.time, now));
      }
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
    };
  }, [checkDue]);

  const addPill = useCallback(
    async (name: string, time: string) => {
      const pill = await addPillToStorage(name, time);
      setPills((prev) => [...prev, pill]);
      await scheduleAndTrack(pill, nextOccurrence(time, new Date()));
      return pill;
    },
    [scheduleAndTrack]
  );

  // Confirms a dose whether or not its alarm is currently showing: cancels
  // its pending reminders, logs it as taken, clears a matching active alarm,
  // and schedules the pill's following occurrence.
  const confirmDose = useCallback(
    async (pill: Pill) => {
      const ids = notifIdsRef.current[pill.id] ?? [];
      await cancelDoseReminders(ids);
      const log = await recordDose({
        pillId: pill.id,
        pillName: pill.name,
        date: todayDateString(),
        time: pill.time,
        status: 'taken',
        at: new Date().toISOString(),
      });
      setDoseLog(log);
      if (activeAlarmRef.current?.pill.id === pill.id) {
        setActiveAlarm(null);
      }
      await scheduleAndTrack(pill, nextOccurrence(pill.time, new Date()));
    },
    [scheduleAndTrack]
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
