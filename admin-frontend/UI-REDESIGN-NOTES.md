# Admin UI redesign – what was changed (UI only)

## После изменений UI (чтобы не видеть старый интерфейс)

Из корня проекта выполнить **одну команду** (сборка + запуск dev-сервера):

```bash
npm run admin:fresh
```

Откроется актуальная админка по адресу из вывода в терминале (например `http://127.0.0.1:5173/` или `http://127.0.0.1:5176/` если порты заняты).  
Либо только собрать в `public/` и открывать через бэкенд: `npm run build`, затем `PORT=8080 npm run dev` → http://127.0.0.1:8080/

---

## Summary
Redesigned the admin panel into a calm, premium, minimal, pastel dashboard with a **left sidebar on desktop** and **drawer + top bar on mobile**. No business logic, routing, API calls, or state behavior was changed.

---

## New files

### `src/theme.css`
- Design tokens: `--app-bg`, `--sidebar-bg`, `--card-bg`, `--primary`, `--success`, `--warning`, `--error`, `--text-heading`, `--text-body`, `--text-muted`, `--card-radius`, `--card-shadow`, `--button-radius`, `--sidebar-width`, pastel badge backgrounds.
- Global overrides inside `.admin-app`: card radius/shadow, table row separators and hover, badge utility classes (`.admin-badge-success`, etc.), sidebar select trigger style.
- Responsive `.admin-kpi-grid`: multi-column on desktop, single column on mobile.

### `src/AdminLayout.tsx`
- **AdminLayout**: Two-column layout; left sidebar (fixed, ~260px), right content area (max-width 1200px, padding). On viewport &lt; 768px: sidebar hidden, top bar with hamburger and page title, drawer overlay for sidebar; content single column.
- **DrawerContext** and **useAdminDrawer()**: So that sidebar nav can close the drawer on mobile when a tab is selected.
- **AdminSidebarNavItem**: Sidebar nav button with optional icon, active state (pastel highlight), hover state.

---

## Modified files

### `src/App.tsx`
- **Removed**: `useEffect` that added `document.documentElement.classList.add('dark')` (light theme is used now).
- **Layout**: Root is now `<AdminLayout pageTitle={...} sidebar={...} content={...} />` instead of a single centered column.
- **Sidebar**: New **AppSidebar** component (same file) renders: “Sales Boost” title, role **Select** (unchanged behavior), and for role `dealer` four **AdminSidebarNavItem**s (Компании, Звонки, Сотрудники, Команда). Clicking an item calls `setActiveTab` and `drawer?.closeDrawer()`.
- **Content**: Unchanged views; only the wrapper changed. Dealer content is chosen by `activeTab` (companies / calls / employees / team); super / company / staff views unchanged. No Tabs component in content anymore; navigation is in the sidebar.

### `index.css`
- **Imports**: Added `@import "./theme.css"` after Tailwind and HeroUI so theme overrides apply.
- **Body**: `background-color: var(--app-bg)`, `color: var(--text-body)`, added Inter in `font-family`.

### `index.html`
- **Removed**: `class="dark"` from `<html>` and `class="bg-background text-foreground min-h-screen"` from `<body>` so the light pastel theme is used.
- **Added**: Google Fonts preconnect and Inter font link.

### `tailwind.config.cjs`
- **HeroUI themes**: Added `light` theme with `background: #F6F7FB`, `foreground: #374151`, `primary: #6366F1`, `content1: #FFFFFF`. Kept existing `dark` theme.

---

## Layout and responsive behavior

- **Desktop (≥768px)**: Sidebar fixed left (260px), main content with `margin-left: 260px`, page header (title) and content area with padding. Sidebar stays visible when scrolling.
- **Mobile (&lt;768px)**: Sidebar gets `transform: translateX(-100%)` (off-screen). Top bar shows hamburger + page title. Hamburger opens the drawer (same sidebar content) as overlay; backdrop click or nav item click closes it. Content area full width, padding 16px.

---

## Styling applied via theme

- **Cards**: `.admin-app [data-slot="base"]` and `.admin-card` use `--card-radius`, `--card-shadow`, `--card-bg`.
- **Buttons**: Rounded corners, subtle hover lift (transform) where overrides apply.
- **Tables**: Subtle bottom border on cells, row hover background inside `.admin-app`.
- **Badges**: Utility classes for pastel success/warning/error/primary pills.
- **Sidebar**: Background `--sidebar-bg`, nav items with rounded hover and active pastel highlight; Select trigger styled to match.

---

## What was not changed

- All state (`role`, `activeTab`, calls, attempts, team, etc.), loaders, and API calls.
- All component names and props (e.g. `CallsTab`, `EmployeesTab`, `TeamTab`, `StaffView`, etc.).
- Routing is still state-based (no React Router); only the way the user switches tabs (sidebar vs. old Tabs) is different.
- No new heavy dependencies; drawer is implemented with CSS and React state.
