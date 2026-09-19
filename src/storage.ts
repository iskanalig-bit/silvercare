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

export const DEFAULT_FAMILY_PHONE = '+70000000000';

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

export async function getFamilyPhone(): Promise<string> {
  const raw = await AsyncStorage.getItem(FAMILY_PHONE_KEY);
  return raw ?? DEFAULT_FAMILY_PHONE;
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

// The soonest pill for today that hasn't been logged as taken yet, sorted by
// scheduled time. Used both for the main screen's dose card and for the
// "Принял(а)" shortcut that lets a user log a dose before its alarm fires.
export function getNextPendingPill(
  pills: Pill[],
  log: DoseLogEntry[],
  date: string = todayDateString()
): Pill | null {
  const pending = pills.filter(
    (p) =>
      !log.some(
        (e) => e.pillId === p.id && e.date === date && e.status === 'taken'
      )
  );
  if (pending.length === 0) return null;
  return [...pending].sort((a, b) => a.time.localeCompare(b.time))[0];
}

export function getTodayCounts(
  log: DoseLogEntry[],
  date: string = todayDateString()
): { taken: number; total: number } {
  const today = log.filter((e) => e.date === date);
  return {
    taken: today.filter((e) => e.status === 'taken').length,
    total: today.length,
  };
}
