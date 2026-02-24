import React, { useEffect, useState } from 'react';
import { Tabs, Tab, Card, CardBody, Button, Input, Spacer } from '@heroui/react';

type Attempt = {
  id: number;
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
};

const API_BASE = window.location.origin;

export default function App() {
  const [activeTab, setActiveTab] = useState<'employees' | 'calls' | 'team' | 'expenses'>('employees');

  // Employees state
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [attemptsError, setAttemptsError] = useState<string | null>(null);

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
            <Card shadow="sm">
              <CardBody className="text-sm text-default-500">Командная статистика будет здесь позже.</CardBody>
            </Card>
          </Tab>
          <Tab key="expenses" title="Баланс">
            <Card shadow="sm">
              <CardBody className="text-sm text-default-500">Раздел расходов/баланса будет здесь позже.</CardBody>
            </Card>
          </Tab>
        </Tabs>
      </div>
    </div>
  );
}

function EmployeesTab(props: { loading: boolean; error: string | null; attempts: Attempt[] }) {
  const { loading, error, attempts } = props;
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
      <Card shadow="sm">
        <CardBody className="text-sm text-default-500">Пока нет оценённых звонков.</CardBody>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {attempts.map((a) => {
        const score = a.totalScore;
        const scoreClass =
          score == null ? 'text-default-500' : score >= 76 ? 'text-success-400' : score >= 50 ? 'text-warning-400' : 'text-danger-400';
        const quality =
          a.qualityTag ||
          (score != null ? (score >= 76 ? 'Хорошо' : score >= 50 ? 'Средне' : 'Плохо') : null);
        return (
          <Card key={a.id} shadow="sm" className="bg-default-50">
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

  return (
    <div className="space-y-4">
      <Card shadow="sm" className="bg-default-50">
        <CardBody>
          <div className="space-y-3">
            <Input
              label="Сценарий"
              labelPlacement="outside"
              value={
                scenario === 'realtime'
                  ? 'OpenAI Realtime (гибрид)'
                  : scenario === 'realtime_pure'
                  ? 'OpenAI Realtime (чистый)'
                  : 'Наш LLM (voice_dialog)'
              }
              readOnly
            />
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
            <Input
              label="Номер телефона"
              labelPlacement="outside"
              placeholder="+7 999 123-45-67"
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
            />
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
        ) : !calls.length ? (
          <Card shadow="sm">
            <CardBody className="text-sm text-default-500">Нет звонков.</CardBody>
          </Card>
        ) : (
          <div className="space-y-3">
            {calls.map((c) => {
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
                  onPress={() => onSelectCall(c.id)}
                  className={`bg-default-50 ${selectedCallId === c.id ? 'border border-primary-500' : ''}`}
                  shadow="sm"
                >
                  <CardBody>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium">{c.to}</span>
                      {!inProgress && (
                        <span className={`text-xs font-semibold ${scoreClass}`}>
                          {score != null ? `${score.toFixed(0)}/100` : 'Н/Д'}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-default-500 mb-1">
                      {c.startedAt ? new Date(c.startedAt).toLocaleString('ru-RU') : '—'}
                    </div>
                    <div className="text-[11px] text-default-500">
                      Длительность: {duration}
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {selectedCallId && (
        <div>
          <Spacer y={2} />
          <h3 className="text-sm font-semibold mb-1">Карточка звонка</h3>
          {callDetailLoading ? (
            <Card shadow="sm">
              <CardBody className="text-sm text-default-500">Загрузка…</CardBody>
            </Card>
          ) : callDetailError ? (
            <Card shadow="sm">
              <CardBody className="text-sm text-danger-400">Ошибка: {callDetailError}</CardBody>
            </Card>
          ) : callDetail ? (
            <Card shadow="sm" className="bg-default-50">
              <CardBody className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="font-semibold text-sm">{callDetail.to}</div>
                  {callDetail.qualityTag && (
                    <span className="text-[11px] px-2 py-1 rounded-full bg-default-100 text-default-700">
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

                {!!callDetail.strengths.length && (
                  <div>
                    <div className="text-xs font-semibold mb-1">✅ Сильные стороны</div>
                    <ul className="text-xs text-default-500 list-disc pl-4 space-y-1">
                      {callDetail.strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {!!callDetail.weaknesses.length && (
                  <div>
                    <div className="text-xs font-semibold mb-1">⚠️ Слабые стороны</div>
                    <ul className="text-xs text-default-500 list-disc pl-4 space-y-1">
                      {callDetail.weaknesses.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {!!callDetail.recommendations.length && (
                  <div>
                    <div className="text-xs font-semibold mb-1">💡 Рекомендации</div>
                    <ul className="text-xs text-default-500 list-disc pl-4 space-y-1">
                      {callDetail.recommendations.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardBody>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}

