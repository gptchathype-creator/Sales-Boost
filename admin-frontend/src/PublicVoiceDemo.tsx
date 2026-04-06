import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, CardBody, Input } from '@heroui/react';
import { CallInsightCard, type CallInsightDetail } from './CallInsightCard';

const API_BASE = '';
const CALL_ID_PARAM = 'callId';

type DemoCallState = CallInsightDetail & {
  callId: string;
  transcriptTurns: number;
  hasEvaluation: boolean;
  isProcessing: boolean;
  processingStage: 'transcript' | 'evaluation' | null;
};

function readCallIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const value = params.get(CALL_ID_PARAM);
  return value && value.trim() ? value.trim() : null;
}

function writeCallIdToUrl(callId: string | null) {
  const url = new URL(window.location.href);
  if (callId) url.searchParams.set(CALL_ID_PARAM, callId);
  else url.searchParams.delete(CALL_ID_PARAM);
  window.history.replaceState({}, '', url.toString());
}

function isCallFinal(detail: DemoCallState | null): boolean {
  if (!detail || !detail.endedAt) return false;
  if (detail.isProcessing) return false;
  return detail.hasEvaluation || !!detail.processingError || detail.transcriptTurns > 0;
}

export function PublicVoiceDemo() {
  const [phone, setPhone] = useState('');
  const [callId, setCallId] = useState<string | null>(() => readCallIdFromUrl());
  const [detail, setDetail] = useState<DemoCallState | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    writeCallIdToUrl(callId);
  }, [callId]);

  useEffect(() => {
    if (!callId || isCallFinal(detail)) return;

    let cancelled = false;

    const loadDetail = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/public/demo-call/${encodeURIComponent(callId)}`);
        const text = await response.text();
        const data = text ? JSON.parse(text) : null;
        if (!response.ok) {
          throw new Error(data?.error || 'Не удалось получить статус звонка.');
        }
        if (cancelled) return;
        setDetail(data as DemoCallState);
        setPhone((current) => current || data?.to || '');
        setError(null);

        if (!data?.endedAt) {
          setStatusMessage('Ожидаем завершения звонка...');
          return;
        }
        if (data?.isProcessing) {
          setStatusMessage(
            data.processingStage === 'evaluation'
              ? 'Звонок завершён. Формируем аналитику...'
              : 'Звонок завершён. Получаем расшифровку...'
          );
          return;
        }
        setStatusMessage(null);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Не удалось получить статус звонка.');
      }
    };

    loadDetail();
    const interval = window.setInterval(() => {
      loadDetail().catch(() => {});
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [callId, detail]);

  const screenState = useMemo<'form' | 'waiting' | 'result'>(() => {
    if (!callId) return 'form';
    return isCallFinal(detail) ? 'result' : 'waiting';
  }, [callId, detail]);

  async function handleStartCall() {
    if (!phone.trim()) {
      setError('Введите номер телефона.');
      return;
    }
    setLoading(true);
    setError(null);
    setStatusMessage('Инициируем звонок...');
    try {
      const response = await fetch(`${API_BASE}/api/public/demo-call/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: phone.trim(), scenario: 'realtime_pure' }),
      });
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      if (!response.ok) {
        throw new Error(data?.error || `Не удалось запустить звонок (${response.status}).`);
      }
      setCallId(data.callId);
      setDetail(null);
      setStatusMessage('Ожидаем завершения звонка...');
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Не удалось запустить звонок.');
      setStatusMessage(null);
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setCallId(null);
    setDetail(null);
    setStatusMessage(null);
    setError(null);
  }

  return (
    <div className="admin-app min-h-screen">
      <div className="mx-auto w-full max-w-md px-4 py-6 sm:px-6">
        <div className="mb-5">
          <div className="text-[11px] uppercase tracking-[0.22em] text-default-400 mb-2">Sales Boost Demo</div>
          <h1 className="text-[28px] leading-tight font-semibold text-default-900 m-0">
            Демо-стенд оценки звонка
          </h1>
          <p className="text-sm text-default-500 mt-2 mb-0">
            Оставьте номер телефона, примите звонок и дождитесь автоматического разбора диалога.
          </p>
        </div>

        {screenState === 'form' && (
          <Card shadow="sm" className="admin-card-light">
            <CardBody>
              <div className="space-y-4">
                <Input
                  label="Номер телефона"
                  labelPlacement="outside"
                  placeholder="+7 999 123-45-67"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <Button
                  color="primary"
                  fullWidth
                  isLoading={loading}
                  onPress={handleStartCall}
                >
                  Получить звонок
                </Button>
                {error && <div className="text-sm text-danger">{error}</div>}
              </div>
            </CardBody>
          </Card>
        )}

        {screenState === 'waiting' && (
          <div className="space-y-4">
            <Card shadow="sm" className="admin-card-light">
              <CardBody>
                <div className="space-y-4 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--good-bg)] text-[var(--primary)] text-2xl">
                    •••
                  </div>
                  <div>
                    <div className="text-xl font-semibold text-default-900">Ожидаем завершения звонка</div>
                    <div className="text-sm text-default-500 mt-2">
                      Как только разговор закончится и обработка завершится, эта страница автоматически покажет аналитику.
                    </div>
                  </div>
                  <div className="rounded-2xl admin-card-inner px-4 py-3 text-left text-sm space-y-2">
                    <div><span className="text-default-400">Номер:</span> {phone || detail?.to || '—'}</div>
                    <div><span className="text-default-400">Статус:</span> {statusMessage || 'Ожидание...'}</div>
                    {detail?.startedAt && (
                      <div>
                        <span className="text-default-400">Начало:</span>{' '}
                        {new Date(detail.startedAt).toLocaleString('ru-RU')}
                      </div>
                    )}
                  </div>
                  {error && <div className="text-sm text-danger">{error}</div>}
                </div>
              </CardBody>
            </Card>
            <Button fullWidth variant="flat" onPress={handleReset}>
              Сбросить и ввести другой номер
            </Button>
          </div>
        )}

        {screenState === 'result' && detail && (
          <div className="space-y-4">
            <Card shadow="sm" className="admin-card-light">
              <CardBody>
                <CallInsightCard detail={detail} />
              </CardBody>
            </Card>
            <Button fullWidth color="primary" onPress={handleReset}>
              Запустить новый звонок
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
