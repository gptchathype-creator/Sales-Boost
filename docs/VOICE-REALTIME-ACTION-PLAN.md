# План: тест OpenAI Realtime и переключение сценариев

Цель: протестировать OpenAI Realtime через отдельный сценарий Voximplant и иметь возможность переключаться в коде между «наш LLM» и «OpenAI Realtime».

**Реализовано:** сценарий `voximplant/scenario_voice_realtime.js`, переключение по параметру `scenario` в `startVoiceCall(to, { scenario: 'dialog' | 'realtime' | 'realtime_pure' })`, выбор сценария в админке (вкладка «Звонок» — «Наш LLM» / «OpenAI Realtime (гибрид)» / «OpenAI Realtime (чистый, только промпт)»). Env: `VOX_REALTIME_RULE_NAME`, `VOX_REALTIME_SCENARIO_NAME`; для Realtime используется `OPENAI_API_KEY`. **Realtime с нашим алгоритмом (гибрид):** при заданном `VOICE_DIALOG_BASE_URL` в customData передаётся `dialog_url`; сценарий регистрирует инструмент `get_reply`, получает первую реплику и все последующие ответы с нашего бэкенда (виртуальный клиент), Realtime только озвучивает их. **Realtime Pure:** сценарий `voximplant/scenario_voice_realtime_pure.js` — без `dialog_url`, весь скрипт виртуального клиента (фазы, темы, реакции, завершение) зашит в инструкции сессии; env: `VOX_REALTIME_PURE_SCENARIO_NAME`, `VOX_REALTIME_PURE_RULE_NAME`.

---

## 1. Отдельный сценарий для Realtime

- **Файл:** `voximplant/scenario_voice_realtime.js`
- **Содержание:**
  - Подключить модуль OpenAI (Realtime API Client) по [документации Voximplant](https://voximplant.com/docs/voice-ai/openai/realtime-client).
  - Исходящий звонок: `VoxEngine.callPSTN(to, callerId)` — как в текущем сценарии.
  - При `CallEvents.Connected`: создать `createRealtimeAPIClient({ apiKey, model: "gpt-realtime" или "gpt-realtime-mini" })`, связать звонок с клиентом через `VoxEngine.sendMediaBetween(call, realtimeClient)` (или эквивалент из актуальной доки).
  - API-ключ OpenAI: передавать в `customData` при старте сценария (например `openai_api_key`) или использовать переменную/секрет в Voximplant, если так рекомендует документация.
  - Обработать отключение звонка и закрытие WebSocket (завершение сценария, события Failed/Disconnected).
  - Не использовать `dialog_url` / `stream_url` — только Realtime (речь ↔ речь через OpenAI).
- **Имя сценария в Voximplant:** например `voice_realtime` (то же имя, что в `script_name` при вызове API).

Текущий сценарий `scenario_voice_dialog.js` не трогаем — он остаётся для потока «наш бэкенд (LLM)».

---

## 2. Правило маршрутизации в Voximplant

- В личном кабинете Voximplant создать **новое правило** (например `voice_realtime_rule`), привязанное к сценарию **voice_realtime** (код из `scenario_voice_realtime.js`).
- Правило для текущего диалога с нашим LLM остаётся как есть: `voice_dialog_rule` → сценарий `voice_dialog`.

Итог: два правила — два сценария, переключение через параметр `rule_name` при старте звонка.

---

## 3. Переключение в коде (наш бэкенд)

- **Переменные окружения** (например в `.env` и `.env.example`):
  - `VOX_DIALOG_RULE_NAME` — правило для «нашего LLM» (по умолчанию `voice_dialog_rule`).
  - `VOX_REALTIME_RULE_NAME` — правило для Realtime (например `voice_realtime_rule`).
  - Опционально: `VOX_REALTIME_SCENARIO_NAME` (например `voice_realtime`) для явного указания имени сценария при Realtime.
- **Старт звонка:** в `src/voice/startVoiceCall.ts` (и при необходимости в пакете `voximplant-smoke`) добавить параметр выбора режима, например:
  - `useRealtime?: boolean` в параметрах функции/API, **или**
  - отдельный метод/эндпоинт «старт звонка в режиме Realtime».
- При выборе Realtime:
  - в запрос к Voximplant передавать `rule_name: VOX_REALTIME_RULE_NAME`, `script_name: VOX_REALTIME_SCENARIO_NAME` (или `voice_realtime`);
  - в `script_custom_data` передавать только то, что нужно сценарию Realtime: `call_id`, `to`, `event_url`, `caller_id`, и при необходимости `openai_api_key` (если ключ передаём через customData; иначе настроить в Voximplant).
- При выборе «наш LLM» — оставить текущее поведение: `rule_name: VOX_DIALOG_RULE_NAME`, `script_name: voice_dialog`, `customData` с `dialog_url` и при необходимости `stream_url`.

Таким образом переключение «Realtime vs наш LLM» делается выбором правила (и при необходимости имени сценария) при старте сценария.

---

## 4. Админка / тестовый интерфейс (опционально)

- В UI, откуда запускается звонок (например Call в админке), добавить выбор: **«Наш LLM»** / **«OpenAI Realtime»** (радио или выпадающий список).
- При нажатии «Позвонить» передавать выбранный режим в API старта звонка; бэкенд подставляет соответствующие `rule_name` и `script_name`.

Если админка вызывает существующий API без параметра режима — по умолчанию использовать текущее поведение (наш LLM).

---

## 5. Документация и env

- В `docs/` кратко описать: зачем два сценария, какие правила созданы, как переключаться (env и/или параметр при старте звонка).
- В `.env.example` добавить и описать:
  - `VOX_REALTIME_RULE_NAME=voice_realtime_rule`
  - при необходимости `VOX_REALTIME_SCENARIO_NAME=voice_realtime`
  - если ключ OpenAI передаётся в customData — не хранить ключ в репозитории; указать в комментарии, что для Realtime сценария ключ задаётся в Voximplant или через защищённую переменную.

---

## 6. Порядок работ (кратко)

| Шаг | Действие |
|-----|----------|
| 1 | Реализовать `voximplant/scenario_voice_realtime.js` (RealtimeAPIClient, звонок, медиа, завершение). |
| 2 | В Voximplant: создать сценарий `voice_realtime` (вставить код), создать правило `voice_realtime_rule`. |
| 3 | Добавить в проект env: `VOX_REALTIME_RULE_NAME`, при необходимости `VOX_REALTIME_SCENARIO_NAME`. |
| 4 | Доработать `startVoiceCall.ts` (и при необходимости voximplant-smoke): параметр режима, подстановка rule_name/script_name и customData для Realtime. |
| 5 | (Опционально) В админке — выбор «Наш LLM» / «OpenAI Realtime» и передача в API. |
| 6 | Обновить `.env.example` и коротко docs. |

После этого можно запускать звонок с правилом `voice_dialog_rule` (наш LLM) или `voice_realtime_rule` (OpenAI Realtime) и сравнивать задержку и качество.
