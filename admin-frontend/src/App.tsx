import React, { useEffect, useMemo, useState } from 'react';
import { useUnit } from 'effector-react';
import { LoginPage } from './auth/LoginPage';
import { $auth, authUnauthorized, bootstrapAuth, logout, type FrontendRole } from './auth/model';
import { apiFetch } from './auth/api';
import { SuperAdminLayout } from './super-admin/SuperAdminLayout';

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

const API_BASE = '';

export default function App() {
  const auth = useUnit($auth);
  const [role, setRole] = useState<FrontendRole>('super');
  const [teamSummary, setTeamSummary] = useState<TeamSummary | null>(null);
  const [teamLoading, setTeamLoading] = useState(false);
  const [voiceDashboard, setVoiceDashboard] = useState<VoiceDashboard | null>(null);

  const allowedRoles = auth.status === 'authenticated' ? auth.user.allowedRoles : [];
  const defaultRole = auth.status === 'authenticated' ? auth.user.defaultRole : 'super';
  const profileName = auth.status === 'authenticated'
    ? (auth.user.account.displayName?.trim() || auth.user.account.email)
    : '—';

  useEffect(() => {
    bootstrapAuth();
    const onUnauthorized = () => authUnauthorized();
    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, []);

  useEffect(() => {
    if (auth.status !== 'authenticated') return;
    setRole((current) => (auth.user.allowedRoles.includes(current) ? current : auth.user.defaultRole));
  }, [auth]);

  useEffect(() => {
    if (auth.status !== 'authenticated') return;
    if (role === 'super' || role === 'company') {
      loadTeamSummary();
      return;
    }
    setTeamSummary(null);
    setVoiceDashboard(null);
    setTeamLoading(false);
  }, [role, auth.status]);

  async function loadTeamSummary() {
    setTeamLoading(true);
    try {
      const safeParse = async (r: Response | null) => {
        if (!r || !r.ok) return null;
        try { const t = await r.text(); return t ? JSON.parse(t) : null; } catch { return null; }
      };
      const [summaryRes, voiceRes] = await Promise.all([
        apiFetch(`${API_BASE}/api/admin/summary`).catch(() => null),
        apiFetch(`${API_BASE}/api/admin/voice-dashboard`).catch(() => null),
      ]);
      const data = await safeParse(summaryRes);
      if (data) {
        const safe: TeamSummary = {
          totalAttempts: data.totalAttempts ?? 0,
          avgScore: data.avgScore ?? 0,
          levelCounts: data.levelCounts ?? { Junior: 0, Middle: 0, Senior: 0 },
          topWeaknesses: Array.isArray(data.topWeaknesses) ? data.topWeaknesses : [],
          topStrengths: Array.isArray(data.topStrengths) ? data.topStrengths : [],
          expertSummary: typeof data.expertSummary === 'string' ? data.expertSummary : null,
        };
        setTeamSummary(safe);
      }
      const v = await safeParse(voiceRes);
      if (v) {
        setVoiceDashboard({
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
        });
      }
    } catch {
      setTeamSummary(null);
      setVoiceDashboard(null);
    } finally {
      setTeamLoading(false);
    }
  }

  const loginRequired = useMemo(
    () => auth.status === 'guest',
    [auth.status],
  );

  if (auth.status === 'checking') {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0f172a', color: '#fff' }}>
        Проверка сессии...
      </div>
    );
  }

  if (loginRequired) {
    return <LoginPage />;
  }

  return (
    <SuperAdminLayout
      summary={teamSummary}
      voice={voiceDashboard}
      loadingSummary={teamLoading}
      role={role}
      profileName={profileName}
      onRoleChange={(nextRole) => {
        if (allowedRoles.includes(nextRole)) {
          setRole(nextRole);
        }
      }}
      onLogout={() => logout()}
      allowedRoles={allowedRoles.length ? allowedRoles : [defaultRole]}
    />
  );
}
