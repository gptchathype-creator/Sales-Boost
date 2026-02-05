# Деплой Sales Boost на Railway

## Быстрый старт

1. Залейте проект в GitHub (если ещё не сделано)
2. Зайдите на [railway.app](https://railway.app) → войдите через GitHub
3. **New Project** → **Deploy from GitHub repo** → выберите репозиторий
4. Добавьте переменные окружения (см. ниже)
5. Добавьте Volume для базы данных
6. Получите URL и укажите его в `MINI_APP_URL`

---

## Переменные окружения (обязательно!)

В Railway: **Project** → **Variables** → **Add Variable**. Добавьте **все** переменные:

| Переменная | Значение |
|------------|----------|
| `BOT_TOKEN` | Токен от @BotFather |
| `OPENAI_API_KEY` | Ваш ключ OpenAI |
| `ADMIN_TELEGRAM_IDS` | `123456789` или `@username` |
| `DATABASE_URL` | `file:/data/dev.db` |
| `MINI_APP_URL` | `https://ваш-домен.railway.app` |

**Без `DATABASE_URL` приложение не запустится** — Prisma не найдёт базу данных.

`MINI_APP_URL` укажите после первого деплоя — Railway покажет URL в **Settings** → **Networking** → **Generate Domain**.

---

## Volume для SQLite

База данных должна храниться на постоянном диске:

1. **Project** → **Ваш сервис** → **Variables** (или **Settings**)
2. Вкладка **Volumes** → **Add Volume**
3. Mount Path: `/data`
4. Убедитесь, что `DATABASE_URL=file:/data/dev.db`

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
