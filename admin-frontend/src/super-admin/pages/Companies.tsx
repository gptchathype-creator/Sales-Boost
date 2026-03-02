import React, { useState, useMemo } from 'react';
import type { MockCompany } from '../api';
import {
  adaptCompaniesToRows,
  STATUS_LABELS,
  STATUS_ORDER,
  type DealershipRow,
  type DealershipStatus,
  getAllCities,
} from '../mockData';
import { ratingClass, answerRateClass, answerTimeClass, deltaDisplay, statusBadgeClass } from '../utils';

/* ────────────────────── Props ────────────────────── */

type CompaniesProps = {
  companies: MockCompany[];
  loading?: boolean;
  onSelectDealership?: (id: string) => void;
};

/* ────────────────────── Sort config ────────────────────── */

type SortKey = 'name' | 'aiRating' | 'answerRate' | 'avgAnswerTimeSec' | 'auditsCount' | 'employeesCount' | 'deltaRating' | 'status';
type SortDir = 'asc' | 'desc';

const COLUMN_DEFS: { key: SortKey; label: string; align?: 'right' }[] = [
  { key: 'name', label: 'Автосалон' },
  { key: 'aiRating', label: 'AI-рейтинг', align: 'right' },
  { key: 'answerRate', label: 'Дозвон, %', align: 'right' },
  { key: 'avgAnswerTimeSec', label: 'Время ответа', align: 'right' },
  { key: 'auditsCount', label: 'Проверки', align: 'right' },
  { key: 'employeesCount', label: 'Сотрудники', align: 'right' },
  { key: 'deltaRating', label: 'Динамика', align: 'right' },
  { key: 'status', label: 'Статус' },
];

function comparator(key: SortKey, dir: SortDir) {
  return (a: DealershipRow, b: DealershipRow): number => {
    let cmp = 0;
    if (key === 'name') {
      cmp = a.name.localeCompare(b.name, 'ru');
    } else if (key === 'status') {
      cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    } else {
      const av = a[key] ?? -Infinity;
      const bv = b[key] ?? -Infinity;
      cmp = (av as number) - (bv as number);
    }
    return dir === 'asc' ? cmp : -cmp;
  };
}

/* ────────────────────── Period helper ────────────────────── */

type Period = '7d' | '30d' | 'custom';

/* ────────────────────── Component ────────────────────── */

