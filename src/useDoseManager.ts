import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Vibration } from 'react-native';

import { ESCALATION_MINUTES } from './config';
import {
  addNotificationTapListener,
  cancelAllDemoReminders,
  cancelAllForPill,
  cancelDoseReminders,
  dismissDeliveredNotifications,
  doseKey,
  logScheduledCount,
  resetAllNotifications,
  scheduleDoseReminders,
  setAlarmScreenVisible,
} from './notifications';
import {
  addPill as addPillToStorage,
  clearPillsAndLog,
  deletePillData,
  DoseLogEntry,
  getDoseLog,
  getFamilyPhone,
  getNextPendingPill,
  getNextTomorrowPill,
  getPills,
  getTodayCounts,
  isTodaySlot,
  Pill,
  recordDose,
  setFamilyPhone as setFamilyPhoneInStorage,
  todayDateString,
  todayOccurrence,
} from './storage';
import { sendLateDoseAlert, sendMissedDoseAlert } from './telegram';

const CHECK_INTERVAL_MS = 15_000;

export type ActiveAlarm = {
  pill: Pill;
  scheduledAt: Date;
  escalated: boolean;
};

export type ConfirmBanner = {
  text: string;
  tone: 'success' | 'info';
};

const DOUBLE_TAP_GUARD_MS = 1_000;
const EARLY_CONFIRM_WINDOW_MS = 60 * 60 * 1000; // main button confirms up to 60 min early
const BANNER_DURATION_MS = 2_000;
const CONFIRM_SPEECH = 'Записано. Спасибо!';
const NOTHING_PENDING_SPEECH = 'На сегодня всё принято';

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

const isDemoPill = (pill: Pill) => pill.id.startsWith('demo');

