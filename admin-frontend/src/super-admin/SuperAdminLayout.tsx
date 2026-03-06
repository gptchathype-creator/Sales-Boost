import React, { useState, useEffect } from 'react';
import './super-admin-theme.css';
import { SuperAdminSidebar, SIDEBAR_WIDTH, getDefaultTab } from './SuperAdminSidebar';
import type { SuperAdminTab, AdminRole } from './SuperAdminSidebar';
import { Dashboard } from './pages/Dashboard';
import { Companies } from './pages/Companies';
import { DealershipDetail } from './pages/DealershipDetail';
import { Autodealers } from './pages/Autodealers';
import { EmployeeDetail } from './pages/EmployeeDetail';
import { Audits } from './pages/Audits';
import { AuditDetail } from './pages/AuditDetail';
import { AuditBatchDetail } from './pages/AuditBatchDetail';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';
import { DealerContent } from '../DealerViews';
import type { DealerTab } from '../DealerViews';
import { StaffProfileContent, StaffTrainerContent } from '../StaffViews';
import type { PlatformSummary, PlatformVoice } from './types';
import { getMockDealershipDetail } from './mockData';
import { CallBatchTray } from './CallBatchTray';
import {
  fetchAudits,
  fetchCallBatches,
  fetchTimeSeries,
  fetchMockEntities,
  fetchSuperAdminSettings,
  type AuditItem,
  type CallBatchListItem,
  type TimeSeriesPoint,
  type MockCompany,
  type MockDealer,
  type SuperAdminSettings,
} from './api';

export type SuperAdminLayoutProps = {
  summary: PlatformSummary | null;
  voice: PlatformVoice | null;
  loadingSummary: boolean;
  role: AdminRole;
  onRoleChange: (role: AdminRole) => void;
};

