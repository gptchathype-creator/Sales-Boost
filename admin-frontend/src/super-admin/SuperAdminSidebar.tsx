import React from 'react';

export type SuperAdminTab =
  | 'dashboard'
  | 'companies'
  | 'autodealers'
  | 'audits'
  | 'analytics'
  | 'trainer'
  | 'settings';

const SIDEBAR_WIDTH = 260;

const navItems: { id: SuperAdminTab; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Дашборд', icon: <DashboardIcon /> },
  { id: 'companies', label: 'Автосалоны', icon: <CompaniesIcon /> },
  { id: 'autodealers', label: 'Сотрудники', icon: <DealersIcon /> },
  { id: 'audits', label: 'Проверки', icon: <AuditsIcon /> },
  { id: 'analytics', label: 'Аналитика', icon: <AnalyticsIcon /> },
  { id: 'trainer', label: 'Тренажёр', icon: <TrainerIcon /> },
  { id: 'settings', label: 'Настройки', icon: <SettingsIcon /> },
];

function DashboardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}
function CompaniesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
      <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
    </svg>
  );
}
function DealersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}
function AuditsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  );
}
function AnalyticsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 20V10M12 20V4M6 20v-6" />
    </svg>
  );
}
function TrainerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

type Props = {
  activeTab: SuperAdminTab;
  onTab: (tab: SuperAdminTab) => void;
  onSwitchToDealer?: () => void;
};

export function SuperAdminSidebar({ activeTab, onTab, onSwitchToDealer }: Props) {
  return (
    <aside
      className="super-admin-sidebar"
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 40,
        overflowY: 'auto',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 600, color: 'var(--sa-text)' }}>
          Sales Boost
        </h2>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--sa-text-secondary)' }}>Управление холдингом</p>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => onTab(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              width: '100%',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ flexShrink: 0, opacity: activeTab === item.id ? 1 : 0.7 }}>
              {item.icon}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      {onSwitchToDealer && (
        <div style={{ paddingTop: 16, borderTop: '1px solid var(--sa-divider)' }}>
          <button
            type="button"
            onClick={onSwitchToDealer}
            style={{
              width: '100%',
              padding: '10px 16px',
              fontSize: 13,
              color: 'var(--sa-text-secondary)',
              background: 'transparent',
              border: 'none',
              borderRadius: 999,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            ← Режим дилера
          </button>
        </div>
      )}
    </aside>
  );
}

export { SIDEBAR_WIDTH };
