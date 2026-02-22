# Разные GitHub-аккаунты для разных проектов

## SSH для Sales-Boost (аккаунт gptchathype-creator)

Используется отдельный SSH-ключ — другие проекты не затронуты.

### Уже настроено

- Ключ: `~/.ssh/id_ed25519_salesboost`
- `~/.ssh/config`: Host `github.com-salesboost`
- Remote: `git@github.com-salesboost:gptchathype-creator/Sales-Boost.git`

### Осталось сделать

**1. Добавить ключ в GitHub**

1. Войдите в GitHub под аккаунтом **gptchathype-creator**
2. Settings → SSH and GPG keys → **New SSH key**
3. Title: `Sales-Boost` (или любое)
4. Key: вставьте этот ключ:

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHnuN9JlJceq9cxxFEAzxX4O+7vom4e384GANAIhBnqe gptchathype-creator
```

5. Нажмите **Add SSH key**

**2. Push**

```bash
cd /Users/paveline/Desktop/Cursor\ Projects/Sales-Boost
git push -u origin main
```

---

## Вариант через HTTPS (если понадобится)

```bash
git remote set-url origin https://gptchathype-creator@github.com/gptchathype-creator/Sales-Boost.git
```
