import AsyncStorage from '@react-native-async-storage/async-storage';

export type Pill = {
  id: string;
  name: string;
  time: string; // "HH:MM", 24h
  createdAt: number; // Date.now() when added — a time slot earlier than this
  // on the day the pill was added is stale and should never fire
};

export type DoseStatus = 'taken' | 'missed';

export type DoseLogEntry = {
  id: string; // `${pillId}:${date}:${time}`
  pillId: string;
  pillName: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM" scheduled time
  status: DoseStatus;
  at: string; // ISO timestamp of when this status was recorded
};

const PILLS_KEY = '@silvercare/pills';
const FAMILY_PHONE_KEY = '@silvercare/familyPhone';
const DOSE_LOG_KEY = '@silvercare/doseLog';

export function todayDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function getPills(): Promise<Pill[]> {
  const raw = await AsyncStorage.getItem(PILLS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Pill[];
  } catch {
    return [];
  }
}

export async function savePills(pills: Pill[]): Promise<void> {
  await AsyncStorage.setItem(PILLS_KEY, JSON.stringify(pills));
}

export async function addPill(name: string, time: string): Promise<Pill> {
  const pills = await getPills();
  const pill: Pill = { id: `${Date.now()}`, name, time, createdAt: Date.now() };
  await savePills([...pills, pill]);
  return pill;
}

// No fake default: null means the family hasn't set a number yet.
export async function getFamilyPhone(): Promise<string | null> {
  return AsyncStorage.getItem(FAMILY_PHONE_KEY);
}

export async function setFamilyPhone(phone: string): Promise<void> {
  await AsyncStorage.setItem(FAMILY_PHONE_KEY, phone);
}

export async function getDoseLog(): Promise<DoseLogEntry[]> {
  const raw = await AsyncStorage.getItem(DOSE_LOG_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as DoseLogEntry[];
  } catch {
    return [];
  }
}

// Upserts by id. A dose already marked "taken" is never downgraded to "missed"
// (covers the case where escalation fires just as the user confirms).
export async function recordDose(
  entry: Omit<DoseLogEntry, 'id'>
): Promise<DoseLogEntry[]> {
  const id = `${entry.pillId}:${entry.date}:${entry.time}`;
  const log = await getDoseLog();
  const existing = log.find((e) => e.id === id);
  if (existing?.status === 'taken') {
    return log;
  }
  const next = log.filter((e) => e.id !== id);
  next.push({ ...entry, id });
  await AsyncStorage.setItem(DOSE_LOG_KEY, JSON.stringify(next));
  return next;
}

// Removes a pill and every log entry that belongs to it. Notification
// cancellation is handled separately (src/notifications.ts) since this
// module doesn't know about scheduled notification ids.
export async function deletePillData(
  pillId: string
): Promise<{ pills: Pill[]; log: DoseLogEntry[] }> {
  const pills = (await getPills()).filter((p) => p.id !== pillId);
  await savePills(pills);
  const log = (await getDoseLog()).filter((e) => e.pillId !== pillId);
  await AsyncStorage.setItem(DOSE_LOG_KEY, JSON.stringify(log));
  return { pills, log };
}

// "Сбросить данные": wipes every pill and every log entry (family phone is
// left untouched — it's contact info, not dose data).
export async function clearPillsAndLog(): Promise<void> {
  await AsyncStorage.multiRemove([PILLS_KEY, DOSE_LOG_KEY]);
}

export function todayOccurrence(time: string, now: Date = new Date()): Date {
  const [h, m] = time.split(':').map(Number);
  const candidate = new Date(now);
  candidate.setHours(h, m, 0, 0);
  return candidate;
}

// A pill whose time today is earlier than the moment it was created is NOT a
// slot for today (added at 14:00 for "09:00" → first real slot is tomorrow).
// Pills saved before createdAt existed count as real slots.
export function isTodaySlot(pill: Pill, now: Date = new Date()): boolean {
  return todayOccurrence(pill.time, now).getTime() >= (pill.createdAt ?? 0);
}

// The earliest pill whose first slot is tomorrow (see isTodaySlot).
export function getNextTomorrowPill(
  pills: Pill[],
  now: Date = new Date()
): Pill | null {
  const stale = pills.filter((p) => !isTodaySlot(p, now));
  if (stale.length === 0) return null;
  return [...stale].sort((a, b) => a.time.localeCompare(b.time))[0];
}

// The soonest pill for today that hasn't been logged as taken yet, sorted by
// scheduled time. Used both for the main screen's dose card and for the
// "Принял(а)" shortcut that lets a user log a dose before its alarm fires.
// Pills that have no slot today (isTodaySlot) are ignored.
export function getNextPendingPill(
  pills: Pill[],
  log: DoseLogEntry[],
  date: string = todayDateString()
): Pill | null {
  const now = new Date();
  const pending = pills.filter(
    (p) =>
      isTodaySlot(p, now) &&
      !log.some(
        (e) => e.pillId === p.id && e.date === date && e.status === 'taken'
      )
  );
  if (pending.length === 0) return null;
  return [...pending].sort((a, b) => a.time.localeCompare(b.time))[0];
}

// total = every real (non-demo) pill scheduled today; taken = how many of
// those have a "taken" entry for today. Demo pills never appear in `pills`,
// so any demo log entries are ignored automatically.
export function getTodayCounts(
  pills: Pill[],
  log: DoseLogEntry[],
  date: string = todayDateString()
): { taken: number; total: number } {
  const slots = pills.filter((p) => isTodaySlot(p));
  const total = slots.length;
  const taken = slots.filter((p) =>
    log.some((e) => e.pillId === p.id && e.date === date && e.status === 'taken')
  ).length;
  return { taken, total };
}