export function Companies({ companies, loading = false, onSelectDealership }: CompaniesProps) {
  const rows = useMemo(() => adaptCompaniesToRows(companies), [companies]);
  const allCities = useMemo(() => getAllCities(), []);

  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<Period>('30d');
  const [sortKey, setSortKey] = useState<SortKey>('aiRating');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [onlyProblematic, setOnlyProblematic] = useState(false);
  const [onlyNoData, setOnlyNoData] = useState(false);
  const [cityFilter, setCityFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<DealershipStatus[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  const filtered = useMemo(() => {
    let list = rows;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(q) || r.city.toLowerCase().includes(q));
    }
    if (onlyProblematic) {
      list = list.filter((r) => r.status === 'critical' || r.status === 'risk');
    }
    if (onlyNoData) {
      list = list.filter((r) => r.status === 'no-data');
    }
    if (cityFilter.length > 0) {
      list = list.filter((r) => cityFilter.includes(r.city));
    }
    if (statusFilter.length > 0) {
      list = list.filter((r) => statusFilter.includes(r.status));
    }
    return [...list].sort(comparator(sortKey, sortDir));
  }, [rows, search, onlyProblematic, onlyNoData, cityFilter, statusFilter, sortKey, sortDir]);

  const toggleCityFilter = (city: string) => {
    setCityFilter((prev) => (prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city]));
  };

  const toggleStatusFilter = (s: DealershipStatus) => {
    setStatusFilter((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <span className="sa-sort-icon sa-sort-icon-inactive">⇅</span>;
    return <span className="sa-sort-icon">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <>
      <h1 className="sa-page-title">Автосалоны</h1>
      <p className="sa-page-subtitle">Управление точками холдинга и их эффективностью</p>

      {/* ─── Toolbar ─── */}
      <div className="sa-toolbar">
        <div className="sa-toolbar-row">
          <div className="sa-search-wrap">
            <svg className="sa-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              className="sa-search-input"
              placeholder="Поиск по названию или городу…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="sa-select" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            <option value="7d">7 дней</option>
            <option value="30d">30 дней</option>
            <option value="custom">Произвольно</option>
          </select>
          <button className="sa-btn-outline" onClick={() => setShowFilters((v) => !v)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            Фильтры
          </button>
        </div>
        <div className="sa-toolbar-chips">
          <button
            className={`sa-chip ${onlyProblematic ? 'sa-chip-active' : ''}`}
            onClick={() => { setOnlyProblematic((v) => !v); setOnlyNoData(false); }}
          >
            Только проблемные
          </button>
          <button
            className={`sa-chip ${onlyNoData ? 'sa-chip-active' : ''}`}
            onClick={() => { setOnlyNoData((v) => !v); setOnlyProblematic(false); }}
          >
            Без данных
          </button>
        </div>
      </div>

      {/* ─── Filters panel (collapsible) ─── */}
      {showFilters && (
        <div className="sa-filters-panel">
          <div className="sa-filter-group">
            <span className="sa-filter-label">Город:</span>
            <div className="sa-filter-options">
              {allCities.map((city) => (
                <label key={city} className="sa-filter-check">
                  <input type="checkbox" checked={cityFilter.includes(city)} onChange={() => toggleCityFilter(city)} />
                  {city}
                </label>
              ))}
            </div>
          </div>
          <div className="sa-filter-group">
            <span className="sa-filter-label">Статус:</span>
            <div className="sa-filter-options">
              {(['critical', 'risk', 'norm', 'no-data'] as DealershipStatus[]).map((s) => (
                <label key={s} className="sa-filter-check">
                  <input type="checkbox" checked={statusFilter.includes(s)} onChange={() => toggleStatusFilter(s)} />
                  {STATUS_LABELS[s]}
                </label>
              ))}
            </div>
          </div>
          <button className="sa-btn-text" onClick={() => { setCityFilter([]); setStatusFilter([]); }}>Сбросить фильтры</button>
        </div>
      )}

      {/* ─── Desktop table ─── */}
      <div className="sa-companies-table-wrap sa-desktop-only">
        <table className="sa-table sa-table-sortable">
          <thead>
            <tr>
              {COLUMN_DEFS.map((col) => (
                <th
                  key={col.key}
                  className={`sa-th-sortable ${col.align === 'right' ? 'sa-text-right' : ''}`}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label} <SortIcon col={col.key} />
                </th>
              ))}
              <th style={{ width: 32 }} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="sa-meta" style={{ padding: 32 }}>Загрузка…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="sa-meta" style={{ padding: 32 }}>Нет автосалонов по заданным фильтрам</td></tr>
            ) : (
              filtered.map((r) => {
                const delta = deltaDisplay(r.deltaRating);
                return (
                  <tr
                    key={r.id}
                    className="sa-row-clickable"
                    onClick={() => onSelectDealership?.(r.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && onSelectDealership?.(r.id)}
                  >
                    <td>
                      <div className="sa-cell-name">{r.name}</div>
                      <div className="sa-cell-city">{r.city}</div>
                    </td>
                    <td className="sa-text-right"><span className={ratingClass(r.aiRating)}>{r.aiRating}</span></td>
                    <td className="sa-text-right">
                      {r.answerRate !== null
                        ? <span className={answerRateClass(r.answerRate)}>{r.answerRate}%</span>
                        : <span className="sa-muted" title="Метрика появится после подключения телефонии">—</span>
                      }
                    </td>
                    <td className="sa-text-right">
                      {r.avgAnswerTimeSec !== null
                        ? <span className={answerTimeClass(r.avgAnswerTimeSec)}>{r.avgAnswerTimeSec}с</span>
                        : <span className="sa-muted" title="Нет данных за период">—</span>
                      }
                    </td>
                    <td className="sa-text-right">{r.auditsCount}</td>
                    <td className="sa-text-right">{r.employeesCount}</td>
                    <td className="sa-text-right"><span className={delta.cls}>{delta.text}</span></td>
                    <td><span className={statusBadgeClass(r.status)}>{STATUS_LABELS[r.status]}</span></td>
                    <td className="sa-row-chevron-cell">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Mobile stacked rows ─── */}
      <div className="sa-mobile-only">
        {loading ? (
          <div className="sa-meta" style={{ padding: 32, textAlign: 'center' }}>Загрузка…</div>
        ) : filtered.length === 0 ? (
          <div className="sa-meta" style={{ padding: 32, textAlign: 'center' }}>Нет автосалонов по заданным фильтрам</div>
        ) : (
          filtered.map((r) => {
            const delta = deltaDisplay(r.deltaRating);
            return (
              <div
                key={r.id}
                className="sa-mobile-row"
                onClick={() => onSelectDealership?.(r.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onSelectDealership?.(r.id)}
              >
                <div className="sa-mobile-row-header">
                  <div>
                    <div className="sa-cell-name">{r.name}</div>
                    <div className="sa-cell-city">{r.city}</div>
                  </div>
                  <span className={`sa-mobile-rating ${ratingClass(r.aiRating)}`}>{r.aiRating}</span>
                </div>
                <div className="sa-mobile-chips">
                  <span className="sa-metric-chip">
                    Дозвон: {r.answerRate !== null ? <span className={answerRateClass(r.answerRate)}>{r.answerRate}%</span> : '—'}
                  </span>
                  <span className="sa-metric-chip">
                    Ответ: {r.avgAnswerTimeSec !== null ? <span className={answerTimeClass(r.avgAnswerTimeSec)}>{r.avgAnswerTimeSec}с</span> : '—'}
                  </span>
                  <span className="sa-metric-chip">Проверки: {r.auditsCount}</span>
                  <span className="sa-metric-chip">Сотрудники: {r.employeesCount}</span>
                  <span className="sa-metric-chip"><span className={delta.cls}>{delta.text}</span></span>
                  <span className={statusBadgeClass(r.status)}>{STATUS_LABELS[r.status]}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
