# Модуль тестовых звонков (Vox) — интеграция в Sales-Boost

В проект встроен сервис тестовых звонков через Voximplant. Он живёт в `packages/voximplant-smoke` и `apps/vox-smoke-test-server`. Основной бот и админка обращаются к нему **только по HTTP**.

## Структура

- `packages/voximplant-smoke` — клиент Vox API, трекер, логгер.
- `apps/vox-smoke-test-server` — Express: `POST /call`, `POST /batch`, `GET /stats`, `POST /webhooks/vox`.
- `voximplant/scenario_smoke_test.js` — сценарий для личного кабинета Voximplant (скопировать вручную в сценарий с именем из `VOX_SCENARIO_NAME`).

## Запуск

Из корня Sales-Boost:

```bash
# Собрать пакеты и сервер
npm run call-test:build

# Запустить сервер тестовых звонков (порт 3001 по умолчанию)
npm run call-test:dev
```

Сервер подхватывает `.env` из корня проекта (или `.env.local`, если есть и `NODE_ENV` не `production`). Нужны переменные из блока «Call-test» в `.env.example`.

## Вызов из бота или админки

В конфиге основного приложения задайте URL сервера звонков:

- Локально: `VOX_SMOKE_SERVER_URL=http://localhost:3001`
- На сервере: `VOX_SMOKE_SERVER_URL=http://127.0.0.1:3001` или внешний URL, если сервер вынесен

Запуск одного звонка:

```ts
const base = process.env.VOX_SMOKE_SERVER_URL || "http://localhost:3001";
const res = await fetch(`${base}/call`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ to: "+79XXXXXXXXX", tag: "telegram" }),
});
const { call_id, started_at } = await res.json();
```

Без поля `to` будет использован номер из `VOX_TEST_TO` в `.env`.

## Продакшен и тест

- **Локально:** заведите `.env.local` с тестовыми VOX_* и туннелем для `PUBLIC_BASE_URL`; сервер подхватит его сам.
- **На сервере:** задайте продовые VOX_* в `.env` и запускайте с `NODE_ENV=production`, чтобы не подтягивался `.env.local`.

Порт сервера звонков: `VOX_SMOKE_PORT` или `PORT` (по умолчанию 3001), чтобы не конфликтовать с основным приложением (например, PORT=3000).