export function useDoseManager() {
  const [pills, setPills] = useState<Pill[]>([]);
  const [doseLog, setDoseLog] = useState<DoseLogEntry[]>([]);
  const [familyPhone, setFamilyPhoneState] = useState<string | null>(null);
  const [activeAlarm, setActiveAlarm] = useState<ActiveAlarm | null>(null);
  const [banner, setBanner] = useState<ConfirmBanner | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBanner = useCallback((text: string, tone: ConfirmBanner['tone']) => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    setBanner({ text, tone });
    bannerTimerRef.current = setTimeout(() => setBanner(null), BANNER_DURATION_MS);
  }, []);

  // Guards against double-tapping/duplicate triggers (button + notification
  // tap racing, etc.) confirming the same dose twice within one second.
  const lastConfirmedAtRef = useRef<Record<string, number>>({});

  const activeAlarmRef = useRef<ActiveAlarm | null>(null);
  useEffect(() => {
    activeAlarmRef.current = activeAlarm;
    setAlarmScreenVisible(activeAlarm !== null);
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
    // Demo pills only ever schedule for today (their alarm's own follow-ups);
    // a next-day slot would never be cancelled.
    if (isDemoPill(pill) && todayDateString(at) !== todayDateString()) return;
    // Serialization per dose key lives in scheduleDoseReminders.
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
    // Re-read the persisted log: if the dose was confirmed in the meantime,
    // write nothing and send nothing.
    const today = todayDateString();
    const existing = await getDoseLog();
    if (
      existing.some(
        (e) => e.pillId === pill.id && e.date === today && e.status === 'taken'
      )
    ) {
      return;
    }
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
    // A fresh alarm blocks checking, but an escalated one (family already
    // notified, dose logged "missed") must not — other pills still alarm.
    // The escalated pill itself is skipped below via its "missed" log entry.
    if (activeAlarmRef.current && !activeAlarmRef.current.escalated) return;
    const now = new Date();
    const today = todayDateString(now);
    for (const pill of pillsRef.current) {
      const scheduled = todayOccurrence(pill.time, now);
      if (scheduled.getTime() > now.getTime()) continue;
      // A slot earlier than the pill's own creation time isn't a slot for
      // today (pill added at 14:00 for 09:00) — never fire for it.
      if (!isTodaySlot(pill, now)) continue;
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
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
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
      const now = Date.now();
      if (now - (lastConfirmedAtRef.current[pill.id] ?? 0) < DOUBLE_TAP_GUARD_MS) {
        return;
      }
      lastConfirmedAtRef.current[pill.id] = now;

      console.log(`[SilverCare] confirmed dose: ${pill.name} (${pill.time})`);

      const today = todayDateString();
      const wasMissed = doseLogRef.current.some(
        (e) => e.pillId === pill.id && e.date === today && e.status === 'missed'
      );

      await cancelDoseReminders(doseKey(pill.id, today));
      if (isDemoPill(pill)) await cancelAllDemoReminders();
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

      // A demo dose has no "next occurrence" — everything of it is cancelled.
      if (!isDemoPill(pill)) {
        await scheduleAndTrack(
          pill,
          nextUnresolvedOccurrence(pill, log, new Date())
        );
      }
      await logScheduledCount('after confirm');
      if (wasMissed) {
        sendLateDoseAlert(pill.name).catch(() => {});
      }

      Vibration.vibrate(200);
      Speech.speak(CONFIRM_SPEECH, { language: 'ru-RU' });
      showBanner('Принято', 'success');
    },
    [scheduleAndTrack, clearEscalationTimer, showBanner]
  );

  // Tapping a delivered reminder notification opens that dose's alarm
  // screen (rather than silently confirming it), so the user still goes
  // through the same speech/vibration/confirm flow.
  useEffect(() => {
    const sub = addNotificationTapListener((pillId) => {
      if (activeAlarmRef.current?.pill.id === pillId) return;
      const pill = pillsRef.current.find((p) => p.id === pillId);
      if (!pill) return;
      getDoseLog().then((log) => {
        const today = todayDateString();
        const taken = log.some(
          (e) => e.pillId === pill.id && e.date === today && e.status === 'taken'
        );
        if (taken) return;
        activateAlarm(pill, todayOccurrence(pill.time, new Date()));
      });
    });
    return () => sub.remove();
  }, [activateAlarm]);

  // What the main screen's green circle confirms when pressed:
  // 1) the active alarm's dose, if one is showing;
  // 2) otherwise the oldest overdue-but-untaken dose today, or the soonest
  //    upcoming one if it's due within the next hour (lets a user confirm
  //    early without waiting for the alarm);
  // 3) otherwise — nothing due/overdue/soon, or nothing left today — say so
  //    and log nothing.
  const confirmMainButtonDose = useCallback(async () => {
    if (activeAlarmRef.current) {
      await confirmDose(activeAlarmRef.current.pill);
      return;
    }
    const pending = getNextPendingPill(pillsRef.current, doseLogRef.current);
    if (!pending) {
      // Nothing left today. A pill with no slot today (added after its time)
      // is not confirmable — say when it's next due instead.
      const tomorrow = getNextTomorrowPill(pillsRef.current);
      const text = tomorrow
        ? `Ещё рано. Следующий приём завтра в ${tomorrow.time}`
        : NOTHING_PENDING_SPEECH;
      Speech.speak(text, { language: 'ru-RU' });
      showBanner(text, 'info');
      return;
    }
    const now = new Date();
    const scheduled = todayOccurrence(pending.time, now);
    const eligible = scheduled.getTime() - now.getTime() <= EARLY_CONFIRM_WINDOW_MS;
    if (!eligible) {
      const text = `Ещё рано. Следующий приём в ${pending.time}`;
      Speech.speak(text, { language: 'ru-RU' });
      showBanner(text, 'info');
      return;
    }
    await confirmDose(pending);
  }, [confirmDose, showBanner]);

  const saveFamilyPhone = useCallback(async (phone: string) => {
    await setFamilyPhoneInStorage(phone);
    setFamilyPhoneState(phone);
  }, []);

  const deletePill = useCallback(
    async (pillId: string) => {
      await cancelAllForPill(pillId);
      const { pills: nextPills, log: nextLog } = await deletePillData(pillId);
      setPills(nextPills);
      setDoseLog(nextLog);
      if (activeAlarmRef.current?.pill.id === pillId) {
        setActiveAlarm(null);
        clearEscalationTimer();
      }
    },
    [clearEscalationTimer]
  );

  const resetAllData = useCallback(async () => {
    await resetAllNotifications();
    await clearPillsAndLog();
    setPills([]);
    setDoseLog([]);
    setActiveAlarm(null);
    clearEscalationTimer();
  }, [clearEscalationTimer]);

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
        createdAt: now.getTime(),
      };
      // Demo pills go straight through activateAlarm, never through
      // checkDue, so the createdAt staleness check never applies to them.
      activateAlarm(demoPill, now);
    }, 10_000);
  }, [activateAlarm]);

  const todayCounts = getTodayCounts(pills, doseLog);
  const nextPendingPill = getNextPendingPill(pills, doseLog);
  const nextTomorrowPill = getNextTomorrowPill(pills);

  return {
    pills,
    doseLog,
    todayCounts,
    nextPendingPill,
    nextTomorrowPill,
    familyPhone,
    activeAlarm,
    banner,
    addPill,
    deletePill,
    saveFamilyPhone,
    resetAllData,
    confirmDose,
    confirmMainButtonDose,
    triggerDemoAlarm,
  };
}
