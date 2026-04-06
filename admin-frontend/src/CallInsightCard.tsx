import React from 'react';

export type CallInsightDetail = {
  id: number;
  to: string;
  startedAt: string | null;
  endedAt: string | null;
  outcome: string | null;
  durationSec: number | null;
  totalScore: number | null;
  qualityTag: string | null;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  transcript: { role: 'client' | 'manager'; text: string }[];
  dimensionScores?: Record<string, number> | null;
  processingError?: string | null;
};

export function CallInsightCard(props: { detail: CallInsightDetail }) {
  const { detail } = props;

  return (
    <div className="rounded-2xl admin-card-inner px-4 py-3 space-y-3">
      <div className="flex justify-between items-center gap-3">
        <div className="font-semibold text-sm break-all">{detail.to}</div>
        {detail.qualityTag && (
          <span className="text-[11px] px-2 py-1 rounded-full admin-badge-neutral shrink-0">
            {detail.qualityTag}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold">
        {detail.totalScore != null ? `${detail.totalScore.toFixed(1)}/100` : 'Н/Д'}
      </div>
      <div className="text-xs text-default-500 space-y-1">
        <div>Исход: {detail.outcome ?? '—'}</div>
        <div>
          Начало: {detail.startedAt ? new Date(detail.startedAt).toLocaleString('ru-RU') : '—'}
        </div>
        <div>
          Конец: {detail.endedAt ? new Date(detail.endedAt).toLocaleString('ru-RU') : '—'}
        </div>
      </div>
      {detail.processingError && (
        <div className="rounded-xl admin-card-inner px-3 py-2 text-xs text-danger">
          {detail.processingError}
        </div>
      )}
      {detail.dimensionScores && (
        <div>
          <div className="text-xs font-semibold mb-1">Ключевые показатели</div>
          <div className="space-y-2">
            {Object.entries(detail.dimensionScores).map(([key, value]) => {
              const v = typeof value === 'number' ? value : 0;
              const norm = v <= 1 ? v * 10 : v;
              const pct = Math.max(0, Math.min(10, norm)) * 10;
              const color =
                norm >= 8 ? 'bg-emerald-500' : norm >= 5 ? 'bg-amber-500' : 'bg-rose-500';
              const label = key.replace(/_/g, ' ');
              return (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between text-[11px] text-default-500 gap-3">
                    <span className="capitalize">{label}</span>
                    <span>{norm.toFixed(1)}/10</span>
                  </div>
                  <div className="h-1.5 rounded-full admin-progress-track overflow-hidden">
                    <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div>
        <div className="text-xs font-semibold mb-1">Сильные стороны</div>
        {detail.strengths?.length ? (
          <ul className="text-xs text-default-500 list-disc pl-4 space-y-1">
            {detail.strengths.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-default-500">Нет выделенных сильных сторон.</p>
        )}
      </div>
      <div>
        <div className="text-xs font-semibold mb-1">Слабые стороны</div>
        {detail.weaknesses?.length ? (
          <ul className="text-xs text-default-500 list-disc pl-4 space-y-1">
            {detail.weaknesses.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-default-500">Слабые стороны не выделены.</p>
        )}
      </div>
      <div>
        <div className="text-xs font-semibold mb-1">Рекомендации</div>
        {detail.recommendations?.length ? (
          <ul className="text-xs text-default-500 list-disc pl-4 space-y-1">
            {detail.recommendations.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-default-500">Отдельных рекомендаций нет.</p>
        )}
      </div>
    </div>
  );
}
