import React, { useState, useEffect } from 'react';
import './super-admin-theme.css';
import { SuperAdminSidebar, SIDEBAR_WIDTH } from './SuperAdminSidebar';
import type { SuperAdminTab } from './SuperAdminSidebar';
import { Dashboard } from './pages/Dashboard';
import { Companies } from './pages/Companies';
import { DealershipDetail } from './pages/DealershipDetail';
import { Autodealers } from './pages/Autodealers';
import { EmployeeDetail } from './pages/EmployeeDetail';
import { Audits } from './pages/Audits';
import { AuditDetail } from './pages/AuditDetail';
import { Analytics } from './pages/Analytics';
import { Trainer } from './pages/Trainer';
import { Settings } from './pages/Settings';
import type { PlatformSummary, PlatformVoice } from './types';
import {
  fetchAudits,
  fetchTimeSeries,
  fetchMockEntities,
  fetchSuperAdminSettings,
  type AuditItem,
  type TimeSeriesPoint,
  type MockCompany,
  type MockDealer,
  type SuperAdminSettings,
} from './api';

export type SuperAdminLayoutProps = {
  summary: PlatformSummary | null;
  voice: PlatformVoice | null;
  loadingSummary: boolean;
  onSwitchToDealer?: () => void;
};

export function SuperAdminLayout({ summary, voice, loadingSummary, onSwitchToDealer }: SuperAdminLayoutProps) {
  const [activeTab, setActiveTab] = useState<SuperAdminTab>('dashboard');
  const [selectedDealershipId, setSelectedDealershipId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);

  const handleTabChange = (tab: SuperAdminTab) => {
    setActiveTab(tab);
    setSelectedDealershipId(null);
    setSelectedEmployeeId(null);
    setSelectedAuditId(null);
  };

  const [audits, setAudits] = useState<AuditItem[]>([]);
  const [auditsLoading, setAuditsLoading] = useState(true);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([]);
  const [companies, setCompanies] = useState<MockCompany[]>([]);
  const [dealers, setDealers] = useState<MockDealer[]>([]);
  const [settings, setSettings] = useState<SuperAdminSettings | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [backendNotRunning, setBackendNotRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDataLoading(true);
    setBackendNotRunning(false);
    Promise.all([
      fetchAudits(200),
      fetchTimeSeries(),
      fetchMockEntities(),
      fetchSuperAdminSettings(),
    ])
      .then(([a, ts, mock, st]) => {
        if (cancelled) return;
        setAudits(a);
        setTimeSeries(ts);
        setCompanies(mock.companies);
        setDealers(mock.dealers);
        setSettings(st);
      })
      .catch((err) => {
        if (!cancelled) {
          setAudits([]);
          setTimeSeries([]);
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
  }, []);

  return (
    <div className="super-admin-app">
      <SuperAdminSidebar activeTab={activeTab} onTab={handleTabChange} onSwitchToDealer={onSwitchToDealer} />
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
          {backendNotRunning && (
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
            <Companies companies={companies} loading={dataLoading} onSelectDealership={setSelectedDealershipId} />
          )}
          {activeTab === 'companies' && selectedDealershipId && (
            <DealershipDetail dealershipId={selectedDealershipId} onBack={() => setSelectedDealershipId(null)} />
          )}
          {activeTab === 'autodealers' && !selectedEmployeeId && (
            <Autodealers dealers={dealers} loading={dataLoading} onSelectEmployee={setSelectedEmployeeId} />
          )}
          {activeTab === 'autodealers' && selectedEmployeeId && (
            <EmployeeDetail employeeId={selectedEmployeeId} onBack={() => setSelectedEmployeeId(null)} />
          )}
          {activeTab === 'audits' && !selectedAuditId && (
            <Audits audits={audits} loading={auditsLoading} onOpenDetail={setSelectedAuditId} />
          )}
          {activeTab === 'audits' && selectedAuditId && (
            <AuditDetail
              auditId={selectedAuditId}
              onBack={() => setSelectedAuditId(null)}
              onNavigate={setSelectedAuditId}
              onOpenEmployee={(empId) => {
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
          {activeTab === 'trainer' && (
            <Trainer audits={audits} summary={summary} loading={auditsLoading} />
          )}
          {activeTab === 'settings' && (
            <Settings settings={settings} loading={dataLoading} />
          )}
        </div>
      </main>
    </div>
  );
}
