# Как залить проект на GitHub

## Шаг 1. Создайте репозиторий на GitHub

1. Зайдите на [github.com](https://github.com) и войдите в аккаунт
2. Нажмите **+** (правый верхний угол) → **New repository**
3. Укажите имя: `Sales-Boost` (или любое другое)
4. Выберите **Private** или **Public**
5. **Не** ставьте галочки "Add README" и "Add .gitignore" — репозиторий должен быть пустым
6. Нажмите **Create repository**

## Шаг 2. Выполните команды в терминале

Откройте терминал в папке проекта и выполните:

```bash
# 1. Инициализация git
git init

# 2. Добавить все файлы
git add .

# 3. Первый коммит
git commit -m "Initial commit: Sales Boost bot"

# 4. Переименовать ветку в main (если нужно)
git branch -M main

# 5. Подключить ваш репозиторий (замените YOUR_USERNAME и REPO_NAME на свои)
git remote add origin https://github.com/YOUR_USERNAME/Sales-Boost.git

# 6. Отправить код
git push -u origin main
```

**Важно:** Замените `YOUR_USERNAME` на ваш логин GitHub, `Sales-Boost` — на имя репозитория, если вы назвали его иначе.

## Шаг 3. Авторизация

При `git push` GitHub может запросить логин и пароль. Используйте:
- **Personal Access Token** вместо пароля (Settings → Developer settings → Personal access tokens)
- Или **GitHub Desktop** / **GitHub CLI** для упрощённой авторизации
