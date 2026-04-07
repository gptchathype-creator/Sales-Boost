/**
 * Пять шкал UI (0–10) из чеклиста — тот же расчёт, что в buildVoiceCallDetailResponse.
 */

export function computeUiDimensionScoresFromChecklist(
  checklist: Array<{ code?: string; status?: string }>,
  dimensionScoresRaw: unknown
): Record<string, number | unknown> {
  if (!Array.isArray(checklist) || checklist.length === 0) {
    return dimensionScoresRaw as Record<string, number | unknown>;
  }

  const byCode = new Map<string, string>();
  for (const it of checklist) {
    const code = String(it?.code ?? '').trim();
    const status = String(it?.status ?? '').trim();
    if (code) byCode.set(code, status);
  }

  const to10 = (status?: string | null) => {
    const s = String(status || '').toUpperCase();
    if (s === 'YES') return 9;
    if (s === 'PARTIAL') return 6;
    if (s === 'NO') return 3;
    if (s === 'NA') return 8;
    return 5;
  };

  const avg = (codes: string[]) => {
    const vals = codes.map((c) => to10(byCode.get(c) || null));
    return Math.round((vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length)) * 10) / 10;
  };

  return {
    контакт: avg(['INTRODUCTION', 'SALON_NAME', 'CAR_IDENTIFICATION', 'INITIATIVE', 'COMMUNICATION_TONE']),
    диагностика: avg(['NEEDS_DISCOVERY']),
    презентация: avg(['PRODUCT_PRESENTATION', 'CREDIT_EXPLANATION', 'TRADEIN_OFFER']),
    возражения: avg(['OBJECTION_HANDLING']),
    следующий_шаг: avg(['NEXT_STEP_PROPOSAL', 'DATE_FIXATION', 'FOLLOW_UP_AGREEMENT']),
    _raw: dimensionScoresRaw,
  };
}
