# Деплой Sales Boost на Railway

## Пошаговая настройка

### Шаг 1. Подключите GitHub
1. [railway.app](https://railway.app) → войдите через GitHub
2. **New Project** → **Deploy from GitHub repo** → выберите `Sales-Boost`

### Шаг 2. Сгенерируйте домен (откуда берётся MINI_APP_URL)

1. Откройте ваш сервис (карточка с названием проекта)
2. Вкладка **Settings** (или **⚙️**)
3. Раздел **Networking** → кнопка **Generate Domain**
4. Railway создаст URL, например: `https://sales-boost-production-a1b2c3.up.railway.app`
5. **Скопируйте этот URL** — он и есть ваш домен

**MINI_APP_URL** = этот скопированный URL. Например: `https://sales-boost-production-a1b2c3.up.railway.app`

**⚠️ Ошибка "Application Failed to Respond" (502):** Если Mini App не открывается, проверьте **Target Port** в настройках домена:
- Settings → Networking → ваш домен → **Target Port**
- Должно быть **8080** (или пусто — Railway подставит PORT автоматически)
- Если указано 3000 — измените на 8080 или удалите (оставьте пустым)

### Шаг 3. Volume (постоянное хранилище для базы данных)

Без Volume база данных будет удаляться при каждом перезапуске.

1. В вашем сервисе откройте вкладку **Volumes** (рядом с Variables, Settings)
2. Нажмите **Add Volume** или **+ New Volume**
3. В поле **Mount Path** введите: `/data`
4. Сохраните

**Что это значит:** Railway создаёт папку `/data` внутри контейнера и сохраняет её содержимое между перезапусками. Файл базы `dev.db` будет лежать в `/data/dev.db`.

### Шаг 4. Переменные окружения

Вкладка **Variables** → **Add Variable** (или **+ New**). Добавьте по одной:

| Переменная | Значение |
|------------|----------|
| `BOT_TOKEN` | Токен от @BotFather |
| `OPENAI_API_KEY` | Ваш ключ OpenAI |
| `ADMIN_TELEGRAM_IDS` | Ваш Telegram ID или `@username` |
| `DATABASE_URL` | `file:/data/dev.db` |
| `MINI_APP_URL` | URL из шага 2 (например `https://sales-boost-production-xxx.up.railway.app`) |

---

## Обновление бота

```
git add .
git commit -m "Описание изменений"
git push
```

Railway автоматически соберёт и задеплоит новую версию за 1–2 минуты.

---

## Регион

Для пользователей в России/СНГ выберите регион **Europe** в настройках сервиса — меньше задержка.

---

## Проверка

После деплоя:
1. Откройте бота в Telegram
2. Напишите `/start`
3. Напишите `/admin` (если вы админ) → «Открыть Админ-панель»
4. Mini App должна открыться по HTTPS

---

## Устранение "Application Failed to Respond" (502)

Приложение слушает `0.0.0.0` и порт из `PORT` (Railway ставит 8080). Если Mini App не открывается:

1. **Settings** → **Networking** → клик по вашему домену
2. Найдите **Target Port** (или "Port")
3. Установите **8080** или оставьте пустым (авто)
4. Сохраните
