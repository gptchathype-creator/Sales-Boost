import React, { useEffect, useState } from 'react';
import {
  Tabs,
  Tab,
  Card,
  CardBody,
  Button,
  Input,
  Spacer,
  Select,
  SelectItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
} from '@heroui/react';

type Attempt = {
  id: number | string;
  type: 'attempt' | 'training';
  sessionId?: number;
  userName: string;
  totalScore: number | null;
  qualityTag: string | null;
  summary?: string | null;
  finishedAt?: string | null;
};

type CallSummary = {
  id: number;
  to: string;
  startedAt: string;
  endedAt: string | null;
  durationSec: number | null;
  outcome: string | null;
  totalScore: number | null;
  hasEvaluation: boolean;
};

const isDevHost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.endsWith('.lhr.life'));

function buildDemoCalls(): CallSummary[] {
  const now = Date.now();
  const baseNumber = '+79998887766';
  return Array.from({ length: 10 }).map((_, idx) => {
    const start = new Date(now - (idx + 1) * 3600_000);
    const duration = 40 + idx * 10;
    const outcomes = [ 'completed', 'no_answer', 'busy', 'disconnected' ] as const;
    const outcome = outcomes[idx % outcomes.length];
    const scores = [ 92, 78, 64, 48, 30, null, 85, 55, 10, null ];
    const score = scores[idx] ?? null;
    return {
      id: 10_000 + idx,
      to: baseNumber,
      startedAt: start.toISOString(),
      endedAt: outcome === 'completed' ? new Date(start.getTime() + duration * 1000).toISOString() : start.toISOString(),
      durationSec: outcome === 'completed' ? duration : null,
      outcome,
      totalScore: score,
        hasEvaluation: score != null,
    };
  });
}

type CallDetail = {
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
};

type AttemptDetail = {
  id: number;
  type?: 'attempt' | 'training';
  userName: string;
  testTitle: string;
  startedAt: string | null;
  finishedAt: string | null;
  totalScore: number | null;
  level?: string | null;
  qualityTag: string | null;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  dimensionScores?: Record<string, number> | null;
  steps: {
    order: number;
    customerMessage: string;
    answer: string;
    score: number | null;
    feedback: string | null;
    betterExample: string | null;
  }[];
};

type TeamSummary = {
  totalAttempts: number;
  avgScore: number;
  levelCounts: {
    Junior: number;
    Middle: number;
    Senior: number;
  };
  topWeaknesses: { weakness: string; count: number }[];
  topStrengths: { strength: string; count: number }[];
  expertSummary: string | null;
};

type VoiceDashboard = {
  totalCalls: number;
  answeredPercent: number;
  missedPercent: number;
  avgDurationSec: number;
  outcomeBreakdown: {
    completed: number;
    no_answer: number;
    busy: number;
    failed: number;
    disconnected: number;
  };
};

type ExpensesInfo = {
  periodStart: string;
  periodEnd: string;
  totalSpentUsd: number;
  currency: string;
  error: string | null;
  billingUrl: string;
};

const API_BASE = window.location.origin;

