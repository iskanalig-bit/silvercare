@AGENTS.md

# SilverCare — project rules

Hackathon MVP medication reminder app for elderly users with weak sight/hearing.
Plain React Native (no expo-router), Expo Go only, AsyncStorage only, no backend.

## Hard UI constraints — do not violate without being asked
- **One screen.** No tabs, side menus, or registration. Everything else
  (add pill, settings, memory game, alarm) is a full-screen `Modal`.
- Main screen must fit 360×640–430×932 with **no scrolling**. Sizes are
  computed from `useWindowDimensions` + a measured `onLayout`, not hardcoded.
- Three circles: green "Принял(а)" (top, 210dp), blue "Память" and navy
  "Позвонить семье" (bottom pair, 190dp each). **190dp is an absolute
  floor** — circles never shrink smaller; when the screen is too tight,
  they overlap (negative margin) instead. See `MainScreen.tsx`.
- Palette only, no pure white, no neon: background `#F3F5F2`, text `#0B1F33`,
  green `#1A5C3A`, blue `#1D4E89`, navy `#0B1F33`, panel/border `#DDE3E6`,
  amber `#8A5A00`. White text on colored buttons only (`colors.onButton`).
  All colors live in `src/theme.ts` — don't inline new hex values.
  `colors.placeholder` is the only allowed non-palette-literal color
  (translucent text color, for input placeholders).
- Flat icons only: `@expo/vector-icons` Ionicons, white, no shadows/gradients.
- Every UI string is Russian.
- Circle button labels ≥26sp; card label/counter/add-button text ≥22sp.

## Data model (`src/storage.ts`)
- `Pill { id, name, time: "HH:MM", createdAt }`. A pill whose time today is
  earlier than `createdAt` is NOT a slot for today (`isTodaySlot` in
  storage.ts): `getNextPendingPill`, `getTodayCounts`, `checkDue` and
  `confirmMainButtonDose` all ignore it, and the card shows
  "Завтра HH:MM · name". Demo pills bypass `checkDue` (straight into
  `activateAlarm`), so they're exempt.
- `DoseLogEntry` keyed by `${pillId}:${date}:${time}`, status `taken|missed`.
  `recordDose()` never downgrades an existing `taken` entry.
- `getTodayCounts(pills, log)`: total = number of real pills (demo pills
  never enter `pills`, so they can't inflate it); taken = pills with a
  `taken` entry today. Always pass `pills`, not just the log.
- Family phone has **no fake default** — `getFamilyPhone()` returns `null`
  until the user sets one in Settings. Any "call family" action must open
  Settings when the phone is unset, not dial a placeholder.

## Notifications (`src/notifications.ts`)
- One dose slot = `doseKey(pillId, date)`. Notification ids for that slot
  persist in AsyncStorage (not just a React ref) so they survive reloads.
- `scheduleDoseReminders` is **idempotent**: it always cancels whatever's
  already scheduled for that exact slot before scheduling new ones. Never
  call the raw Expo Notifications schedule API directly from elsewhere —
  go through this module or duplicates/orphans come back.
- Scheduling/cancelling is serialized per dose key and all writes to the id
  map go through one queue (`serializeForKey` / `mutateMap`); ids are merged
  into a key's list as soon as they exist, never overwritten. Don't bypass.
- Demo pills (id starts with `demo`) never schedule next-day reminders; when
  a demo dose is confirmed, `cancelAllDemoReminders()` clears everything of
  theirs. The `(after confirm)` count must return to the pre-demo count.
- On app boot, `resetAllNotifications()` wipes every OS-level scheduled
  notification + the id map, then only un-taken doses get rescheduled.
  This is the safety net against accumulation bugs — keep it.
- Per dose: the dose-time notification + 5 follow-ups every 2 minutes (6
  total). Well under iOS's 64-pending limit; don't raise this casually.
- While the alarm screen is showing (`setAlarmScreenVisible`), the
  notification handler suppresses banner + sound (still appears in the
  notification list) so it doesn't pile onto the alarm's own
  speech/vibration/flash.
- Tapping a delivered notification **opens that pill's alarm screen**
  (`activateAlarm`) — it must never silently confirm the dose.

## confirmDose is the single source of truth (`src/useDoseManager.ts`)
Every "I took it" path — main screen button, alarm screen button — must go
through the one `confirmDose(pill)`. It: guards against double-taps within
1s, cancels that dose's reminders + dismisses delivered ones, stops
Speech/Vibration, records `taken`, clears a matching active alarm + its
escalation timer, reschedules the pill's next occurrence, sends the
"с опозданием" Telegram message if the dose had escalated, and gives
feedback (vibration + "Записано. Спасибо!" speech + green "Принято" banner,
2s). Don't add a second confirm path — extend `confirmDose` instead.

`confirmMainButtonDose` (what the green circle on the main screen actually
calls) picks the dose: active alarm's pill if one is showing; else the
oldest overdue/soonest-upcoming pending pill, but **only if it's due,
overdue, or within 60 minutes of its time** — otherwise it speaks/shows
"Ещё рано. Следующий приём в HH:MM" and logs nothing; if nothing is pending
today it says "На сегодня всё принято" and logs nothing either.

## Alarms
- `escalate()` re-reads the persisted log and does nothing if the dose is
  already taken today. A notification tap for an already-taken dose does nothing.
- iOS can't present two modals at once. When an alarm starts, MainScreen
  closes every other modal, waits ~400ms (only if one was open), then shows
  AlarmScreen; no modal may be opened while an alarm is pending. AlarmScreen
  starts speech/vibration/flash from the Modal's `onShow`, and never opens
  Settings (unset family phone → an on-screen hint instead).
- An escalated alarm (family notified, dose logged missed) does NOT block
  `checkDue` — other pills still alarm and replace it on screen.

## Escalation & Telegram (`src/config.ts`, `src/telegram.ts`)
- `ESCALATION_MINUTES` = 1 in `DEMO_MODE`, else 10. Flip `DEMO_MODE` for
  real use, don't hardcode a different number elsewhere.
- Missed: `"{PATIENT_NAME} не принял(а) {pill} в {time}"`. Confirmed late
  (was logged `missed`, then confirmed): `"{PATIENT_NAME} принял(а) {pill}
  с опозданием"`. Keep the gender-neutral "(а)" form.
- Real credentials go in `src/telegramConfig.ts` (gitignored, not
  committed). `src/telegramConfig.example.ts` is the committed template —
  update both if the config shape changes. Never hardcode a token/chat id
  in a tracked file.

## Before committing
1. `npx tsc --noEmit` must be clean.
2. `npx expo export --platform android -c` must bundle without errors,
   then `rm -rf dist` (it's just a sanity check, not an artifact to keep).
3. One logical change per commit, with a message explaining *why*, not
   just what.
4. Real device testing (Expo Go via `npx expo start --tunnel` or LAN) is
   the user's job — always give concrete test steps in the reply, don't
   claim something works on-device without them confirming it.
