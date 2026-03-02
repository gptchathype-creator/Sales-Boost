import React, { useState, useMemo } from 'react';
import type { AuditItem } from '../api';
import {
  MOCK_AUDITS,
  AUDIT_TYPE_LABELS,
  AUDIT_STATUS_LABELS,
  AUDIT_STATUS_CLASS,
  STATUS_LABELS,
  getAllCities,
  getAllDealershipNamesForEmployees,
  type AuditListRow,
  type AuditType,
  type AuditStatus,
} from '../mockData';
import { ratingClass, statusBadgeClass } from '../utils';

/* ────────────────────── Props ────────────────────── */

type Props = {
  audits: AuditItem[];
  loading?: boolean;
  onOpenDetail?: (auditId: string) => void;
};

/* ────────────────────── Sort config ────────────────────── */

type SortKey = 'dateTime' | 'totalScore' | 'status' | 'type' | 'employeeName' | 'dealershipName';
type SortDir = 'asc' | 'desc';

const STATUS_SORT_ORDER: Record<AuditStatus, number> = {
  failed: 0,
  interrupted: 1,
  completed: 2,
};

function comparator(key: SortKey, dir: SortDir) {
  return (a: AuditListRow, b: AuditListRow): number => {
    let cmp = 0;
    if (key === 'dateTime') {
      cmp = a.dateTime.localeCompare(b.dateTime);
    } else if (key === 'totalScore') {
      cmp = a.totalScore - b.totalScore;
    } else if (key === 'status') {
      cmp = STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status];
    } else if (key === 'type') {
      cmp = a.type.localeCompare(b.type);
    } else if (key === 'employeeName' || key === 'dealershipName') {
      cmp = a[key].localeCompare(b[key], 'ru');
    }
    return dir === 'asc' ? cmp : -cmp;
  };
}

/* ────────────────────── Quick-filter chips ────────────────────── */

type QuickFilter = 'fails' | 'low-score' | 'comm';

const QUICK_FILTERS: { id: QuickFilter; label: string }[] = [
  { id: 'fails', label: 'Только провалы' },
  { id: 'low-score', label: 'Низкий балл (<50)' },
  { id: 'comm', label: 'Проблемы коммуникации' },
];

function matchesQuick(a: AuditListRow, f: QuickFilter): boolean {
  switch (f) {
    case 'fails': return a.status === 'failed' || a.status === 'interrupted';
    case 'low-score': return a.totalScore < 50;
    case 'comm': return a.communicationFlag !== 'ok';
  }
}

/* ────────────────────── Column defs ────────────────────── */

const COLUMNS: { key: SortKey; label: string; align?: 'right' }[] = [
  { key: 'dateTime', label: 'Дата' },
  { key: 'type', label: 'Тип' },
  { key: 'employeeName', label: 'Сотрудник' },
  { key: 'dealershipName', label: 'Автосалон' },
  { key: 'totalScore', label: 'Балл', align: 'right' },
  { key: 'status', label: 'Статус' },
];

/* ════════════════════ Component ════════════════════ */