export default function App() {
  const [activeTab, setActiveTab] = useState<'employees' | 'calls' | 'team' | 'expenses'>('employees');

  // Employees state
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [attemptsError, setAttemptsError] = useState<string | null>(null);

  // Team summary state
  const [teamSummary, setTeamSummary] = useState<TeamSummary | null>(null);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);

  const [voiceDashboard, setVoiceDashboard] = useState<VoiceDashboard | null>(null);

  // Expenses state
  const [expenses, setExpenses] = useState<ExpensesInfo | null>(null);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [expensesError, setExpensesError] = useState<string | null>(null);

  // Calls state
  const [calls, setCalls] = useState<CallSummary[]>([]);
  const [callsLoading, setCallsLoading] = useState(false);
  const [callsError, setCallsError] = useState<string | null>(null);
  const [selectedCallId, setSelectedCallId] = useState<number | null>(null);
  const [callDetail, setCallDetail] = useState<CallDetail | null>(null);
  const [callDetailLoading, setCallDetailLoading] = useState(false);
  const [callDetailError, setCallDetailError] = useState<string | null>(null);
  const [scenario, setScenario] = useState<'dialog' | 'realtime' | 'realtime_pure'>('dialog');
  const [phone, setPhone] = useState('');
  const [startCallLoading, setStartCallLoading] = useState(false);
  const [startCallStatus, setStartCallStatus] = useState<string | null>(null);

  useEffect(() => {
    // Force dark mode class on html root
    document.documentElement.classList.add('dark');
  }, []);

  useEffect(() => {
    if (activeTab === 'employees') {
      loadAttempts();
    } else if (activeTab === 'calls') {
      loadCalls();
    } else if (activeTab === 'team') {
      loadTeamSummary();
    } else if (activeTab === 'expenses') {
      loadExpenses();
    }
  }, [activeTab]);

  async function loadAttempts() {
    setAttemptsLoading(true);
    setAttemptsError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/attempts?page=0&limit=1000`);
      const data = await res.json();
      setAttempts(data.attempts ?? []);
    } catch (e: any) {
      setAttemptsError(e?.message || 'Ошибка загрузки сотрудников');
    } finally {
      setAttemptsLoading(false);
    }
  }

  async function loadCalls() {
    setCallsLoading(true);
    setCallsError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/call-history?limit=50`);
      const data = await res.json();
      setCalls(data.calls ?? []);
    } catch (e: any) {
      setCallsError(e?.message || 'Ошибка загрузки звонков');
    } finally {
      setCallsLoading(false);
    }
  }

  async function loadTeamSummary() {
    setTeamLoading(true);
    setTeamError(null);
    try {
      const [summaryRes, voiceRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/summary`),
        fetch(`${API_BASE}/api/admin/voice-dashboard`).catch(() => null),
      ]);
      const data = await summaryRes.json();
      const safe: TeamSummary = {
        totalAttempts: data?.totalAttempts ?? 0,
        avgScore: data?.avgScore ?? 0,
        levelCounts: data?.levelCounts ?? { Junior: 0, Middle: 0, Senior: 0 },
        topWeaknesses: Array.isArray(data?.topWeaknesses) ? data.topWeaknesses : [],
        topStrengths: Array.isArray(data?.topStrengths) ? data.topStrengths : [],
        expertSummary: typeof data?.expertSummary === 'string' ? data.expertSummary : null,
      };
      setTeamSummary(safe);

      if (voiceRes && voiceRes.ok) {
        const v = await voiceRes.json();
        const vd: VoiceDashboard = {
          totalCalls: v?.totalCalls ?? 0,
          answeredPercent: v?.answeredPercent ?? 0,
          missedPercent: v?.missedPercent ?? 0,
          avgDurationSec: v?.avgDurationSec ?? 0,
          outcomeBreakdown: {
            completed: v?.outcomeBreakdown?.completed ?? 0,
            no_answer: v?.outcomeBreakdown?.no_answer ?? 0,
            busy: v?.outcomeBreakdown?.busy ?? 0,
            failed: v?.outcomeBreakdown?.failed ?? 0,
            disconnected: v?.outcomeBreakdown?.disconnected ?? 0,
          },
        };
        setVoiceDashboard(vd);
      } else {
        setVoiceDashboard(null);
      }
    } catch (e: any) {
      setTeamError(e?.message || 'Ошибка загрузки команды');
    } finally {
      setTeamLoading(false);
    }
  }

  async function loadExpenses() {
    setExpensesLoading(true);
    setExpensesError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/expenses`);
      const data = await res.json();
      const safe: ExpensesInfo = {
        periodStart: data?.periodStart ?? new Date().toISOString(),
        periodEnd: data?.periodEnd ?? new Date().toISOString(),
        totalSpentUsd: typeof data?.totalSpentUsd === 'number' ? data.totalSpentUsd : 0,
        currency: data?.currency ?? 'USD',
        error: data?.error ?? null,
        billingUrl: data?.billingUrl ?? 'https://platform.openai.com/account/billing',
      };
      setExpenses(safe);
    } catch (e: any) {
      setExpensesError(e?.message || 'Ошибка загрузки баланса');
    } finally {
      setExpensesLoading(false);
    }
  }

  async function handleStartCall() {
    if (!phone.trim()) {
      setStartCallStatus('Введите номер телефона.');
      return;
    }
    setStartCallLoading(true);
    setStartCallStatus('Инициируем звонок...');
    try {
      const res = await fetch(`${API_BASE}/api/admin/start-voice-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: phone.trim(), scenario }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStartCallStatus(data.error || `Ошибка ${res.status}`);
      } else {
        const scenarioLabel =
          scenario === 'realtime'
            ? ' (OpenAI Realtime, гибрид)'
            : scenario === 'realtime_pure'
            ? ' (OpenAI Realtime, чистый)'
            : ' (наш LLM)';
        setStartCallStatus(`Звонок инициирован. Номер: ${(data.to || phone) + scenarioLabel}`);
        loadCalls();
      }
    } catch (e: any) {
      setStartCallStatus(`Ошибка: ${e?.message || 'неизвестная ошибка'}`);
    } finally {
      setStartCallLoading(false);
    }
  }

  async function loadCallDetail(id: number) {
    setSelectedCallId(id);
    setCallDetail(null);
    setCallDetailError(null);
    setCallDetailLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/call-history/${id}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Ошибка ${res.status}`);
      }
      setCallDetail(data);
    } catch (e: any) {
      setCallDetailError(e?.message || 'Ошибка загрузки звонка');
    } finally {
      setCallDetailLoading(false);
    }
  }

  return (
    <div className="bg-background text-foreground min-h-screen px-4 py-4 flex justify-center">
      <div className="w-full max-w-md">
        <Card shadow="sm" className="mb-4 bg-default-50">
          <CardBody>
            <h1 className="text-lg font-semibold mb-1">Админ‑панель</h1>
            <p className="text-xs text-default-500">Sales Boost · Telegram Mini App</p>
          </CardBody>
        </Card>

        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(k) => setActiveTab(k as any)}
          variant="underlined"
          color="primary"
          aria-label="Разделы админ‑панели"
        >
          <Tab key="employees" title="Сотрудники">
            <EmployeesTab loading={attemptsLoading} error={attemptsError} attempts={attempts} />
          </Tab>
          <Tab key="calls" title="Звонки">
            <CallsTab
              loading={callsLoading}
              error={callsError}
              calls={calls}
              scenario={scenario}
              onScenarioChange={setScenario}
              phone={phone}
              onPhoneChange={setPhone}
              startCallLoading={startCallLoading}
              startCallStatus={startCallStatus}
              onStartCall={handleStartCall}
              selectedCallId={selectedCallId}
              callDetail={callDetail}
              callDetailLoading={callDetailLoading}
              callDetailError={callDetailError}
              onSelectCall={loadCallDetail}
            />
          </Tab>
          <Tab key="team" title="Команда">
            <TeamTab loading={teamLoading} error={teamError} summary={teamSummary} voice={voiceDashboard} />
          </Tab>
          <Tab key="expenses" title="Баланс">
            <ExpensesTab loading={expensesLoading} error={expensesError} info={expenses} />
          </Tab>
        </Tabs>
      </div>
    </div>
  );
}

