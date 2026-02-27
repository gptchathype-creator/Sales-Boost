import React, { useEffect, useMemo, useRef, useState } from 'react';
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

type AdminRole = 'super' | 'company' | 'dealer' | 'staff';

// Use relative API paths so it works both in dev (Vite proxy) and in production (same origin).
const API_BASE = '';

export default function App() {
  const [activeTab, setActiveTab] = useState<'employees' | 'calls' | 'team' | 'expenses'>('employees');
  const [role, setRole] = useState<AdminRole>('dealer');

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
            <div className="flex justify-between items-start gap-3">
              <div>
                <h1 className="text-lg font-semibold mb-1">Админ‑панель</h1>
                <p className="text-xs text-default-500">Sales Boost · Telegram Mini App</p>
              </div>
              <div className="min-w-[140px]">
                <Select
                  size="sm"
                  aria-label="Роль (только для предпросмотра)"
                  selectedKeys={[role]}
                  onSelectionChange={(keys) => {
                    const first = Array.from(keys)[0] as AdminRole | undefined;
                    if (first) setRole(first);
                  }}
                >
                  <SelectItem key="super">Суперадмин</SelectItem>
                  <SelectItem key="company">Холдинг</SelectItem>
                  <SelectItem key="dealer">Автосалон</SelectItem>
                  <SelectItem key="staff">Сотрудник</SelectItem>
                </Select>
              </div>
            </div>
          </CardBody>
        </Card>

        {role === 'dealer' && (
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
        )}

        {role === 'super' && (
          <SuperAdminView
            summary={teamSummary}
            voice={voiceDashboard}
            expenses={expenses}
            loadingSummary={teamLoading}
            loadingExpenses={expensesLoading}
          />
        )}
        {role === 'company' && (
          <CompanyAdminView summary={teamSummary} voice={voiceDashboard} loadingSummary={teamLoading} />
        )}
        {role === 'staff' && (
          <StaffView loading={attemptsLoading} error={attemptsError} attempts={attempts} />
        )}
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

const mockPlatformCompanies = [
  {
    id: 'corp-1',
    name: 'АвтоХолдинг Север',
    salons: 4,
    cities: 3,
    avgScore: 82.4,
    totalCalls: 146,
  },
  {
    id: 'corp-2',
    name: 'Drive Group',
    salons: 3,
    cities: 2,
    avgScore: 75.1,
    totalCalls: 98,
  },
  {
    id: 'corp-3',
    name: 'Premium Motors',
    salons: 2,
    cities: 1,
    avgScore: 88.9,
    totalCalls: 54,
  },
];

const mockHoldingDealers = [
  {
    id: 'dealer-1',
    name: 'Автосалон Север‑1',
    city: 'Москва',
    aiScore: 84.2,
    conversion: 12.5,
    answered: 78,
    managers: 11,
  },
  {
    id: 'dealer-2',
    name: 'Автосалон Север‑2',
    city: 'Москва',
    aiScore: 79.3,
    conversion: 9.8,
    answered: 71,
    managers: 8,
  },
  {
    id: 'dealer-3',
    name: 'Автосалон Север‑СПб',
    city: 'Санкт‑Петербург',
    aiScore: 87.6,
    conversion: 15.2,
    answered: 83,
    managers: 6,
  },
];

const mockStaffProfile = {
  name: 'Иван Петров',
  level: 'Middle',
  position: 'Менеджер по продажам',
  targetScore: 85,
};

const mockStaffFocusAreas = [
  'Работа с возражениями по цене',
  'Выявление истинной потребности клиента',
  'Финальное закрытие на визит в салон',
];

const mockStaffTrainings = [
  { id: 1, title: 'Обработка входящего лида', score: 78.5, date: '2026-02-01T10:15:00Z' },
  { id: 2, title: 'Холодный звонок', score: 82.3, date: '2026-01-28T15:40:00Z' },
  { id: 3, title: 'Презентация автомобиля', score: 74.1, date: '2026-01-20T12:05:00Z' },
];

function SuperAdminView(props: {
  summary: TeamSummary | null;
  voice: VoiceDashboard | null;
  expenses: ExpensesInfo | null;
  loadingSummary: boolean;
  loadingExpenses: boolean;
}) {
  const { summary, voice, expenses, loadingSummary, loadingExpenses } = props;

  return (
    <div className="space-y-3">
      <Card shadow="sm" className="bg-slate-900 border border-slate-800">
        <CardBody>
          <div className="text-xs text-default-500 mb-1">Роль: суперадмин (preview)</div>
          <div className="text-lg font-semibold mb-1">Дашборд платформы</div>
          {loadingSummary ? (
            <p className="text-xs text-default-500">Загрузка сводки…</p>
          ) : summary ? (
            <div className="space-y-3">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-[11px] text-default-500 mb-1">Всего оценённых диалогов</div>
                  <div className="text-3xl font-bold">{summary.totalAttempts}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-default-500 mb-1">⭐ Средний балл по платформе</div>
                  <div className="text-3xl font-semibold">{summary.avgScore.toFixed(1)}/100</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-md bg-slate-950/60 border border-slate-800 p-2">
                  <div className="text-[11px] text-default-500 mb-1">Junior</div>
                  <div className="text-lg font-semibold">{summary.levelCounts.Junior}</div>
                </div>
                <div className="rounded-md bg-slate-950/60 border border-slate-800 p-2">
                  <div className="text-[11px] text-default-500 mb-1">Middle</div>
                  <div className="text-lg font-semibold">{summary.levelCounts.Middle}</div>
                </div>
                <div className="rounded-md bg-slate-950/60 border border-slate-800 p-2">
                  <div className="text-[11px] text-default-500 mb-1">Senior</div>
                  <div className="text-lg font-semibold">{summary.levelCounts.Senior}</div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-default-500">Данных для сводки пока нет.</p>
          )}
        </CardBody>
      </Card>

      {voice && (
        <Card shadow="sm" className="bg-slate-900 border border-slate-800">
          <CardBody>
            <div className="text-xs font-semibold mb-2">Телефония по платформе</div>
            <div className="grid grid-cols-2 gap-4 text-xs mb-2">
              <div>
                <div className="text-[11px] text-default-500 mb-1">📞 Дозвон</div>
                <div className="text-lg font-semibold">{voice.answeredPercent}%</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-default-500 mb-1">❌ Пропущенные</div>
                <div className="text-lg font-semibold">{voice.missedPercent}%</div>
              </div>
            </div>
            <div className="text-[11px] text-default-500">
              Всего звонков: {voice.totalCalls}
            </div>
          </CardBody>
        </Card>
      )}

      <Card shadow="sm" className="bg-slate-900 border border-slate-800">
        <CardBody>
          <div className="text-sm font-semibold mb-2">Компании на платформе (mock)</div>
          <div className="space-y-2 text-xs">
            {mockPlatformCompanies.map((c) => (
              <div
                key={c.id}
                className="rounded-md bg-slate-950/60 border border-slate-800 p-2 flex justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold truncate">{c.name}</div>
                  <div className="text-[11px] text-default-500">
                    Салонов: {c.salons} · Городов: {c.cities}
                  </div>
                </div>
                <div className="text-right text-[11px]">
                  <div className="text-xs text-default-500">AI‑рейтинг</div>
                  <div className="text-lg font-semibold">{c.avgScore.toFixed(1)}/100</div>
                  <div className="text-[11px] text-default-500">Звонков: {c.totalCalls}</div>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {!loadingExpenses && expenses && (
        <Card shadow="sm" className="bg-slate-900 border border-slate-800">
          <CardBody>
            <div className="text-xs font-semibold mb-1">Расходы OpenAI</div>
            <div className="text-2xl font-bold mb-1">
              {expenses.totalSpentUsd.toFixed(2)} {expenses.currency}
            </div>
            <div className="text-[11px] text-default-500">
              Период: {new Date(expenses.periodStart).toLocaleDateString('ru-RU')} —{' '}
              {new Date(expenses.periodEnd).toLocaleDateString('ru-RU')}
            </div>
          </CardBody>
        </Card>
      )}

      <Card shadow="sm" className="bg-slate-900 border border-slate-800">
        <CardBody>
          <div className="text-sm font-semibold mb-1">Компании</div>
          <p className="text-xs text-default-500">
            Список холдингов с их автосалонами, базовыми метриками и настройками. Сейчас показаны
            мок‑данные для предпросмотра, в проде сюда подтянем реальные компании.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function CompanyAdminView(props: { summary: TeamSummary | null; voice: VoiceDashboard | null; loadingSummary: boolean }) {
  const { summary, voice, loadingSummary } = props;

  return (
    <div className="space-y-3">
      <Card shadow="sm" className="bg-slate-900 border border-slate-800">
        <CardBody>
          <div className="text-xs text-default-500 mb-1">Роль: холдинг (preview)</div>
          <div className="text-lg font-semibold mb-1">Дашборд компании</div>
          {loadingSummary ? (
            <p className="text-xs text-default-500">Загрузка сводки…</p>
          ) : summary ? (
            <>
              <div className="flex items-end justify-between gap-4 mb-3">
                <div>
                  <div className="text-[11px] text-default-500 mb-1">Всего оценённых диалогов</div>
                  <div className="text-3xl font-bold">{summary.totalAttempts}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-default-500 mb-1">⭐ Средний балл по компании</div>
                  <div className="text-3xl font-semibold">{summary.avgScore.toFixed(1)}/100</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-md bg-slate-950/60 border border-slate-800 p-2">
                  <div className="text-[11px] text-default-500 mb-1">Junior</div>
                  <div className="text-lg font-semibold">{summary.levelCounts.Junior}</div>
                </div>
                <div className="rounded-md bg-slate-950/60 border border-slate-800 p-2">
                  <div className="text-[11px] text-default-500 mb-1">Middle</div>
                  <div className="text-lg font-semibold">{summary.levelCounts.Middle}</div>
                </div>
                <div className="rounded-md bg-slate-950/60 border border-slate-800 p-2">
                  <div className="text-[11px] text-default-500 mb-1">Senior</div>
                  <div className="text-lg font-semibold">{summary.levelCounts.Senior}</div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-default-500">Данных для дашборда пока нет.</p>
          )}
        </CardBody>
      </Card>
      <Card shadow="sm" className="bg-slate-900 border border-slate-800">
        <CardBody>
          <div className="text-sm font-semibold mb-1">Автосалоны холдинга</div>
          <p className="text-xs text-default-500 mb-2">
            Мок‑данные по автосалонам холдинга. В проде сюда придут реальные KPI по каждому салону.
          </p>
          <div className="space-y-2 text-xs">
            {mockHoldingDealers.map((d) => (
              <div
                key={d.id}
                className="rounded-md bg-slate-950/60 border border-slate-800 p-2 flex justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold truncate">{d.name}</div>
                  <div className="text-[11px] text-default-500">
                    Город: {d.city} · Менеджеров: {d.managers}
                  </div>
                </div>
                <div className="text-right text-[11px]">
                  <div className="text-xs text-default-500">AI‑рейтинг</div>
                  <div className="text-lg font-semibold">{d.aiScore.toFixed(1)}/100</div>
                  <div className="text-[11px] text-default-500">
                    Конверсия: {d.conversion}% · Дозвон: {d.answered}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
      {voice && (
        <Card shadow="sm" className="bg-slate-900 border border-slate-800">
          <CardBody>
            <div className="text-xs font-semibold mb-1">Телефония компании (preview)</div>
            <div className="text-[11px] text-default-500">
              Дозвон: {voice.answeredPercent}% · Пропущенные: {voice.missedPercent}% · Звонков:{' '}
              {voice.totalCalls}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

const STAFF_WEB_HISTORY_STORAGE_KEY = 'staff_web_test_history_v1';

function StaffView(props: { loading: boolean; error: string | null; attempts: Attempt[] }) {
  const { loading, error } = props;
  const [mode, setMode] = useState<'home' | 'test'>('home');
  const [webHistory, setWebHistory] = useState<WebTestHistoryItem[]>([]);
  const [selectedWebItem, setSelectedWebItem] = useState<WebTestHistoryItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STAFF_WEB_HISTORY_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const normalized = parsed
        .filter((x) => x && typeof x === 'object')
        .map((x: any) => ({
          id: String(x.id ?? ''),
          sessionId: typeof x.sessionId === 'string' || x.sessionId === null ? x.sessionId : null,
          createdAt: typeof x.createdAt === 'string' ? x.createdAt : new Date().toISOString(),
          status: x.status === 'completed' ? 'completed' : 'unfinished',
          turns: Number.isFinite(x.turns) ? Number(x.turns) : 0,
          result: x.result && typeof x.result === 'object'
            ? {
                verdict: x.result.verdict === 'pass' ? 'pass' : 'fail',
                totalScore: Number.isFinite(x.result.totalScore) ? Number(x.result.totalScore) : 0,
                qualityTag: typeof x.result.qualityTag === 'string' ? x.result.qualityTag : 'Нужно улучшить',
                summary: typeof x.result.summary === 'string' ? x.result.summary : '',
                strengths: Array.isArray(x.result.strengths) ? x.result.strengths.map(String) : [],
                weaknesses: Array.isArray(x.result.weaknesses) ? x.result.weaknesses.map(String) : [],
                recommendations: Array.isArray(x.result.recommendations) ? x.result.recommendations.map(String) : [],
                reasonCode: typeof x.result.reasonCode === 'string' || x.result.reasonCode === null ? x.result.reasonCode : null,
              }
            : null,
        }))
        .filter((x) => x.id)
        .slice(0, 30);
      setWebHistory(normalized);
    } catch {
      // ignore malformed local history
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STAFF_WEB_HISTORY_STORAGE_KEY, JSON.stringify(webHistory.slice(0, 30)));
    } catch {
      // ignore storage/private mode failures
    }
  }, [webHistory]);

  function openWebHistoryItem(item: WebTestHistoryItem) {
    setSelectedWebItem(item);
    setDetailOpen(true);
  }

  if (mode === 'test') {
    return (
      <StaffTestScreen
        onBack={() => setMode('home')}
        onSessionClosed={(item) => {
          setWebHistory((prev) => [item, ...prev].slice(0, 30));
          setMode('home');
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      <Card shadow="sm" className="bg-slate-900 border border-slate-800">
        <CardBody>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-lg font-semibold">Личный кабинет</div>
              <div className="text-[11px] text-default-500">
                {mockStaffProfile.name} · {mockStaffProfile.position}
              </div>
            </div>
            <div className="text-right text-[11px]">
              <div className="text-default-500 mb-1">Цель AI‑оценки</div>
              <div className="text-lg font-semibold">{mockStaffProfile.targetScore}/100</div>
            </div>
          </div>

          {loading ? (
            <p className="text-xs text-default-500">Загрузка профиля…</p>
          ) : error ? (
            <p className="text-xs text-danger-400">Ошибка: {error}</p>
          ) : (
            <div className="text-xs text-default-500">
              Личная история тестов доступна в блоке ниже.
            </div>
          )}

        </CardBody>
      </Card>

      <Card shadow="sm" className="bg-slate-900 border border-slate-800">
        <CardBody className="space-y-3">
          <div className="text-sm font-semibold">История тестов</div>
          <Button size="lg" color="primary" fullWidth className="h-12 font-semibold" onPress={() => setMode('test')}>
            Пройти тестирование
          </Button>

          {loading ? (
            <p className="text-xs text-default-500">Загрузка истории…</p>
          ) : error ? (
            <p className="text-xs text-danger-400">Ошибка: {error}</p>
          ) : webHistory.length === 0 ? (
            <p className="text-xs text-default-500">После прохождения тестов здесь появятся карточки с результатами.</p>
          ) : (
            <div className="space-y-2">
              {webHistory.map((item) => (
                <Card
                  key={item.id}
                  isPressable
                  onPress={() => openWebHistoryItem(item)}
                  shadow="sm"
                  className="bg-slate-900 border border-slate-800 w-full"
                >
                  <CardBody>
                    <div className="flex justify-between items-center mb-1">
                      <div className="font-semibold text-sm">Web‑тест (локально)</div>
                      <span
                        className={`text-[11px] px-2 py-1 rounded-full ${
                          item.status === 'unfinished'
                            ? 'bg-amber-500/20 text-amber-300'
                            : item.result?.verdict === 'pass'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {item.status === 'unfinished'
                          ? 'Не завершён'
                          : item.result?.verdict === 'pass'
                          ? 'Пройден'
                          : 'Не пройден'}
                      </span>
                    </div>
                    <div className="text-lg font-semibold text-default-300">
                      {item.result?.totalScore != null ? `${item.result.totalScore}/100` : 'Н/Д'}
                    </div>
                    <div className="text-[11px] text-default-500 mt-1">
                      {new Date(item.createdAt).toLocaleString('ru-RU')} · Сообщений: {item.turns}
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Modal
        isOpen={detailOpen && !!selectedWebItem}
        onOpenChange={setDetailOpen}
        scrollBehavior="inside"
        placement="bottom-center"
        size="lg"
      >
        <ModalContent className="bg-transparent shadow-none">
          {() => (
            <>
              <ModalHeader className="text-sm font-semibold">Карточка web‑теста</ModalHeader>
              <ModalBody>
                {selectedWebItem ? (
                  <div className="rounded-2xl bg-slate-900 border border-slate-800 px-4 py-3 space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <div className="font-semibold">Web‑тест (локальная сессия)</div>
                      <span
                        className={`text-[11px] px-2 py-1 rounded-full ${
                          selectedWebItem.status === 'unfinished'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-emerald-500/20 text-emerald-300'
                        }`}
                      >
                        {selectedWebItem.status === 'unfinished' ? 'Не завершён' : 'Завершён'}
                      </span>
                    </div>
                    <div className="text-xs text-default-500 space-y-1">
                      <div>Дата: {new Date(selectedWebItem.createdAt).toLocaleString('ru-RU')}</div>
                      <div>Сообщений: {selectedWebItem.turns}</div>
                      <div>Session ID: {selectedWebItem.sessionId || '—'}</div>
                    </div>
                    {selectedWebItem.result && (
                      <div className="space-y-3 pt-2 border-t border-slate-800">
                        <div className="text-xl font-semibold">
                          {selectedWebItem.result.totalScore}/100
                        </div>
                        <div className="text-xs text-default-400">{selectedWebItem.result.summary}</div>
                        {!!selectedWebItem.result.recommendations.length && (
                          <div>
                            <div className="text-xs font-semibold mb-1">💡 Рекомендации</div>
                            <ul className="text-xs text-default-500 list-disc pl-4 space-y-1">
                              {selectedWebItem.result.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                            </ul>
                          </div>
                        )}
                        {!!selectedWebItem.result.strengths.length && (
                          <div>
                            <div className="text-xs font-semibold mb-1">✅ Сильные стороны</div>
                            <ul className="text-xs text-default-500 list-disc pl-4 space-y-1">
                              {selectedWebItem.result.strengths.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                          </div>
                        )}
                        {!!selectedWebItem.result.weaknesses.length && (
                          <div>
                            <div className="text-xs font-semibold mb-1">⚠️ Зоны роста</div>
                            <ul className="text-xs text-default-500 list-disc pl-4 space-y-1">
                              {selectedWebItem.result.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
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

type TrainingMessage = {
  id: number;
  role: 'client' | 'manager';
  audioUrl: string | null;
  textFallback?: string;
  durationSec?: number;
  autoPlay?: boolean;
};

type WebTestResult = {
  verdict: 'pass' | 'fail';
  totalScore: number;
  qualityTag: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  reasonCode: string | null;
};

type WebTestHistoryItem = {
  id: string;
  sessionId: string | null;
  createdAt: string;
  status: 'unfinished' | 'completed';
  turns: number;
  result?: WebTestResult | null;
};

function StaffTestScreen(props: { onBack: () => void; onSessionClosed?: (item: WebTestHistoryItem) => void }) {
  const { onBack, onSessionClosed } = props;
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TrainingMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const [recording, setRecording] = useState(false);
  const [inputLevel, setInputLevel] = useState(0);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [finalResult, setFinalResult] = useState<WebTestResult | null>(null);
  const [mustListenClientMessageId, setMustListenClientMessageId] = useState<number | null>(null);
  const [heardClientMessageIds, setHeardClientMessageIds] = useState<number[]>([]);
  const [stopPlaybackSignal, setStopPlaybackSignal] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recordStartedAtRef = useRef<number>(0);
  const shouldSendRecordingRef = useRef(true);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const startTraining = async () => {
    setSending(true);
    setError(null);
    setFinalResult(null);
    setMessages([{ id: 1, role: 'client', audioUrl: null, textFallback: '...' }]);
    try {
      const res = await fetch(`${API_BASE}/api/training/web/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strictness: 'medium', profile: 'normal', replyMode: 'text+voice', voice: 'male' }),
      });
      const data = await parseApiJson(res);
      if (!res.ok) {
        throw new Error(data.error || `Ошибка ${res.status}`);
      }
      setSessionId(data.sessionId);
      setMessages([{
        id: 1,
        role: 'client',
        audioUrl: data.audioBase64 ? `data:audio/ogg;base64,${data.audioBase64}` : null,
        textFallback: data.clientMessage || 'Клиент подключён.',
        autoPlay: Boolean(data.audioBase64),
      }]);
      setMustListenClientMessageId(data.audioBase64 ? 1 : null);
      setStarted(true);
      setEnded(data.endConversation ?? false);
      if (data.result && data.endConversation) {
        setFinalResult(data.result as WebTestResult);
      }
    } catch (e: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === 1 ? { ...m, textFallback: 'Не удалось запустить тест. Попробуйте ещё раз.' } : m,
        ),
      );
      setError(e?.message || 'Не удалось запустить тренировку');
    } finally {
      setSending(false);
    }
  };

  // Автоматически запускаем тест при открытии экрана
  useEffect(() => {
    startTraining();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result !== 'string') return reject(new Error('Не удалось прочитать аудио'));
        const base64 = result.split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Ошибка чтения аудио'));
      reader.readAsDataURL(blob);
    });

  const parseApiJson = async (res: Response) => {
    const raw = await res.text();
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error(
        res.status === 503
          ? 'Сервер временно недоступен (HTTP 503). Повторите отправку через несколько секунд.'
          : `Сервер вернул не JSON (HTTP ${res.status}). Проверьте, что backend запущен и /api проксируется на него.`,
      );
    }
  };

  const sendVoiceBlob = async (blob: Blob, durationSec: number) => {
    if (!sessionId || ended) return;
    const managerAudioUrl = URL.createObjectURL(blob);
    const idBase = messages.length ? messages[messages.length - 1].id + 1 : 1;
    setMessages((prev) => [
      ...prev,
      { id: idBase, role: 'manager', audioUrl: managerAudioUrl, durationSec },
      { id: idBase + 1, role: 'client', audioUrl: null, textFallback: '...' },
    ]);
    setSending(true);
    setError(null);
    try {
      const audioBase64 = await blobToBase64(blob);
      let res: Response | null = null;
      for (let i = 0; i < 2; i += 1) {
        res = await fetch(`${API_BASE}/api/training/web/voice-message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            audioBase64,
            mimeType: blob.type || 'audio/webm',
            replyMode: 'text+voice',
            voice: 'male',
          }),
        });
        if (res.status !== 503) break;
        await new Promise((resolve) => setTimeout(resolve, 450));
      }
      if (!res) {
        throw new Error('Сервер недоступен');
      }
      const data = await parseApiJson(res);
      if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
      setMessages((prev) => {
        const copy = [...prev];
        const lastIdx = copy.findIndex((m) => m.id === idBase + 1);
        if (lastIdx >= 0) {
          copy[lastIdx] = {
            id: idBase + 1,
            role: 'client',
            audioUrl: data.audioBase64 ? `data:audio/ogg;base64,${data.audioBase64}` : null,
            textFallback: data.clientMessage || 'Ответ получен',
            autoPlay: Boolean(data.audioBase64),
          };
        }
        return copy;
      });
      setMustListenClientMessageId(data.audioBase64 ? idBase + 1 : null);
      setEnded(data.endConversation ?? false);
      if (data.result && data.endConversation) {
        setFinalResult(data.result as WebTestResult);
      }
    } catch (e: any) {
      setMessages((prev) => {
        const copy = [...prev];
        const lastIdx = copy.findIndex((m) => m.id === idBase + 1);
        if (lastIdx >= 0) {
          copy[lastIdx] = {
            id: idBase + 1,
            role: 'client',
            audioUrl: null,
            textFallback: 'Сервер временно недоступен. Повторите голосовое сообщение.',
          };
        }
        return copy;
      });
      setError(e?.message || 'Сервер временно недоступен');
    } finally {
      setSending(false);
    }
  };

  const toggleRecording = async () => {
    if (recording) {
      shouldSendRecordingRef.current = true;
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }
    if (
      mustListenClientMessageId &&
      !heardClientMessageIds.includes(mustListenClientMessageId)
    ) {
      setError('Сначала полностью прослушайте последнее сообщение клиента');
      return;
    }
    if (!sessionId || sending || ended) return;
    try {
      // Stop any current playback when manager starts recording
      setStopPlaybackSignal((prev) => prev + 1);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      mediaRecorderRef.current = recorder;
      recordStartedAtRef.current = Date.now();
      shouldSendRecordingRef.current = true;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.85;
      analyserRef.current = analyser;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) sum += data[i];
        const avg = sum / data.length;
        setInputLevel(Math.min(1, avg / 120));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        try {
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
          setInputLevel(0);
          if (shouldSendRecordingRef.current) {
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
            const durationSec = Math.max(1, Math.round((Date.now() - recordStartedAtRef.current) / 1000));
            await sendVoiceBlob(blob, durationSec);
          }
        } finally {
          stream.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          if (audioCtxRef.current) {
            audioCtxRef.current.close().catch(() => {});
            audioCtxRef.current = null;
          }
        }
      };
      recorder.start();
      setRecording(true);
    } catch (e: any) {
      setError(e?.message || 'Не удалось включить микрофон');
    }
  };

  const cancelRecording = () => {
    if (!recording) return;
    shouldSendRecordingRef.current = false;
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const handleBackPress = () => {
    const hasProgress = started && messages.length > 0;
    const unfinished = hasProgress && !ended;
    if (unfinished) {
      setExitConfirmOpen(true);
      return;
    }
    closeSessionAndExit(false);
  };

  const closeSessionAndExit = (forceUnfinished: boolean) => {
    const hasProgress = started && messages.length > 0;
    if (hasProgress) {
      const item: WebTestHistoryItem = {
        id: `web_hist_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        sessionId,
        createdAt: new Date().toISOString(),
        status: forceUnfinished ? 'unfinished' : ended ? 'completed' : 'unfinished',
        turns: messages.length,
        result: forceUnfinished ? null : finalResult,
      };
      if (onSessionClosed) onSessionClosed(item);
      else onBack();
      return;
    }

    onBack();
  };

  const requiresListening =
    Boolean(mustListenClientMessageId) &&
    !heardClientMessageIds.includes(mustListenClientMessageId as number);

  if (ended && finalResult) {
    return (
      <div className="fixed inset-0 z-50 bg-background text-foreground flex flex-col">
        <div className="px-3 md:px-6 py-3 border-b border-slate-800/80 flex items-center justify-between gap-2">
          <Button size="sm" variant="light" onPress={() => closeSessionAndExit(false)}>
            ← Назад
          </Button>
          <div className="text-sm md:text-base font-semibold">Тестирование завершено</div>
          <div className="w-16" />
        </div>
        <div className="flex-1 overflow-y-auto px-3 md:px-6 py-4">
          <div className="max-w-2xl mx-auto">
            <Card shadow="sm" className="bg-slate-900 border border-slate-800">
              <CardBody className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="text-sm text-default-500">Итоги диалога</div>
                  <span
                    className={`text-[11px] px-2 py-1 rounded-full ${
                      finalResult.verdict === 'pass'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {finalResult.verdict === 'pass' ? 'Пройдено' : 'Не пройдено'}
                  </span>
                </div>
                <div className="text-3xl font-bold">{finalResult.totalScore}/100</div>
                <div className="text-sm text-default-400">{finalResult.summary}</div>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs font-semibold mb-1">✅ Сильные стороны</div>
                    {finalResult.strengths.length ? (
                      <ul className="text-xs text-default-500 list-disc pl-4 space-y-1">
                        {finalResult.strengths.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    ) : (
                      <div className="text-xs text-default-500">—</div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-semibold mb-1">⚠️ Зоны роста</div>
                    {finalResult.weaknesses.length ? (
                      <ul className="text-xs text-default-500 list-disc pl-4 space-y-1">
                        {finalResult.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    ) : (
                      <div className="text-xs text-default-500">—</div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-semibold mb-1">💡 Рекомендации</div>
                    {finalResult.recommendations.length ? (
                      <ul className="text-xs text-default-500 list-disc pl-4 space-y-1">
                        {finalResult.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    ) : (
                      <div className="text-xs text-default-500">—</div>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background text-foreground flex flex-col">
      <div className="px-3 md:px-6 py-3 border-b border-slate-800/80 flex items-center justify-between gap-2">
        <Button size="sm" variant="light" onPress={handleBackPress}>
          ← Назад
        </Button>
        <div className="text-sm md:text-base font-semibold">Тест с виртуальным клиентом</div>
        <div className="text-[11px] text-default-500 whitespace-nowrap">
          {ended ? 'Диалог завершён' : started ? 'Тренировка идёт' : 'Запуск...'}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 md:px-4 py-3 text-xs">
        <div className="w-full max-w-3xl mx-auto space-y-2">
          {messages.length === 0 && (
            <div className="text-[11px] text-default-500">
              Ожидаем первое сообщение от клиента…
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === 'manager' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[86%] rounded-2xl px-3 py-2 ${
                  m.role === 'manager'
                    ? 'bg-primary-600 text-white rounded-br-sm'
                    : 'bg-slate-700/65 border border-slate-500/20 text-slate-50 rounded-bl-sm'
                }`}
              >
                {m.audioUrl ? (
                  <VoiceBubble
                    messageId={m.id}
                    audioUrl={m.audioUrl}
                    side={m.role}
                    durationSec={m.durationSec}
                    autoPlay={Boolean(m.autoPlay)}
                    stopPlaybackSignal={stopPlaybackSignal}
                    mustFinishBeforeRecord={m.role === 'client' && mustListenClientMessageId === m.id}
                    onFirstFullListen={(messageId) => {
                      setHeardClientMessageIds((prev) =>
                        prev.includes(messageId) ? prev : [...prev, messageId],
                      );
                      setMustListenClientMessageId((prev) => (prev === messageId ? null : prev));
                    }}
                  />
                ) : m.role === 'client' && m.textFallback === '...' ? (
                  <ClientThinkingBubble />
                ) : (
                  <div className="text-[11px] opacity-80">{m.textFallback || 'Голос недоступен'}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-slate-800/80 bg-slate-950/95 backdrop-blur px-3 md:px-6 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        <div className="flex justify-center items-center min-h-[84px]">
          <div className="relative">
            {recording && (
              <Button
                size="sm"
                variant="flat"
                color="danger"
                onPress={cancelRecording}
                className="absolute right-full mr-4 top-1/2 -translate-y-1/2"
              >
                Отменить
              </Button>
            )}
            {recording && (
              <>
                <div
                  className="absolute inset-0 rounded-full bg-danger-400/25"
                  style={{ transform: `scale(${1.2 + inputLevel * 0.7})`, filter: 'blur(2px)' }}
                />
                <div
                  className="absolute inset-0 rounded-full bg-danger-300/20"
                  style={{ transform: `scale(${1.45 + inputLevel * 0.95})`, filter: 'blur(4px)' }}
                />
              </>
            )}
            <Button
              isIconOnly
              size="lg"
              radius="full"
              color={recording ? 'danger' : 'primary'}
              variant="solid"
              isDisabled={!sessionId || sending || ended || requiresListening}
              onPress={toggleRecording}
              className="w-16 h-16 md:w-20 md:h-20 relative z-10"
            >
              {recording ? (
                <span className="text-lg leading-none">■</span>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="w-7 h-7 md:w-8 md:h-8 fill-current"
                >
                  <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 1 0 6 0V6a3 3 0 0 0-3-3z" />
                  <path d="M18 11a1 1 0 1 0-2 0 4 4 0 1 1-8 0 1 1 0 1 0-2 0 6 6 0 0 0 5 5.91V20H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-3.09A6 6 0 0 0 18 11z" />
                </svg>
              )}
            </Button>
          </div>
        </div>

        {error && <div className="text-[11px] text-danger-400 text-center">{error}</div>}
        {recording && <div className="text-[11px] text-warning-400 text-center">Идёт запись… нажмите кнопку ещё раз, чтобы отправить</div>}
        {!recording && requiresListening && (
          <div className="text-[11px] text-default-500 text-center">
            Сначала дослушайте голосовое клиента до конца, затем запись разблокируется.
          </div>
        )}
        {ended && (
          <div className="text-[11px] text-success-400 text-center">
            Диалог завершён. Вы можете запустить новый тест.
          </div>
        )}
      </div>

      <Modal isOpen={exitConfirmOpen} onOpenChange={setExitConfirmOpen} placement="center" size="sm">
        <ModalContent className="bg-slate-900 border border-slate-800">
          {() => (
            <>
              <ModalHeader className="text-sm font-semibold">Незавершённый тест</ModalHeader>
              <ModalBody>
                <div className="text-xs text-default-500">
                  Тест ещё не завершён. Если выйти сейчас, он сохранится в истории как незавершённый.
                </div>
                <div className="flex justify-end gap-2 pt-2 pb-1">
                  <Button size="sm" variant="flat" onPress={() => setExitConfirmOpen(false)}>
                    Остаться
                  </Button>
                  <Button
                    size="sm"
                    color="warning"
                    onPress={() => {
                      setExitConfirmOpen(false);
                      closeSessionAndExit(true);
                    }}
                  >
                    Выйти
                  </Button>
                </div>
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}

function VoiceBubble(props: {
  messageId: number;
  audioUrl: string;
  side: 'client' | 'manager';
  durationSec?: number;
  autoPlay?: boolean;
  stopPlaybackSignal?: number;
  mustFinishBeforeRecord?: boolean;
  onFirstFullListen?: (messageId: number) => void;
}) {
  const {
    messageId,
    audioUrl,
    side,
    durationSec,
    autoPlay = false,
    stopPlaybackSignal = 0,
    mustFinishBeforeRecord = false,
    onFirstFullListen,
  } = props;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const firstFullListenDoneRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [detectedDuration, setDetectedDuration] = useState(0);

  const bars = useMemo(() => {
    let seed = 0;
    for (let i = 0; i < audioUrl.length; i += 1) {
      seed = (seed * 31 + audioUrl.charCodeAt(i)) >>> 0;
    }
    const out: number[] = [];
    for (let i = 0; i < 52; i += 1) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const h = 0.25 + ((seed % 100) / 100) * 0.75;
      out.push(h);
    }
    return out;
  }, [audioUrl]);

  const displayDuration = durationSec || detectedDuration || 0;

  const formatDuration = (sec: number) => {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      return;
    }
    try {
      if (audio.duration && audio.currentTime >= audio.duration - 0.05) {
        audio.currentTime = 0;
        setProgress(0);
      }
      await audio.play();
    } catch {
      // ignore autoplay/user gesture errors
    }
  };

  useEffect(() => {
    if (!autoPlay) return;
    const audio = audioRef.current;
    if (!audio) return;
    let cancelled = false;
    let attempts = 0;
    const attemptPlay = () => {
      if (cancelled) return;
      attempts += 1;
      audio.play().catch(() => {
        if (attempts < 4) {
          setTimeout(attemptPlay, 250);
        }
      });
    };
    setProgress(0);
    audio.currentTime = 0;
    attemptPlay();
    return () => {
      cancelled = true;
    };
  }, [audioUrl, autoPlay]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
  }, [stopPlaybackSignal]);

  return (
    <div className="flex items-center gap-2 min-w-[220px]">
      <audio
        ref={audioRef}
        src={audioUrl}
        autoPlay={autoPlay}
        playsInline
        preload="metadata"
        onLoadedMetadata={() => {
          const d = audioRef.current?.duration || 0;
          if (Number.isFinite(d)) setDetectedDuration(Math.round(d));
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(1);
          if (mustFinishBeforeRecord && !firstFullListenDoneRef.current) {
            firstFullListenDoneRef.current = true;
            onFirstFullListen?.(messageId);
          }
        }}
        onTimeUpdate={() => {
          const audio = audioRef.current;
          if (!audio || !audio.duration) return;
          setProgress(audio.currentTime / audio.duration);
        }}
      />
      <button
        type="button"
        onClick={togglePlay}
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          side === 'manager' ? 'bg-white/25 text-white' : 'bg-slate-600/55 text-slate-50'
        }`}
      >
        {playing ? '❚❚' : '▶'}
      </button>
      <div className="flex-1 flex items-end gap-[1px] h-5">
        {bars.map((h, idx) => {
          const played = idx / bars.length < progress;
          return (
            <div
              key={idx}
              className={`w-[2px] rounded-full ${
                played
                  ? side === 'manager'
                    ? 'bg-white'
                    : 'bg-sky-200'
                  : side === 'manager'
                  ? 'bg-white/35'
                  : 'bg-slate-400/35'
              } ${playing ? 'transition-all duration-150' : ''}`}
              style={{ height: `${8 + h * 10}px` }}
            />
          );
        })}
      </div>
      <div
        className={`text-[12px] min-w-[42px] text-right font-medium ${
          side === 'manager' ? 'text-white/95' : 'text-slate-100'
        }`}
      >
        {formatDuration(displayDuration)}
      </div>
    </div>
  );
}

function ClientThinkingBubble() {
  return (
    <div className="min-w-[220px] text-slate-100/90">
      <div className="text-[11px] mb-1">Клиент записывает голосовое…</div>
      <div className="flex items-end gap-[2px] h-4">
        {Array.from({ length: 20 }).map((_, idx) => (
          <span
            key={idx}
            className="w-[2px] rounded-full bg-sky-200/70 animate-pulse"
            style={{
              height: `${6 + ((idx * 7) % 8)}px`,
              animationDelay: `${idx * 70}ms`,
              animationDuration: '900ms',
            }}
          />
        ))}
      </div>
    </div>
  );
}

