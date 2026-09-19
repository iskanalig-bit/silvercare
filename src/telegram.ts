import {
  PATIENT_NAME,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
} from './telegramConfig';

// Sends "[Имя] не приняла лекарство [название] в [время]" to the family's
// Telegram chat. Returns false (without throwing) if credentials are missing
// or the request fails — escalation should never crash the alarm flow.
export async function sendMissedDoseAlert(
  pillName: string,
  time: string
): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn(
      'SilverCare: telegramConfig.ts has no bot token / chat id, skipping Telegram alert'
    );
    return false;
  }
  const text = `${PATIENT_NAME} не приняла лекарство ${pillName} в ${time}`;
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}
