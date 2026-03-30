import React, { useEffect, useMemo, useState } from 'react';
import {
  createDealership,
  createHolding,
  deleteDealership,
  deleteHolding,
  fetchDealerships,
  fetchHoldings,
  syncMockOrganization,
  updateDealership,
  updateHolding,
  type DealershipItem,
  type HoldingItem,
} from '../api';

type PageTab = 'holdings' | 'dealerships';

type HoldingFormState = {
  name: string;
  code: string;
  isActive: boolean;
  dealershipIds: string[];
};

type DealershipFormState = {
  name: string;
  code: string;
  city: string;
  address: string;
  holdingId: string;
  isActive: boolean;
};

const EMPTY_HOLDING_FORM: HoldingFormState = {
  name: '',
  code: '',
  isActive: true,
  dealershipIds: [],
};

const EMPTY_DEALERSHIP_FORM: DealershipFormState = {
  name: '',
  code: '',
  city: '',
  address: '',
  holdingId: '',
  isActive: true,
};

function overlayCardStyle(width = 760): React.CSSProperties {
  return {
    width: `min(100%, ${width}px)`,
    maxHeight: '88vh',
    overflowY: 'auto',
    background: '#fff',
    borderRadius: 24,
    boxShadow: '0 28px 80px rgba(15,23,42,0.28)',
    padding: 22,
  };
}

function ModalFrame(props: {
  title: string;
  subtitle?: string;
  open: boolean;
  onClose: () => void;
  width?: number;
  children: React.ReactNode;
}) {
  if (!props.open) return null;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.48)',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
        zIndex: 120,
      }}
      onClick={props.onClose}
    >
      <div style={overlayCardStyle(props.width)} onClick={(event) => event.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 24 }}>{props.title}</h2>
            {props.subtitle && (
              <div style={{ marginTop: 6, fontSize: 13, color: 'var(--sa-text-secondary)' }}>{props.subtitle}</div>
            )}
          </div>
          <button type="button" className="sa-btn-text" onClick={props.onClose}>Закрыть</button>
        </div>
        {props.children}
      </div>
    </div>
  );
}

