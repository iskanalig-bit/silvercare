// Demo mode shortens the escalation window so judges don't have to wait
// 10 real minutes to see the family-alert flow. Flip to false for real use.
export const DEMO_MODE = true;
export const ESCALATION_MINUTES = DEMO_MODE ? 1 : 10;
