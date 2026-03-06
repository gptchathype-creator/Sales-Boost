/**
 * Super Admin API — uses existing endpoints + new super-admin routes.
 * No backend schema changes; mock entities for local/test.
 */

const API_BASE = '';

export interface PlatformSummary {
  totalAttempts: number;
  avgScore: number;
  levelCounts: { Junior: number; Middle: number; Senior: number };
  topWeaknesses: { weakness: string; count: number }[];
  topStrengths?: { strength: string; count: number }[];
  expertSummary?: string | null;
}

export interface PlatformVoice {
  totalCalls: number;
  answeredPercent: number;
  missedPercent: number;
  avgDurationSec: number;
  outcomeBreakdown?: {
    completed: number;
    no_answer: number;
    busy: number;
    failed: number;
    disconnected: number;
  };
}

export interface AuditItem {
  id: string;
  type: 'attempt' | 'training' | 'call';
  company: string;
  dealer: string;
  date: string;
  aiScore: number;
  status: 'Good' | 'Medium' | 'Bad';
  userName: string | null;
  detailId: number;
  detailType: 'attempt' | 'training' | 'call';
}

export interface TimeSeriesPoint {
  date: string;
  avgScore: number;
  count: number;
}

export interface MockCompany {
  id: string;
  name: string;
  autodealers: number;
  avgAiScore: number;
  answerRate: number;
  lastAudit: string;
  trend: number;
}

export interface MockDealer {
  id: string;
  name: string;
  city: string;
  avgScore: number;
  audits: number;
  bestEmployee: string;
  worstMetric: string;
}

export interface SuperAdminSettings {
  totalScripts: number;
  totalPhones: number;
  platformLanguage: string;
  telephonyProvider: string;
}

export interface CallBatchListItem {
  id: string;
  mode: 'manual' | 'single_dealership' | 'all_dealerships' | 'auto_daily';
  status: 'running' | 'paused' | 'cancelled' | 'completed';
  title: string | null;
  totalJobs: number;
  queuedJobs: number;
  inProgressJobs: number;
  completedJobs: number;
  failedJobs: number;
  retryingJobs: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface CallBatchJobItem {
  id: string;
  dealershipId: string | null;
  dealershipName: string | null;
  phone: string;
  status: 'queued' | 'dialing' | 'in_progress' | 'retry_wait' | 'completed' | 'failed' | 'cancelled';
  attempt: number;
  maxAttempts: number;
  startedAt: string | null;
  endedAt: string | null;
  lastOutcome: string | null;
  lastError: string | null;
  linkedAuditId?: string | null;
  hasTranscript?: boolean;
  linkReason?: string | null;
}

export async function fetchSummary(): Promise<PlatformSummary | null> {
  const res = await fetch(`${API_BASE}/api/admin/summary`);
  if (!res.ok) return null;
  const data = await res.json();
  return data as PlatformSummary;
}

export async function fetchVoiceDashboard(): Promise<PlatformVoice | null> {
  const res = await fetch(`${API_BASE}/api/admin/voice-dashboard`);
  if (!res.ok) return null;
  return (await res.json()) as PlatformVoice;
}

export async function fetchAudits(limit = 100): Promise<AuditItem[]> {
  const res = await fetch(`${API_BASE}/api/admin/super-admin/audits?limit=${limit}`);
  if (res.status === 404) throw new Error('BACKEND_NOT_RUNNING');
  if (!res.ok) return [];
  const data = await res.json();
  return data.audits ?? [];
}

export async function fetchTimeSeries(): Promise<TimeSeriesPoint[]> {
  const res = await fetch(`${API_BASE}/api/admin/super-admin/time-series`);
  if (res.status === 404) throw new Error('BACKEND_NOT_RUNNING');
  if (!res.ok) return [];
  const data = await res.json();
  return data.series ?? [];
}

export async function fetchMockEntities(): Promise<{ companies: MockCompany[]; dealers: MockDealer[] }> {
  const res = await fetch(`${API_BASE}/api/admin/super-admin/mock-entities`);
  if (res.status === 404) throw new Error('BACKEND_NOT_RUNNING');
  if (!res.ok) return { companies: [], dealers: [] };
  const data = await res.json();
  return { companies: data.companies ?? [], dealers: data.dealers ?? [] };
}

export async function fetchSuperAdminSettings(): Promise<SuperAdminSettings | null> {
  const res = await fetch(`${API_BASE}/api/admin/super-admin/settings`);
  if (res.status === 404) throw new Error('BACKEND_NOT_RUNNING');
  if (!res.ok) return null;
  return (await res.json()) as SuperAdminSettings;
}

export async function fetchCallBatches(limit = 60, mode: 'all' | 'manual' | 'single_dealership' | 'all_dealerships' | 'auto_daily' = 'all'): Promise<CallBatchListItem[]> {
  const res = await fetch(`${API_BASE}/api/admin/call-batches?limit=${limit}&mode=${mode}`);
  if (res.status === 404) throw new Error('BACKEND_NOT_RUNNING');
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

export async function fetchCallBatchJobs(batchId: string, limit = 300): Promise<CallBatchJobItem[]> {
  const res = await fetch(`${API_BASE}/api/admin/call-batches/${batchId}/jobs?limit=${limit}`);
  if (res.status === 404) throw new Error('BACKEND_NOT_RUNNING');
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

export async function fetchCallBatchById(batchId: string): Promise<CallBatchListItem | null> {
  const res = await fetch(`${API_BASE}/api/admin/call-batches/${batchId}`);
  if (res.status === 404) throw new Error('BACKEND_NOT_RUNNING');
  if (!res.ok) return null;
  const data = await res.json();
  return (data?.batch ?? null) as CallBatchListItem | null;
}
