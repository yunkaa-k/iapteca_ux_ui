# iApteca

iApteca — учебный проект интернет-аптеки на Next.js, React, TypeScript и MongoDB. Приложение запускается непосредственно в Windows; Docker Compose используется только для локальной MongoDB.

## Требования

- Windows и Docker Desktop с Linux containers.
- Node.js 22 и pnpm.
- MongoDB Database Tools на Windows — только для создания backup.

## Локальный запуск

1. Запустите Docker Desktop и убедитесь, что у проекта ещё нет MongoDB volume. Скрипт настройки остановится, если найдёт существующий volume, чтобы не затронуть его данные.
2. В PowerShell из корня проекта выполните `./scripts/setup-local.ps1`. Скрипт создаст `.env.local` и локальный Replica Set key file, не показывая их значения.
3. Проверьте Compose без вывода переменных: `docker compose --env-file .env.local config --quiet`.
4. Запустите MongoDB: `docker compose --env-file .env.local up -d mongo`.
5. Дождитесь статуса `healthy`: `docker compose --env-file .env.local ps`.
6. Запустите приложение: `pnpm dev` и откройте <http://localhost:3000>.

Подробная инструкция, Replica Set, транзакции, остановка и backup описаны в [`docs/local-development.md`](docs/local-development.md).

## Проверки

```powershell
pnpm test:run
pnpm exec tsc --noEmit
pnpm lint
```

Проверить MongoDB, `rs0` и транзакцию с последующим abort можно командой `pnpm exec node scripts/test-mongo-transactions.mjs` после запуска MongoDB.

## Структура

- `src/app/` — страницы Next.js App Router и API Routes.
- `src/components/` — интерфейсные компоненты.
- `src/lib/` — Mongoose-модели, подключение и состояние Zustand.
- `scripts/` — только локальные утилиты настройки и проверки MongoDB.

Не добавляйте локальные credentials, key files, базу данных или backup в Git.