function EmployeesTab(props: { loading: boolean; error: string | null; attempts: Attempt[] }) {
  const { loading, error, attempts } = props;
  const [selected, setSelected] = useState<Attempt | null>(null);
  const [detail, setDetail] = useState<AttemptDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  async function openDetail(attempt: Attempt) {
    setSelected(attempt);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      let url: string;
      if (attempt.type === 'training' && attempt.sessionId) {
        url = `${API_BASE}/api/admin/training-sessions/${attempt.sessionId}`;
      } else {
        url = `${API_BASE}/api/admin/attempts/${attempt.id}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Ошибка ${res.status}`);
      }
      setDetail(data as AttemptDetail);
    } catch (e: any) {
      setDetailError(e?.message || 'Ошибка загрузки результата');
    } finally {
      setDetailLoading(false);
    }
  }
  if (loading) {
    return (
      <Card shadow="sm">
        <CardBody className="text-sm text-default-500">Загрузка сотрудников…</CardBody>
      </Card>
    );
  }
  if (error) {
    return (
      <Card shadow="sm">
        <CardBody className="text-sm text-danger-400">Ошибка: {error}</CardBody>
      </Card>
    );
  }
  if (!attempts.length) {
    return (
      <Card shadow="sm" className="bg-slate-900 border border-slate-800">
        <CardBody className="text-sm text-default-500">Пока нет оценённых звонков.</CardBody>
      </Card>
    );
  }
  return (
    <>
      <div className="space-y-3">
        {attempts.map((a) => {
          const score = a.totalScore;
          const scoreClass =
            score == null ? 'text-default-500' : score >= 76 ? 'text-success-400' : score >= 50 ? 'text-warning-400' : 'text-danger-400';
          const quality =
            a.qualityTag ||
            (score != null ? (score >= 76 ? 'Хорошо' : score >= 50 ? 'Средне' : 'Плохо') : null);
          return (
            <Card
              key={a.id}
              isPressable
              onPress={() => openDetail(a)}
              shadow="sm"
              className="bg-slate-900 border border-slate-800 w-full"
            >
              <CardBody>
                <div className="flex justify-between items-center mb-1">
                  <div className="font-semibold text-sm">{a.userName}</div>
                  {quality && (
                    <span className="text-[11px] px-2 py-1 rounded-full bg-default-100 text-default-700">{quality}</span>
                  )}
                </div>
                <div className={`text-xl font-bold ${scoreClass}`}>{score != null ? `${score.toFixed(1)}/100` : 'Н/Д'}</div>
                {a.finishedAt && (
                  <div className="text-[11px] text-default-500 mt-1">
                    {new Date(a.finishedAt).toLocaleString('ru-RU')}
                  </div>
                )}
                {a.summary && (
                  <div className="mt-2 text-xs text-default-500 line-clamp-3">{a.summary}</div>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>

      <Modal
        isOpen={detailOpen && !!selected}
        onOpenChange={setDetailOpen}
        scrollBehavior="inside"
        placement="bottom-center"
        size="lg"
      >
        <ModalContent className="bg-transparent shadow-none">
          {() => (
            <>
              <ModalHeader className="text-sm font-semibold">
                {detail?.userName || selected?.userName || 'Карточка результата'}
              </ModalHeader>
              <ModalBody>
                {detailLoading ? (
                  <div className="rounded-2xl bg-slate-900 border border-slate-800 px-4 py-3 text-sm text-default-500">
                    Загрузка…
                  </div>
                ) : detailError ? (
                  <div className="rounded-2xl bg-slate-900 border border-slate-800 px-4 py-3 text-sm text-danger-400">
                    Ошибка: {detailError}
                  </div>
                ) : detail ? (
                  <div className="rounded-2xl bg-slate-900 border border-slate-800 px-4 py-3 space-y-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-semibold text-sm">{detail.userName}</div>
                          <div className="text-[11px] text-default-500">{detail.testTitle}</div>
                        </div>
                        {detail.qualityTag && (
                          <span className="text-[11px] px-2 py-1 rounded-full bg-slate-800 text-slate-100">
                            {detail.qualityTag}
                          </span>
                        )}
                      </div>

                      <div className="text-2xl font-bold">
                        {detail.totalScore != null ? `${detail.totalScore.toFixed(1)}/100` : 'Н/Д'}
                      </div>
                      <div className="text-xs text-default-500 space-y-1">
                        <div>
                          Начало:{' '}
                          {detail.startedAt ? new Date(detail.startedAt).toLocaleString('ru-RU') : '—'}
                        </div>
                        <div>
                          Конец:{' '}
                          {detail.finishedAt ? new Date(detail.finishedAt).toLocaleString('ru-RU') : '—'}
                        </div>
                      </div>

                      {detail.dimensionScores && (
                        <div>
                          <div className="text-xs font-semibold mb-1">Ключевые показатели</div>
                          <div className="space-y-2">
                            {Object.entries(detail.dimensionScores).map(([key, value]) => {
                              const v = typeof value === 'number' ? value : 0;
                              const norm = v <= 1 ? v * 10 : v; // поддержка 0–1 и 0–10
                              const pct = Math.max(0, Math.min(10, norm)) * 10;
                              const color =
                                norm >= 8 ? 'bg-emerald-500' : norm >= 5 ? 'bg-amber-500' : 'bg-rose-500';
                              const label = key.replace(/_/g, ' ');
                              return (
                                <div key={key} className="space-y-1">
                                  <div className="flex justify-between text-[11px] text-default-500">
                                    <span>{label}</span>
                                    <span>{norm.toFixed(1)}/10</span>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                    <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div>
                        <div className="text-xs font-semibold mb-1">✅ Сильные стороны</div>
                        {detail.strengths.length ? (
                          <ul className="text-xs text-default-500 list-disc pl-4 space-y-1">
                            {detail.strengths.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-default-500">Нет выделенных сильных сторон.</p>
                        )}
                      </div>

                      <div>
                        <div className="text-xs font-semibold mb-1">⚠️ Зоны роста</div>
                        {detail.weaknesses.length ? (
                          <ul className="text-xs text-default-500 list-disc pl-4 space-y-1">
                            {detail.weaknesses.map((w, i) => (
                              <li key={i}>{w}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-default-500">Зоны роста не выделены.</p>
                        )}
                      </div>

                      <div>
                        <div className="text-xs font-semibold mb-1">💡 Рекомендации</div>
                        {detail.recommendations.length ? (
                          <ul className="text-xs text-default-500 list-disc pl-4 space-y-1">
                            {detail.recommendations.map((r, i) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-default-500">Отдельных рекомендаций нет.</p>
                        )}
                      </div>

                      {!!detail.steps.length && (
                        <div>
                          <div className="text-xs font-semibold mb-1">Диалог по шагам</div>
                          <div className="space-y-3">
                            {detail.steps.map((step) => (
                              <div
                                key={step.order}
                                className="rounded-md bg-slate-950/60 border border-slate-800 p-2 text-xs space-y-1"
                              >
                                <div className="flex justify-between items-center">
                                  <span className="font-semibold">Шаг {step.order}</span>
                                  {step.score != null && (
                                    <span className="text-[11px] text-default-500">
                                      Балл: {step.score.toFixed(1)}
                                    </span>
                                  )}
                                </div>
                                <div>
                                  <span className="font-semibold">Клиент:</span>{' '}
                                  <span className="text-default-500">{step.customerMessage}</span>
                                </div>
                                <div>
                                  <span className="font-semibold">Менеджер:</span>{' '}
                                  <span className="text-default-500">{step.answer}</span>
                                </div>
                                {step.feedback && (
                                  <div className="text-[11px] text-default-500">
                                    Отзыв: {step.feedback}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                ) : null}
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}

function CallsTab(props: {
  loading: boolean;
  error: string | null;
  calls: CallSummary[];
  scenario: 'dialog' | 'realtime' | 'realtime_pure';
  onScenarioChange: (v: 'dialog' | 'realtime' | 'realtime_pure') => void;
  phone: string;
  onPhoneChange: (v: string) => void;
  startCallLoading: boolean;
  startCallStatus: string | null;
  onStartCall: () => void;
  selectedCallId: number | null;
  callDetail: CallDetail | null;
  callDetailLoading: boolean;
  callDetailError: string | null;
  onSelectCall: (id: number) => void;
}) {
  const {
    loading,
    error,
    calls,
    scenario,
    onScenarioChange,
    phone,
    onPhoneChange,
    startCallLoading,
    startCallStatus,
    onStartCall,
    selectedCallId,
    callDetail,
    callDetailLoading,
    callDetailError,
    onSelectCall,
  } = props;

  const [savedNumbers, setSavedNumbers] = useState<string[]>([]);
  const [savedNumbersLoading, setSavedNumbersLoading] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadSaved() {
      setSavedNumbersLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/admin/test-numbers`);
        const data = await res.json().catch(() => ({}));
        if (!cancelled && Array.isArray(data.numbers)) {
          setSavedNumbers(data.numbers as string[]);
        }
      } catch {
        // ignore errors for saved numbers
      } finally {
        if (!cancelled) {
          setSavedNumbersLoading(false);
        }
      }
    }
    loadSaved();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectCall = (id: number) => {
    onSelectCall(id);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-4">
      <Card shadow="sm" className="bg-slate-900 border border-slate-800">
        <CardBody>
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="text-xs text-default-500">Сценарий</div>
              <div className="flex gap-2">
              <Button
                size="sm"
                variant={scenario === 'dialog' ? 'solid' : 'flat'}
                color="primary"
                onPress={() => onScenarioChange('dialog')}
              >
                Наш LLM
              </Button>
              <Button
                size="sm"
                variant={scenario === 'realtime' ? 'solid' : 'flat'}
                color="primary"
                onPress={() => onScenarioChange('realtime')}
              >
                Realtime (гибрид)
              </Button>
              <Button
                size="sm"
                variant={scenario === 'realtime_pure' ? 'solid' : 'flat'}
                color="primary"
                onPress={() => onScenarioChange('realtime_pure')}
              >
                Realtime (чистый)
              </Button>
              </div>
            </div>

            <div className="space-y-1 relative">
              <Input
                label="Номер телефона"
                labelPlacement="outside"
                placeholder="+7 999 123-45-67"
                value={phone}
                onChange={(e) => onPhoneChange(e.target.value)}
                endContent={
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    onPress={() => setSavedOpen((v) => !v)}
                    disabled={savedNumbersLoading || !savedNumbers.length}
                  >
                    ▼
                  </Button>
                }
              />
              {savedOpen && (
                <div className="absolute z-20 left-0 right-0 mt-1 rounded-lg border border-slate-700 bg-slate-900 shadow-lg max-h-40 overflow-auto text-xs">
                  {savedNumbersLoading ? (
                    <div className="px-3 py-2 text-default-500">Загрузка…</div>
                  ) : savedNumbers.length ? (
                    savedNumbers.map((num) => (
                      <button
                        key={num}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-slate-800"
                        onClick={() => {
                          onPhoneChange(num);
                          setSavedOpen(false);
                        }}
                      >
                        {num}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-default-500">Нет сохранённых номеров</div>
                  )}
                </div>
              )}
            </div>
            <Button
              color="primary"
              fullWidth
              isLoading={startCallLoading}
              onPress={onStartCall}
            >
              Позвонить
            </Button>
            {startCallStatus && (
              <p className="text-[12px] text-default-500">{startCallStatus}</p>
            )}
          </div>
        </CardBody>
      </Card>

      <Spacer y={1} />

      <div>
        <h3 className="text-sm font-semibold mb-1">История звонков</h3>
        <p className="text-[11px] text-default-500 mb-2">
          По одному номеру может быть несколько карточек (история звонков).
        </p>
        {loading ? (
          <Card shadow="sm">
            <CardBody className="text-sm text-default-500">Загрузка звонков…</CardBody>
          </Card>
        ) : error ? (
          <Card shadow="sm">
            <CardBody className="text-sm text-danger-400">Ошибка: {error}</CardBody>
          </Card>
        ) : !calls.length && !isDevHost ? (
          <Card shadow="sm">
            <CardBody className="text-sm text-default-500">Нет звонков.</CardBody>
          </Card>
        ) : (
          <div className="space-y-3">
            {(calls.length ? calls : buildDemoCalls()).map((c) => {
              const inProgress = !c.endedAt;
              const score = c.totalScore;
              const scoreClass =
                score == null
                  ? 'text-default-500'
                  : score >= 76
                  ? 'text-success-400'
                  : score >= 50
                  ? 'text-warning-400'
                  : 'text-danger-400';
              const duration =
                c.durationSec != null
                  ? c.durationSec >= 60
                    ? `${Math.floor(c.durationSec / 60)} мин ${c.durationSec % 60} с`
                    : `${c.durationSec} с`
                  : '—';
              return (
                <Card
                  key={c.id}
                  isPressable
                  onPress={() => handleSelectCall(c.id)}
                  className={`bg-slate-900 border border-slate-800 w-full ${selectedCallId === c.id ? 'border-primary-500 border-2' : ''}`}
                  shadow="sm"
                >
                  <CardBody>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium">{c.to}</span>
                      {!inProgress && (
                    <span className={`text-base font-semibold ${scoreClass}`}>
                      {score != null ? `${score.toFixed(0)}/100` : 'Н/Д'}
                    </span>
                      )}
                    </div>
                    <div className="text-[11px] text-default-500 mb-1">
                      {c.startedAt ? new Date(c.startedAt).toLocaleString('ru-RU') : '—'}
                    </div>
                    <div className="text-[11px] text-default-500">
                      Исход: {c.outcome ?? (inProgress ? 'Идёт звонок…' : '—')} · Длительность: {duration}
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        isOpen={detailOpen && !!selectedCallId}
        onOpenChange={setDetailOpen}
        scrollBehavior="inside"
        placement="bottom-center"
        size="lg"
      >
        <ModalContent className="bg-transparent shadow-none">
          {(onClose) => (
            <>
              <ModalHeader className="text-sm font-semibold">Карточка звонка</ModalHeader>
              <ModalBody>
                {callDetailLoading ? (
                  <div className="rounded-2xl bg-slate-900 border border-slate-800 px-4 py-3 text-sm text-default-500">
                    Загрузка…
                  </div>
                ) : callDetailError ? (
                  <div className="rounded-2xl bg-slate-900 border border-slate-800 px-4 py-3 text-sm text-danger-400">
                    Ошибка: {callDetailError}
                  </div>
                ) : callDetail ? (
                  <div className="rounded-2xl bg-slate-900 border border-slate-800 px-4 py-3 space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="font-semibold text-sm">{callDetail.to}</div>
                        {callDetail.qualityTag && (
                          <span className="text-[11px] px-2 py-1 rounded-full bg-slate-800 text-slate-100">
                            {callDetail.qualityTag}
                          </span>
                        )}
                      </div>
                      <div className="text-2xl font-bold">
                        {callDetail.totalScore != null ? `${callDetail.totalScore.toFixed(1)}/100` : 'Н/Д'}
                      </div>
                      <div className="text-xs text-default-500 space-y-1">
                        <div>Исход: {callDetail.outcome ?? '—'}</div>
                        <div>
                          Начало:{' '}
                          {callDetail.startedAt ? new Date(callDetail.startedAt).toLocaleString('ru-RU') : '—'}
                        </div>
                        <div>
                          Конец:{' '}
                          {callDetail.endedAt ? new Date(callDetail.endedAt).toLocaleString('ru-RU') : '—'}
                        </div>
                      </div>

                      {callDetail.dimensionScores && (
                        <div>
                          <div className="text-xs font-semibold mb-1">Ключевые показатели</div>
                          <div className="space-y-2">
                            {Object.entries(callDetail.dimensionScores).map(([key, value]) => {
                              const v = typeof value === 'number' ? value : 0;
                              const norm = v <= 1 ? v * 10 : v;
                              const pct = Math.max(0, Math.min(10, norm)) * 10;
                              const color =
                                norm >= 8 ? 'bg-emerald-500' : norm >= 5 ? 'bg-amber-500' : 'bg-rose-500';
                              const label = key.replace(/_/g, ' ');
                              return (
                                <div key={key} className="space-y-1">
                                  <div className="flex justify-between text-[11px] text-default-500">
                                    <span>{label}</span>
                                    <span>{norm.toFixed(1)}/10</span>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                    <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div>
                        <div className="text-xs font-semibold mb-1">✅ Сильные стороны</div>
                        {callDetail.strengths.length ? (
                          <ul className="text-xs text-default-500 list-disc pl-4 space-y-1">
                            {callDetail.strengths.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-default-500">Нет выделенных сильных сторон.</p>
                        )}
                      </div>

                      <div>
                        <div className="text-xs font-semibold mb-1">⚠️ Слабые стороны</div>
                        {callDetail.weaknesses.length ? (
                          <ul className="text-xs text-default-500 list-disc pl-4 space-y-1">
                            {callDetail.weaknesses.map((w, i) => (
                              <li key={i}>{w}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-default-500">Слабые стороны не выделены.</p>
                        )}
                      </div>

                      <div>
                        <div className="text-xs font-semibold mb-1">💡 Рекомендации</div>
                        {callDetail.recommendations.length ? (
                          <ul className="text-xs text-default-500 list-disc pl-4 space-y-1">
                            {callDetail.recommendations.map((r, i) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-default-500">Отдельных рекомендаций нет.</p>
                        )}
                      </div>
                  </div>
                ) : null}
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}

function TeamTab(props: { loading: boolean; error: string | null; summary: TeamSummary | null; voice: VoiceDashboard | null }) {
  const { loading, error, summary, voice } = props;

  if (loading) {
    return (
      <Card shadow="sm" className="bg-slate-900 border border-slate-800">
        <CardBody className="text-sm text-default-500">Загрузка командной статистики…</CardBody>
      </Card>
    );
  }
  if (error) {
    return (
      <Card shadow="sm" className="bg-slate-900 border border-slate-800">
        <CardBody className="text-sm text-danger-400">Ошибка: {error}</CardBody>
      </Card>
    );
  }
  if (!summary) {
    return (
      <Card shadow="sm" className="bg-slate-900 border border-slate-800">
        <CardBody className="text-sm text-default-500">Пока нет достаточных данных по команде.</CardBody>
      </Card>
    );
  }

  const { totalAttempts, avgScore, levelCounts, topWeaknesses, topStrengths, expertSummary } = summary;
  const answeredPct = voice?.answeredPercent ?? 0;
  const missedPct = voice?.missedPercent ?? 0;
  const totalCalls = voice?.totalCalls ?? 0;

  return (
    <div className="space-y-3">
      {/* Executive KPI */}
      <Card shadow="sm" className="bg-slate-900 border border-slate-800">
        <CardBody>
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-xs text-default-500 mb-1">Всего оценённых диалогов</div>
              <div className="text-3xl font-bold">{totalAttempts}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-default-500 mb-1">⭐ AI‑рейтинг салона</div>
              <div className="text-3xl font-semibold">{avgScore.toFixed(1)}/100</div>
            </div>
          </div>
          {voice && (
            <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="text-[11px] text-default-500 mb-1">📞 Дозвон</div>
                <div className="text-lg font-semibold">{answeredPct}%</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-default-500 mb-1">❌ Пропущенные</div>
                <div className="text-lg font-semibold">{missedPct}%</div>
              </div>
            </div>
          )}
          {voice && (
            <div className="mt-3 text-[11px] text-default-500">
              Всего обработанных звонков: {totalCalls}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Телефония и доступность */}
      {voice && (
        <Card shadow="sm" className="bg-slate-900 border border-slate-800">
          <CardBody>
            <div className="text-xs font-semibold mb-2">Телефония и доступность</div>
            <div className="mb-3">
              <div className="flex justify-between text-[11px] text-default-500 mb-1">
                <span>Взяли / не взяли</span>
                <span>
                  {answeredPct}% / {missedPct}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${answeredPct}%` }}
                />
              </div>
            </div>

            <div className="text-[11px] text-default-500 mb-1">Исход звонков</div>
            <div className="space-y-1 text-[11px]">
              {(['completed', 'no_answer', 'busy', 'failed', 'disconnected'] as const).map((k) => {
                const labelMap: Record<string, string> = {
                  completed: 'Разговор состоялся',
                  no_answer: 'Не взяли трубку',
                  busy: 'Занято',
                  failed: 'Ошибка/сбой',
                  disconnected: 'Отключён',
                };
                const count = voice.outcomeBreakdown[k];
                const pct = voice.totalCalls > 0 ? Math.round((count / voice.totalCalls) * 100) : 0;
                if (!count) return null;
                const color =
                  k === 'completed'
                    ? 'bg-emerald-500'
                    : k === 'no_answer'
                    ? 'bg-rose-500'
                    : 'bg-amber-500';
                return (
                  <div key={k} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${color}`} />
                    <div className="flex-1 flex justify-between">
                      <span>{labelMap[k]}</span>
                      <span className="text-default-500">
                        {pct}% ({count})
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {voice.avgDurationSec > 0 && (
              <div className="mt-3 text-[11px] text-default-500">
                Средняя длительность разговора: ~{voice.avgDurationSec} с
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Уровень сотрудников */}
      <Card shadow="sm" className="bg-slate-900 border border-slate-800">
        <CardBody>
          <div className="text-xs font-semibold mb-2">Уровень сотрудников</div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-md bg-slate-950/60 border border-slate-800 p-2">
              <div className="text-[11px] text-default-500 mb-1">Junior</div>
              <div className="text-lg font-semibold">{levelCounts.Junior}</div>
            </div>
            <div className="rounded-md bg-slate-950/60 border border-slate-800 p-2">
              <div className="text-[11px] text-default-500 mb-1">Middle</div>
              <div className="text-lg font-semibold">{levelCounts.Middle}</div>
            </div>
            <div className="rounded-md bg-slate-950/60 border border-slate-800 p-2">
              <div className="text-[11px] text-default-500 mb-1">Senior</div>
              <div className="text-lg font-semibold">{levelCounts.Senior}</div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Сильные / слабые стороны команды */}
      {(topWeaknesses.length > 0 || topStrengths.length > 0) && (
        <Card shadow="sm" className="bg-slate-900 border border-slate-800">
          <CardBody className="grid grid-cols-1 gap-4">
            {topWeaknesses.length > 0 && (
              <div>
                <div className="text-xs font-semibold mb-1">Главные зоны для улучшения</div>
                <ul className="text-xs text-default-500 space-y-1 list-disc pl-4">
                  {topWeaknesses.map((w, idx) => (
                    <li key={idx}>
                      {w.weakness} <span className="text-[11px] text-default-500">({w.count})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {topStrengths.length > 0 && (
              <div>
                <div className="text-xs font-semibold mb-1">Сильные стороны команды</div>
                <ul className="text-xs text-default-500 space-y-1 list-disc pl-4">
                  {topStrengths.map((s, idx) => (
                    <li key={idx}>
                      {s.strength} <span className="text-[11px] text-default-500">({s.count})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Экспертное резюме */}
      {expertSummary && (
        <Card shadow="sm" className="bg-slate-900 border border-slate-800">
          <CardBody>
            <div className="text-xs font-semibold mb-1">Экспертное резюме</div>
            <p className="text-xs text-default-500 whitespace-pre-line">{expertSummary}</p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function ExpensesTab(props: { loading: boolean; error: string | null; info: ExpensesInfo | null }) {
  const { loading, error, info } = props;

  if (loading) {
    return (
      <Card shadow="sm" className="bg-slate-900 border border-slate-800">
        <CardBody className="text-sm text-default-500">Загрузка информации о расходах…</CardBody>
      </Card>
    );
  }
  if (error) {
    return (
      <Card shadow="sm" className="bg-slate-900 border border-slate-800">
        <CardBody className="text-sm text-danger-400">Ошибка: {error}</CardBody>
      </Card>
    );
  }
  if (!info) {
    return (
      <Card shadow="sm" className="bg-slate-900 border border-slate-800">
        <CardBody className="text-sm text-default-500">Данные о расходах пока недоступны.</CardBody>
      </Card>
    );
  }

  const { periodStart, periodEnd, totalSpentUsd, currency, billingUrl, error: apiError } = info;

  return (
    <div className="space-y-3">
      <Card shadow="sm" className="bg-slate-900 border border-slate-800">
        <CardBody>
          <div className="text-xs text-default-500 mb-1">
            Период: {new Date(periodStart).toLocaleDateString('ru-RU')} —{' '}
            {new Date(periodEnd).toLocaleDateString('ru-RU')}
          </div>
          <div className="text-3xl font-bold mb-1">
            {totalSpentUsd.toFixed(2)} {currency}
          </div>
          <div className="text-xs text-default-500">Расходы OpenAI за текущий месяц</div>
        </CardBody>
      </Card>

      {apiError && (
        <Card shadow="sm" className="bg-slate-900 border border-amber-500/60">
          <CardBody className="text-xs text-amber-300 whitespace-pre-line">
            {apiError}
          </CardBody>
        </Card>
      )}

      <Card shadow="sm" className="bg-slate-900 border border-slate-800">
        <CardBody>
          <Button
            as="a"
            href={billingUrl}
            target="_blank"
            rel="noreferrer"
            color="primary"
            fullWidth
          >
            Открыть billing OpenAI
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}