function TabButton(props: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className={`sa-chip ${props.active ? 'sa-chip-active' : ''}`}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

export function HoldingsPage() {
  const [tab, setTab] = useState<PageTab>('holdings');
  const [holdings, setHoldings] = useState<HoldingItem[]>([]);
  const [dealerships, setDealerships] = useState<DealershipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [createHoldingOpen, setCreateHoldingOpen] = useState(false);
  const [editHoldingOpen, setEditHoldingOpen] = useState(false);
  const [deleteHoldingOpen, setDeleteHoldingOpen] = useState(false);
  const [createDealershipOpen, setCreateDealershipOpen] = useState(false);
  const [editDealershipOpen, setEditDealershipOpen] = useState(false);
  const [deleteDealershipOpen, setDeleteDealershipOpen] = useState(false);

  const [holdingForm, setHoldingForm] = useState<HoldingFormState>(EMPTY_HOLDING_FORM);
  const [dealershipForm, setDealershipForm] = useState<DealershipFormState>(EMPTY_DEALERSHIP_FORM);
  const [savingHolding, setSavingHolding] = useState(false);
  const [savingDealership, setSavingDealership] = useState(false);
  const [activeHolding, setActiveHolding] = useState<HoldingItem | null>(null);
  const [activeDealership, setActiveDealership] = useState<DealershipItem | null>(null);
  const [holdingDealershipSearch, setHoldingDealershipSearch] = useState('');

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [nextHoldings, nextDealerships] = await Promise.all([
        fetchHoldings(),
        fetchDealerships(),
      ]);
      setHoldings(nextHoldings);
      setDealerships(nextDealerships);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить структуру.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData().catch(() => undefined);
  }, []);

  const unassignedDealerships = useMemo(
    () => dealerships.filter((item) => !item.holdingId),
    [dealerships],
  );

  function openCreateHolding() {
    setHoldingForm(EMPTY_HOLDING_FORM);
    setActiveHolding(null);
    setHoldingDealershipSearch('');
    setCreateHoldingOpen(true);
  }

  function openEditHolding(item: HoldingItem) {
    setActiveHolding(item);
    setHoldingForm({
      name: item.name,
      code: item.code || '',
      isActive: item.isActive,
      dealershipIds: item.dealerships.map((dealership) => dealership.id),
    });
    setHoldingDealershipSearch('');
    setEditHoldingOpen(true);
  }

  function openCreateDealership() {
    setDealershipForm(EMPTY_DEALERSHIP_FORM);
    setActiveDealership(null);
    setCreateDealershipOpen(true);
  }

  function openEditDealership(item: DealershipItem) {
    setActiveDealership(item);
    setDealershipForm({
      name: item.name,
      code: item.code || '',
      city: item.city || '',
      address: item.address || '',
      holdingId: item.holdingId || '',
      isActive: item.isActive,
    });
    setEditDealershipOpen(true);
  }

  function toggleHoldingDealership(dealershipId: string) {
    setHoldingForm((current) => ({
      ...current,
      dealershipIds: current.dealershipIds.includes(dealershipId)
        ? current.dealershipIds.filter((id) => id !== dealershipId)
        : [...current.dealershipIds, dealershipId],
    }));
  }

  async function handleCreateHoldingSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSavingHolding(true);
    setError(null);
    try {
      await createHolding({
        name: holdingForm.name,
        code: holdingForm.code || null,
        isActive: holdingForm.isActive,
        dealershipIds: holdingForm.dealershipIds,
      });
      setCreateHoldingOpen(false);
      setNotice('Холдинг создан.');
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось создать холдинг.');
    } finally {
      setSavingHolding(false);
    }
  }

  async function handleEditHoldingSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!activeHolding) return;
    setSavingHolding(true);
    setError(null);
    try {
      await updateHolding(activeHolding.id, {
        name: holdingForm.name,
        code: holdingForm.code || null,
        isActive: holdingForm.isActive,
        dealershipIds: holdingForm.dealershipIds,
      });
      setEditHoldingOpen(false);
      setNotice('Холдинг обновлён.');
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось обновить холдинг.');
    } finally {
      setSavingHolding(false);
    }
  }

  async function handleDeleteHoldingConfirm() {
    if (!activeHolding) return;
    setSavingHolding(true);
    setError(null);
    try {
      await deleteHolding(activeHolding.id);
      setDeleteHoldingOpen(false);
      setActiveHolding(null);
      setNotice('Холдинг удалён. Автосалоны отвязаны.');
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось удалить холдинг.');
    } finally {
      setSavingHolding(false);
    }
  }

  async function handleCreateDealershipSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSavingDealership(true);
    setError(null);
    try {
      await createDealership({
        name: dealershipForm.name,
        code: dealershipForm.code || null,
        city: dealershipForm.city || null,
        address: dealershipForm.address || null,
        holdingId: dealershipForm.holdingId || null,
        isActive: dealershipForm.isActive,
      });
      setCreateDealershipOpen(false);
      setNotice('Автосалон создан.');
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось создать автосалон.');
    } finally {
      setSavingDealership(false);
    }
  }

  async function handleEditDealershipSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!activeDealership) return;
    setSavingDealership(true);
    setError(null);
    try {
      await updateDealership(activeDealership.id, {
        name: dealershipForm.name,
        code: dealershipForm.code || null,
        city: dealershipForm.city || null,
        address: dealershipForm.address || null,
        holdingId: dealershipForm.holdingId || null,
        isActive: dealershipForm.isActive,
      });
      setEditDealershipOpen(false);
      setNotice('Автосалон обновлён.');
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось обновить автосалон.');
    } finally {
      setSavingDealership(false);
    }
  }

  async function handleDeleteDealershipConfirm() {
    if (!activeDealership) return;
    setSavingDealership(true);
    setError(null);
    try {
      await deleteDealership(activeDealership.id);
      setDeleteDealershipOpen(false);
      setActiveDealership(null);
      setNotice('Автосалон удалён.');
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось удалить автосалон.');
    } finally {
      setSavingDealership(false);
    }
  }

  async function handleSyncMock() {
    setSyncing(true);
    setError(null);
    try {
      const summary = await syncMockOrganization();
      setNotice(`Синхронизация завершена: +${summary.holdingsCreated} холдингов, +${summary.dealershipsCreated} автосалонов, обновлено ${summary.dealershipsUpdated}.`);
      await loadData();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Не удалось синхронизировать структуру.');
    } finally {
      setSyncing(false);
    }
  }

  function renderHoldingForm(onSubmit: (event: React.FormEvent) => void, submitLabel: string) {
    const selectedDealerships = dealerships.filter((item) => holdingForm.dealershipIds.includes(item.id));
    const normalizedSearch = holdingDealershipSearch.trim().toLowerCase();
    const availableDealerships = dealerships
      .filter((item) => !item.holdingId && !holdingForm.dealershipIds.includes(item.id))
      .filter((item) => {
        if (!normalizedSearch) return true;
        const haystack = [item.name, item.city || '', item.address || '', item.code || ''].join(' ').toLowerCase();
        return haystack.includes(normalizedSearch);
      });

    return (
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 16 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Название</span>
          <input className="sa-input" value={holdingForm.name} onChange={(event) => setHoldingForm((current) => ({ ...current, name: event.target.value }))} required />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Код</span>
          <input className="sa-input" value={holdingForm.code} onChange={(event) => setHoldingForm((current) => ({ ...current, code: event.target.value }))} placeholder="north-group" />
        </label>
        <label className="sa-filter-check">
          <input type="checkbox" checked={holdingForm.isActive} onChange={(event) => setHoldingForm((current) => ({ ...current, isActive: event.target.checked }))} />
          <span>Активный холдинг</span>
        </label>
        <div className="sa-card" style={{ padding: 14, display: 'grid', gap: 10 }}>
          <div style={{ fontWeight: 700 }}>Привязанные автосалоны</div>
          <div style={{ fontSize: 13, color: 'var(--sa-text-secondary)' }}>
            В список ниже попадают только автосалоны без холдинга. Уже привязанные к текущему холдингу вынесены отдельно.
          </div>
          <div className="sa-card" style={{ padding: 12, display: 'grid', gap: 8 }}>
            <div style={{ fontWeight: 600 }}>Уже привязаны</div>
            {selectedDealerships.length === 0 ? (
              <div style={{ color: 'var(--sa-text-secondary)', fontSize: 13 }}>У этого холдинга пока нет привязанных автосалонов.</div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {selectedDealerships.map((item) => (
                  <div key={item.id} className="sa-card" style={{ padding: 10, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--sa-text-secondary)' }}>
                        {item.city || '—'} · {item.address || 'Адрес не указан'}
                      </div>
                    </div>
                    <button type="button" className="sa-btn-text" onClick={() => toggleHoldingDealership(item.id)}>
                      Отвязать
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="sa-card" style={{ padding: 12, display: 'grid', gap: 10 }}>
            <div style={{ fontWeight: 600 }}>Доступные для привязки</div>
            <input
              className="sa-input"
              value={holdingDealershipSearch}
              onChange={(event) => setHoldingDealershipSearch(event.target.value)}
              placeholder="Поиск по названию, городу, адресу или коду"
            />
            <div style={{ display: 'grid', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
              {availableDealerships.length === 0 ? (
                <div style={{ color: 'var(--sa-text-secondary)', fontSize: 13 }}>
                  {normalizedSearch ? 'Ничего не найдено.' : 'Нет автосалонов без холдинга.'}
                </div>
              ) : availableDealerships.map((item) => (
                <div key={item.id} className="sa-card" style={{ padding: 10, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--sa-text-secondary)' }}>
                      {item.city || '—'} · {item.address || 'Адрес не указан'}
                    </div>
                  </div>
                  <button type="button" className="sa-btn-text" onClick={() => toggleHoldingDealership(item.id)}>
                    Привязать
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="sa-btn-outline" onClick={() => { setCreateHoldingOpen(false); setEditHoldingOpen(false); }}>Отмена</button>
          <button type="submit" className="sa-btn-primary" disabled={savingHolding}>
            {savingHolding ? 'Сохраняем...' : submitLabel}
          </button>
        </div>
      </form>
    );
  }

  function renderDealershipForm(onSubmit: (event: React.FormEvent) => void, submitLabel: string) {
    return (
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 16 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Название</span>
          <input className="sa-input" value={dealershipForm.name} onChange={(event) => setDealershipForm((current) => ({ ...current, name: event.target.value }))} required />
        </label>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Код</span>
            <input className="sa-input" value={dealershipForm.code} onChange={(event) => setDealershipForm((current) => ({ ...current, code: event.target.value }))} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Город</span>
            <input className="sa-input" value={dealershipForm.city} onChange={(event) => setDealershipForm((current) => ({ ...current, city: event.target.value }))} />
          </label>
        </div>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Адрес</span>
          <input className="sa-input" value={dealershipForm.address} onChange={(event) => setDealershipForm((current) => ({ ...current, address: event.target.value }))} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Холдинг</span>
          <select className="sa-select" value={dealershipForm.holdingId} onChange={(event) => setDealershipForm((current) => ({ ...current, holdingId: event.target.value }))}>
            <option value="">Без холдинга</option>
            {holdings.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        <label className="sa-filter-check">
          <input type="checkbox" checked={dealershipForm.isActive} onChange={(event) => setDealershipForm((current) => ({ ...current, isActive: event.target.checked }))} />
          <span>Активный автосалон</span>
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="sa-btn-outline" onClick={() => { setCreateDealershipOpen(false); setEditDealershipOpen(false); }}>Отмена</button>
          <button type="submit" className="sa-btn-primary" disabled={savingDealership}>
            {savingDealership ? 'Сохраняем...' : submitLabel}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <section className="sa-card" style={{ padding: 20, display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 30 }}>Холдинги</h1>
            <div style={{ marginTop: 8, color: 'var(--sa-text-secondary)', maxWidth: 740 }}>
              Отдельный административный контур для управления оргструктурой. Холдинги группируют автосалоны, при этом часть автосалонов может существовать без холдинга.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="sa-btn-outline" onClick={handleSyncMock} disabled={syncing}>
              {syncing ? 'Синхронизация...' : 'Синхронизировать моки'}
            </button>
            {tab === 'holdings' ? (
              <button type="button" className="sa-btn-primary" onClick={openCreateHolding}>Новый холдинг</button>
            ) : (
              <button type="button" className="sa-btn-primary" onClick={openCreateDealership}>Новый автосалон</button>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <TabButton active={tab === 'holdings'} onClick={() => setTab('holdings')}>Холдинги</TabButton>
          <TabButton active={tab === 'dealerships'} onClick={() => setTab('dealerships')}>Автосалоны</TabButton>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', color: 'var(--sa-text-secondary)', fontSize: 13 }}>
          <span>Холдингов: {holdings.length}</span>
          <span>Автосалонов: {dealerships.length}</span>
          <span>Без холдинга: {unassignedDealerships.length}</span>
        </div>
        {notice && (
          <div style={{ padding: 12, borderRadius: 14, background: '#ecfdf5', color: '#047857', fontSize: 14 }}>
            {notice}
          </div>
        )}
        {error && (
          <div style={{ padding: 12, borderRadius: 14, background: '#fef2f2', color: '#b91c1c', fontSize: 14 }}>
            {error}
          </div>
        )}
      </section>

      {loading ? (
        <div className="sa-card" style={{ padding: 20 }}>Загрузка структуры...</div>
      ) : tab === 'holdings' ? (
        <div style={{ display: 'grid', gap: 16 }}>
          {holdings.map((item) => (
            <section key={item.id} className="sa-card" style={{ padding: 18, display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, fontSize: 22 }}>{item.name}</h2>
                    <span className="sa-metric-chip">{item.isActive ? 'Активен' : 'Выключен'}</span>
                    <span className="sa-metric-chip">{item.dealershipsCount} салонов</span>
                  </div>
                  <div style={{ marginTop: 6, color: 'var(--sa-text-secondary)', fontSize: 13 }}>
                    Код: {item.code || '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="sa-btn-text" onClick={() => openEditHolding(item)}>Редактировать</button>
                  <button type="button" className="sa-btn-danger" onClick={() => { setActiveHolding(item); setDeleteHoldingOpen(true); }}>Удалить</button>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {item.dealerships.length === 0 ? (
                  <div style={{ color: 'var(--sa-text-secondary)', fontSize: 14 }}>Пока нет привязанных автосалонов.</div>
                ) : item.dealerships.map((dealership) => (
                  <div key={dealership.id} className="sa-card" style={{ padding: 12, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{dealership.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--sa-text-secondary)' }}>
                        {dealership.city || '—'} · {dealership.address || 'Адрес не указан'}
                      </div>
                    </div>
                    <button type="button" className="sa-btn-text" onClick={() => openEditDealership(dealerships.find((itemDealership) => itemDealership.id === dealership.id) || {
                      id: dealership.id,
                      name: dealership.name,
                      code: dealership.code,
                      city: dealership.city,
                      address: dealership.address,
                      isActive: dealership.isActive,
                      createdAt: '',
                      updatedAt: '',
                      holdingId: dealership.holdingId,
                      holdingName: item.name,
                      managersCount: 0,
                    })}>
                      Карточка салона
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {holdings.length === 0 && (
            <div className="sa-card" style={{ padding: 20 }}>
              Холдингов пока нет. Можно синхронизировать моковую структуру или создать первый холдинг вручную.
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {dealerships.map((item) => (
            <section key={item.id} className="sa-card" style={{ padding: 18, display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, fontSize: 22 }}>{item.name}</h2>
                    <span className="sa-metric-chip">{item.isActive ? 'Активен' : 'Выключен'}</span>
                    <span className="sa-metric-chip">{item.holdingName || 'Без холдинга'}</span>
                  </div>
                  <div style={{ marginTop: 6, color: 'var(--sa-text-secondary)', fontSize: 13 }}>
                    {item.city || '—'} · {item.address || 'Адрес не указан'} · Менеджеров: {item.managersCount}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="sa-btn-text" onClick={() => openEditDealership(item)}>Редактировать</button>
                  <button type="button" className="sa-btn-danger" onClick={() => { setActiveDealership(item); setDeleteDealershipOpen(true); }}>Удалить</button>
                </div>
              </div>
            </section>
          ))}

          {dealerships.length === 0 && (
            <div className="sa-card" style={{ padding: 20 }}>
              Автосалонов пока нет. Можно синхронизировать моковую структуру или создать автосалон вручную.
            </div>
          )}
        </div>
      )}

      <ModalFrame title="Новый холдинг" subtitle="Создание холдинга и привязка уже существующих автосалонов." open={createHoldingOpen} onClose={() => setCreateHoldingOpen(false)}>
        {renderHoldingForm(handleCreateHoldingSubmit, 'Создать холдинг')}
      </ModalFrame>

      <ModalFrame title="Редактировать холдинг" subtitle="Можно поменять состав автосалонов внутри холдинга." open={editHoldingOpen && !!activeHolding} onClose={() => setEditHoldingOpen(false)}>
        {renderHoldingForm(handleEditHoldingSubmit, 'Сохранить холдинг')}
      </ModalFrame>

      <ModalFrame title="Удалить холдинг" subtitle="Автосалоны сохранятся и станут независимыми." open={deleteHoldingOpen && !!activeHolding} onClose={() => setDeleteHoldingOpen(false)} width={520}>
        {activeHolding && (
          <div style={{ display: 'grid', gap: 16 }}>
            <p style={{ margin: 0 }}>
              Удалить холдинг <strong>{activeHolding.name}</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="sa-btn-outline" onClick={() => setDeleteHoldingOpen(false)}>Отмена</button>
              <button type="button" className="sa-btn-danger" onClick={handleDeleteHoldingConfirm} disabled={savingHolding}>
                {savingHolding ? 'Удаляем...' : 'Удалить'}
              </button>
            </div>
          </div>
        )}
      </ModalFrame>

      <ModalFrame title="Новый автосалон" subtitle="Автосалон можно сразу привязать к холдингу или оставить отдельным." open={createDealershipOpen} onClose={() => setCreateDealershipOpen(false)}>
        {renderDealershipForm(handleCreateDealershipSubmit, 'Создать автосалон')}
      </ModalFrame>

      <ModalFrame title="Редактировать автосалон" subtitle="Здесь же можно изменить привязку к холдингу." open={editDealershipOpen && !!activeDealership} onClose={() => setEditDealershipOpen(false)}>
        {renderDealershipForm(handleEditDealershipSubmit, 'Сохранить автосалон')}
      </ModalFrame>

      <ModalFrame title="Удалить автосалон" subtitle="Удаление автосалона необратимо." open={deleteDealershipOpen && !!activeDealership} onClose={() => setDeleteDealershipOpen(false)} width={520}>
        {activeDealership && (
          <div style={{ display: 'grid', gap: 16 }}>
            <p style={{ margin: 0 }}>
              Удалить автосалон <strong>{activeDealership.name}</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="sa-btn-outline" onClick={() => setDeleteDealershipOpen(false)}>Отмена</button>
              <button type="button" className="sa-btn-danger" onClick={handleDeleteDealershipConfirm} disabled={savingDealership}>
                {savingDealership ? 'Удаляем...' : 'Удалить'}
              </button>
            </div>
          </div>
        )}
      </ModalFrame>
    </div>
  );
}