export function SuperAdminLayout({ summary, voice, loadingSummary, role, onRoleChange }: SuperAdminLayoutProps) {
  const [activeTab, setActiveTab] = useState<SuperAdminTab>(() => getDefaultTab(role));
  const [selectedDealershipId, setSelectedDealershipId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);
  const [selectedBatchDetailId, setSelectedBatchDetailId] = useState<string | null>(null);
  const [focusedBatchId, setFocusedBatchId] = useState<string | null>(null);
  const [auditsInitialScope, setAuditsInitialScope] = useState<'employees' | 'dealerships'>('employees');
  const [employeeSourceDealership, setEmployeeSourceDealership] = useState<{ id: string; name: string } | null>(null);

  const handleTabChange = (tab: SuperAdminTab) => {
    setActiveTab(tab);
    setSelectedDealershipId(null);
    setSelectedEmployeeId(null);
    setSelectedAuditId(null);
    setSelectedBatchDetailId(null);
    setFocusedBatchId(null);
    setAuditsInitialScope('employees');
    setEmployeeSourceDealership(null);
  };

  const handleRoleChange = (newRole: AdminRole) => {
    onRoleChange(newRole);
  };

  const [audits, setAudits] = useState<AuditItem[]>([]);
  const [auditsLoading, setAuditsLoading] = useState(true);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([]);
  const [callBatches, setCallBatches] = useState<CallBatchListItem[]>([]);
  const [companies, setCompanies] = useState<MockCompany[]>([]);
  const [dealers, setDealers] = useState<MockDealer[]>([]);
  const [settings, setSettings] = useState<SuperAdminSettings | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [backendNotRunning, setBackendNotRunning] = useState(false);
  const [hasActiveBatch, setHasActiveBatch] = useState(false);

  useEffect(() => {
    if (role !== 'super' && role !== 'company') {
      setAudits([]);
      setTimeSeries([]);
      setCallBatches([]);
      setCompanies([]);
      setDealers([]);
      setSettings(null);
      setAuditsLoading(false);
      setDataLoading(false);
      setBackendNotRunning(false);
      return;
    }

    let cancelled = false;
    setDataLoading(true);
    setBackendNotRunning(false);
    Promise.all([
      fetchAudits(200),
      fetchCallBatches(80, 'all'),
      fetchTimeSeries(),
      fetchMockEntities(),
      fetchSuperAdminSettings(),
    ])
      .then(([a, batches, ts, mock, st]) => {
        if (cancelled) return;
        setAudits(a);
        setCallBatches(batches);
        setTimeSeries(ts);
        setCompanies(mock.companies);
        setDealers(mock.dealers);
        setSettings(st);
      })
      .catch(() => {
        if (!cancelled) {
          setAudits([]);
          setTimeSeries([]);
          setCallBatches([]);
          setCompanies([]);
          setDealers([]);
          setSettings(null);
          setBackendNotRunning(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAuditsLoading(false);
          setDataLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [role]);

  useEffect(() => {
    if (role !== 'super' && role !== 'company') return;
    let cancelled = false;
    const pull = async () => {
      try {
        const batches = await fetchCallBatches(80, 'all');
        if (!cancelled) setCallBatches(batches);
      } catch {
        if (!cancelled) setCallBatches([]);
      }
    };
    pull();
    const timer = window.setInterval(pull, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [role]);

  const isSuperOrCompany = role === 'super' || role === 'company';

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    const main = document.querySelector('.super-admin-main');
    if (main && 'scrollTop' in main) {
      (main as HTMLElement).scrollTop = 0;
    }
  }, [activeTab, selectedDealershipId, selectedEmployeeId, selectedAuditId]);

  // Подсветка пункта "Проверки" в сайдбаре, если есть активный ручной batch
  useEffect(() => {
    if (!isSuperOrCompany) {
      setHasActiveBatch(false);
      return;
    }
    const has = callBatches.some(
      (b) =>
        (b.mode === 'manual' || b.mode === 'single_dealership' || b.mode === 'all_dealerships') &&
        (b.status === 'running' || b.status === 'paused'),
    );
    setHasActiveBatch(has);
  }, [isSuperOrCompany, callBatches]);

  return (
    <div className="super-admin-app">
      <SuperAdminSidebar
        activeTab={activeTab}
        onTab={handleTabChange}
        role={role}
        onRoleChange={handleRoleChange}
        hasActiveBatch={hasActiveBatch}
      />
      <main
        className="super-admin-main"
        style={{
          marginLeft: SIDEBAR_WIDTH,
          minHeight: '100vh',
          paddingTop: 32,
          paddingBottom: 48,
        }}
      >
        <div className="super-admin-content">
          {backendNotRunning && isSuperOrCompany && (
            <div
              style={{
                marginBottom: 24,
                padding: 20,
                background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
                borderRadius: 18,
                border: '1px solid rgba(245,158,11,0.3)',
                fontSize: 14,
                color: '#92400E',
              }}
            >
              <strong>Нет данных: бэкенд не запущен.</strong>
              <br />
              В отдельном терминале выполните: <code style={{ background: 'rgba(0,0,0,0.06)', padding: '2px 8px', borderRadius: 6 }}>npm run dev</code>
              <br />
              (сервер будет на порту 3000, Vite проксирует сюда запросы /api). Затем обновите страницу.
            </div>
          )}

          {/* ── Super / Company role content ── */}
          {isSuperOrCompany && (
            <>
              {activeTab === 'dashboard' && (
                <Dashboard
                  summary={summary}
                  voice={voice}
                  loading={loadingSummary}
                  timeSeries={timeSeries}
                  companies={companies}
                  totalAudits={audits.length}
                  audits={audits}
                />
              )}
              {activeTab === 'companies' && !selectedDealershipId && (
                <Companies
                  companies={companies}
                  loading={dataLoading}
                  onSelectDealership={setSelectedDealershipId}
                  onOpenBatchInAudits={(batchId) => {
                    setSelectedDealershipId(null);
                    setSelectedEmployeeId(null);
                    setSelectedAuditId(null);
                    setSelectedBatchDetailId(batchId);
                    setActiveTab('audits');
                    setAuditsInitialScope('dealerships');
                    setFocusedBatchId(batchId);
                  }}
                />
              )}
              {activeTab === 'companies' && selectedDealershipId && (
                <DealershipDetail
                  dealershipId={selectedDealershipId}
                  onBack={() => setSelectedDealershipId(null)}
                  onOpenEmployee={(empId) => {
                    const sourceId = selectedDealershipId;
                    const sourceName = sourceId
                      ? (
                        getMockDealershipDetail(sourceId)?.name
                        ?? companies.find((c) => c.id === sourceId)?.name
                        ?? sourceId
                      )
                      : 'Автосалон';
                    setSelectedDealershipId(null);
                    setActiveTab('autodealers');
                    setSelectedEmployeeId(empId);
                    if (sourceId) {
                      setEmployeeSourceDealership({ id: sourceId, name: sourceName });
                    }
                  }}
                  onOpenBatchDetail={(batchId) => {
                    setSelectedDealershipId(null);
                    setSelectedEmployeeId(null);
                    setSelectedAuditId(null);
                    setSelectedBatchDetailId(batchId);
                    setActiveTab('audits');
                    setAuditsInitialScope('dealerships');
                    setFocusedBatchId(batchId);
                  }}
                />
              )}
              {activeTab === 'autodealers' && !selectedEmployeeId && (
                <Autodealers
                  dealers={dealers}
                  loading={dataLoading}
                  onSelectEmployee={(id) => {
                    setEmployeeSourceDealership(null);
                    setSelectedEmployeeId(id);
                  }}
                />
              )}
              {activeTab === 'autodealers' && selectedEmployeeId && (
                <EmployeeDetail
                  employeeId={selectedEmployeeId}
                  onBack={() => {
                    if (employeeSourceDealership) {
                      setSelectedEmployeeId(null);
                      setActiveTab('companies');
                      setSelectedDealershipId(employeeSourceDealership.id);
                      return;
                    }
                    setSelectedEmployeeId(null);
                  }}
                  onOpenDealership={(dealershipId) => {
                    setEmployeeSourceDealership(null);
                    setSelectedEmployeeId(null);
                    setActiveTab('companies');
                    setSelectedDealershipId(dealershipId);
                  }}
                  onOpenCompanies={() => {
                    setEmployeeSourceDealership(null);
                    setSelectedEmployeeId(null);
                    setActiveTab('companies');
                    setSelectedDealershipId(null);
                  }}
                  sourceDealership={employeeSourceDealership}
                />
              )}
              {activeTab === 'audits' && !selectedAuditId && !selectedBatchDetailId && (
                <Audits
                  audits={audits}
                  callBatches={callBatches}
                  callBatchesLoading={dataLoading}
                  onScopeChange={setAuditsInitialScope}
                  loading={auditsLoading}
                  initialScope={auditsInitialScope}
                  focusedBatchId={focusedBatchId}
                  onOpenDetail={setSelectedAuditId}
                  onOpenBatchDetail={(batchId) => {
                    setSelectedBatchDetailId(batchId);
                    setFocusedBatchId(batchId);
                  }}
                />
              )}
              {activeTab === 'audits' && !selectedAuditId && selectedBatchDetailId && (
                <AuditBatchDetail
                  batchId={selectedBatchDetailId}
                  initialBatch={callBatches.find((b) => b.id === selectedBatchDetailId) ?? null}
                  onBack={() => setSelectedBatchDetailId(null)}
                  onOpenAudit={(auditId) => {
                    setSelectedBatchDetailId(null);
                    setSelectedAuditId(auditId);
                  }}
                  onOpenDealership={(dealershipId) => {
                    setSelectedBatchDetailId(null);
                    setSelectedAuditId(null);
                    setActiveTab('companies');
                    setSelectedDealershipId(dealershipId);
                  }}
                />
              )}
              {activeTab === 'audits' && selectedAuditId && (
                <AuditDetail
                  auditId={selectedAuditId}
                  onBack={() => setSelectedAuditId(null)}
                  onNavigate={setSelectedAuditId}
                  onOpenEmployee={(empId) => {
                    setEmployeeSourceDealership(null);
                    setSelectedAuditId(null);
                    setActiveTab('autodealers');
                    setSelectedEmployeeId(empId);
                  }}
                />
              )}
              {activeTab === 'analytics' && (
                <Analytics
                  summary={summary}
                  timeSeries={timeSeries}
                  loading={loadingSummary}
                  onDrill={(type, filter) => {
                    if (type === 'employees') {
                      setActiveTab('autodealers');
                    } else if (type === 'dealership' && filter) {
                      setActiveTab('companies');
                      setSelectedDealershipId(filter);
                    } else if (type === 'audits') {
                      setActiveTab('audits');
                    }
                  }}
                />
              )}
            </>
          )}

          {/* ── Dealer role content ── */}
          {role === 'dealer' && activeTab.startsWith('dealer-') && (
            <DealerContent summary={summary} voice={voice} loadingSummary={loadingSummary} activeTab={activeTab as DealerTab} />
          )}

          {/* ── Staff role content ── */}
          {role === 'staff' && activeTab === 'staff-profile' && (
            <StaffProfileContent />
          )}
          {role === 'staff' && activeTab === 'staff-trainer' && (
            <StaffTrainerContent />
          )}

          {/* ── Settings (available for all roles) ── */}
          {activeTab === 'settings' && (
            <Settings settings={settings} loading={dataLoading} />
          )}
        </div>

        {/* Глобальный трей проверок в правом нижнем углу */}
        {isSuperOrCompany && (
          <CallBatchTray
            items={callBatches}
            onOpenBatchDetail={(batchId) => {
              setSelectedDealershipId(null);
              setSelectedEmployeeId(null);
              setSelectedAuditId(null);
              setSelectedBatchDetailId(batchId);
              setActiveTab('audits');
              setAuditsInitialScope('dealerships');
              setFocusedBatchId(batchId);
            }}
          />
        )}
      </main>
    </div>
  );
}