export function Audits({ loading = false, onOpenDetail }: Props) {
  const rows = MOCK_AUDITS;
  const allCities = useMemo(() => getAllCities(), []);
  const allDealerships = useMemo(() => getAllDealershipNamesForEmployees(), []);

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('dateTime');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [quickFilter, setQuickFilter] = useState<QuickFilter | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState<AuditType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<AuditStatus | 'all'>('all');
  const [filterCity, setFilterCity] = useState<Set<string>>(new Set());
  const [filterDealership, setFilterDealership] = useState<Set<string>>(new Set());

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'dateTime' ? 'desc' : 'desc'); }
  };

  const sortIcon = (key: SortKey) =>
    sortKey === key
      ? <span className="sa-sort-icon">{sortDir === 'asc' ? '▲' : '▼'}</span>
      : <span className="sa-sort-icon sa-sort-icon-inactive">▲</span>;

  const toggleCity = (c: string) => setFilterCity((p) => { const n = new Set(p); n.has(c) ? n.delete(c) : n.add(c); return n; });
  const toggleDealership = (d: string) => setFilterDealership((p) => { const n = new Set(p); n.has(d) ? n.delete(d) : n.add(d); return n; });

  const filtered = useMemo(() => {
    let list = [...rows];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) =>
        r.employeeName.toLowerCase().includes(q) ||
        r.dealershipName.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q)
      );
    }

    if (filterType !== 'all') list = list.filter((r) => r.type === filterType);
    if (filterStatus !== 'all') list = list.filter((r) => r.status === filterStatus);
    if (filterCity.size > 0) list = list.filter((r) => filterCity.has(r.city));
    if (filterDealership.size > 0) list = list.filter((r) => filterDealership.has(r.dealershipName));
    if (quickFilter) list = list.filter((r) => matchesQuick(r, quickFilter));

    list.sort(comparator(sortKey, sortDir));
    return list;
  }, [rows, search, filterType, filterStatus, filterCity, filterDealership, quickFilter, sortKey, sortDir]);

  function formatDateTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDuration(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  return (
    <>
      <h1 className="sa-page-title">Проверки</h1>
      <p className="sa-page-subtitle">Все тренировки и звонки</p>

      {/* ── Toolbar ── */}
      <div className="sa-toolbar">
        <div className="sa-toolbar-row">
          <div className="sa-search-wrap">
            <span className="sa-search-icon">🔍</span>
            <input
              className="sa-search-input"
              placeholder="Поиск по сотруднику / автосалону…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select className="sa-select" value={filterType} onChange={(e) => setFilterType(e.target.value as AuditType | 'all')}>
            <option value="all">Все типы</option>
            <option value="trainer">Тренажёр</option>
            <option value="call">Звонок</option>
          </select>

          <select className="sa-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as AuditStatus | 'all')}>
            <option value="all">Все статусы</option>
            <option value="completed">Завершено</option>
            <option value="failed">Провал</option>
            <option value="interrupted">Прервано</option>
          </select>

          <button
            className={`sa-btn-outline ${showFilters ? 'sa-chip-active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            Фильтры {showFilters ? '▲' : '▼'}
          </button>
        </div>

        {/* ── Quick chips ── */}
        <div className="sa-toolbar-chips">
          {QUICK_FILTERS.map((f) => (
            <button
              key={f.id}
              className={`sa-chip ${quickFilter === f.id ? 'sa-chip-active' : ''}`}
              onClick={() => setQuickFilter(quickFilter === f.id ? null : f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filters panel ── */}
      {showFilters && (
        <div className="sa-filters-panel">
          <div className="sa-filter-group">
            <span className="sa-filter-label">Город</span>
            <div className="sa-filter-options">
              {allCities.map((c) => (
                <label key={c} className="sa-filter-check">
                  <input type="checkbox" checked={filterCity.has(c)} onChange={() => toggleCity(c)} />
                  {c}
                </label>
              ))}
            </div>
          </div>
          <div className="sa-filter-group">
            <span className="sa-filter-label">Автосалон</span>
            <div className="sa-filter-options">
              {allDealerships.map((d) => (
                <label key={d} className="sa-filter-check">
                  <input type="checkbox" checked={filterDealership.has(d)} onChange={() => toggleDealership(d)} />
                  {d}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Table (desktop) ── */}
      <div className="sa-companies-table-wrap sa-desktop-only">
        <table className="sa-table sa-table-sortable">
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`sa-th-sortable ${col.align === 'right' ? 'sa-text-right' : ''}`}
                  onClick={() => toggleSort(col.key)}
                >
                  {col.label} {sortIcon(col.key)}
                </th>
              ))}
              <th>Вердикт</th>
              <th style={{ width: 32 }} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="sa-meta" style={{ padding: 24 }}>Загрузка…</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="sa-empty-state">
                  Нет проверок по выбранным фильтрам<br />
                  <span className="sa-meta">Сбросьте фильтры или измените период</span>
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr
                  key={r.id}
                  className="sa-row-clickable"
                  onClick={() => onOpenDetail?.(r.id)}
                >
                  <td>
                    <div style={{ fontSize: 13 }}>{formatDateTime(r.dateTime)}</div>
                    <div className="sa-meta" style={{ marginTop: 1 }}>{formatDuration(r.duration)}</div>
                  </td>
                  <td>
                    <span className={`sa-audit-type-badge sa-audit-type-${r.type}`}>
                      {AUDIT_TYPE_LABELS[r.type]}
                    </span>
                  </td>
                  <td>
                    <div className="sa-cell-name">{r.employeeName}</div>
                  </td>
                  <td>
                    <div className="sa-cell-name">{r.dealershipName}</div>
                    <div className="sa-cell-city">{r.city}</div>
                  </td>
                  <td className="sa-text-right">
                    <span className={ratingClass(r.totalScore)} style={{ fontSize: 15 }}>{r.totalScore}</span>
                  </td>
                  <td>
                    <span className={`sa-status-badge ${AUDIT_STATUS_CLASS[r.status]}`}>
                      {AUDIT_STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td>
                    <span className="sa-audit-verdict">{r.verdict.length > 40 ? r.verdict.slice(0, 38) + '…' : r.verdict}</span>
                  </td>
                  <td className="sa-row-chevron-cell">→</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Mobile stacked rows ── */}
      <div className="sa-mobile-only">
        {filtered.map((r) => (
          <div key={r.id} className="sa-mobile-row" onClick={() => onOpenDetail?.(r.id)}>
            <div className="sa-mobile-row-header">
              <div>
                <div className="sa-cell-name">{r.employeeName}</div>
                <div className="sa-cell-city">{r.dealershipName} · {r.city}</div>
              </div>
              <span className={`sa-mobile-rating ${ratingClass(r.totalScore)}`}>{r.totalScore}</span>
            </div>
            <div className="sa-mobile-chips">
              <span className="sa-metric-chip">{formatDateTime(r.dateTime)}</span>
              <span className={`sa-metric-chip sa-audit-type-badge sa-audit-type-${r.type}`}>{AUDIT_TYPE_LABELS[r.type]}</span>
              <span className={`sa-metric-chip sa-status-badge ${AUDIT_STATUS_CLASS[r.status]}`}>{AUDIT_STATUS_LABELS[r.status]}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
