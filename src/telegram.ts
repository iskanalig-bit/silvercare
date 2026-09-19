import {
  PATIENT_NAME,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
} from './telegramConfig';

async function sendTelegramMessage(text: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn(
      'SilverCare: telegramConfig.ts has no bot token / chat id, skipping Telegram alert'
    );
    return false;
  }
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

// Sent when a dose escalates without being confirmed in time.
export async function sendMissedDoseAlert(
  pillName: string,
  time: string
): Promise<boolean> {
  return sendTelegramMessage(`${PATIENT_NAME} не принял(а) ${pillName} в ${time}`);
}

// Sent when a dose that already escalated (missed) is later confirmed, so
// the family knows it was taken, just late.
export async function sendLateDoseAlert(pillName: string): Promise<boolean> {
  return sendTelegramMessage(`${PATIENT_NAME} принял(а) ${pillName} с опозданием`);
}
