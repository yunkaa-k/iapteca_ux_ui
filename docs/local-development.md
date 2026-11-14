# Локальная разработка iApteca на Windows

## Схема

- Next.js запускается в Windows через `pnpm dev`.
- Единственный Docker Compose service — MongoDB 7.0.
- Replica Set называется `rs0`, его локальный участник объявлен как `localhost:27017`.
- Только loopback Windows публикует порт `127.0.0.1:27017`.
- Данные хранятся в отдельном именованном Docker volume `iapteca_ux_ui_mongo_data`; существующий `iapteca_mongo_data` предыдущего проекта не используется.
- У MongoDB есть отдельная административная учётная запись и пользователь приложения с ролью `readWrite` на `iapteca`.
- Внутренний key file Replica Set хранится локально в `.local/mongo-keyfile`; контейнер копирует его в data volume и выставляет режим `0400`.

## Требования

- Windows 10/11 и Docker Desktop с запущенным Linux Engine.
- Node.js 22, pnpm и установленные зависимости проекта.
- Свободный порт `27017`.
- Для backup — MongoDB Database Tools (`mongodump`) в PATH Windows.

Проект не запускает MongoDB, Kubernetes или отдельные сервисы приложения на production. Production-переменные и база в эту локальную конфигурацию не входят.

## Первичная настройка секретов

Сначала запустите Docker Desktop. Из PowerShell в корне проекта выполните:

```powershell
./scripts/setup-local.ps1
```

Скрипт проверяет Docker Engine и наличие MongoDB volume. Если найден существующий volume, setup прекращается и не меняет данные. Если `.env.local` или key file уже есть, файлы также не перезаписываются.

При чистой установке скрипт создаёт:

- `.env.local` с URI приложения и случайными локальными паролями;
- `.local/mongo-keyfile` с локальным случайным ключом Replica Set.

Секретные значения не выводятся. Не копируйте в эти файлы старые Kubernetes credentials. `.env.example` содержит только демонстрационные placeholders и не годится для подключения.

Docker Compose автоматически читает `.env`, но здесь используется `.env.local`, поэтому передавайте его явно через `--env-file`.

## Запуск MongoDB

Сначала можно проверить синтаксис Compose, не выводя раскрытые переменные:

```powershell
docker compose --env-file .env.local config --quiet
```

Затем запускайте базу:

```powershell
docker compose --env-file .env.local up -d mongo
docker compose --env-file .env.local ps
```

Healthcheck подключается административным пользователем, идемпотентно инициирует `rs0`, если Replica Set ещё не настроен, и становится healthy после выбора PRIMARY. Инициализационный скрипт создаёт пользователя приложения только при первом заполнении пустого data volume и не сбрасывает уже существующие credentials.

URI использует `localhost:27017`, `replicaSet=rs0` и `authSource=iapteca`. Docker hostname `mongo` из Windows не используется. Параметр `directConnection=true` по умолчанию не нужен: URI Replica Set указывает участника, который объявляет тот же доступный из Windows hostname `localhost`. Если MongoDB Driver не сможет обнаружить единственный Docker endpoint, для локальной разработки допустимо добавить `directConnection=true`; тогда клиент будет направлять операции только в этот единственный узел. После такой настройки обязательно повторите проверку транзакций.

## Запуск приложения и проверка

В отдельном PowerShell окне:

```powershell
pnpm dev
```

Приложение Next.js загружает `.env.local` автоматически. Чтобы проверить Replica Set, Mongoose-подключение через URI приложения и транзакцию с abort:

```powershell
pnpm exec node scripts/test-mongo-transactions.mjs
```

Проверка создаёт уникальную временную коллекцию, вставляет тестовую запись внутри транзакции, отменяет её, убеждается, что запись не сохранилась, затем удаляет коллекцию. Выводит только результат проверки и безопасное имя/код ошибки, без URI и паролей.

Для проверки существующего Next.js `connectDB` после запуска приложения можно запросить API каталога:

```powershell
Invoke-WebRequest http://localhost:3000/api/categories
```

## Остановка и повторный запуск

Остановить контейнер, сохранив данные:

```powershell
docker compose --env-file .env.local stop mongo
```

После перезагрузки компьютера запустите Docker Desktop, затем:

```powershell
docker compose --env-file .env.local up -d mongo
pnpm dev
```

Named volume `iapteca_ux_ui_mongo_data` переживает остановку и пересоздание контейнера. Старый `iapteca_mongo_data` не подключается, не переименовывается и не удаляется. Скрипт настройки проверяет только наличие целевого `iapteca_ux_ui_mongo_data` и останавливается, если он уже существует, чтобы не менять его данные без отдельной проверки. **Не используйте `docker compose down -v`**, если хотите сохранить новую базу: этот параметр удаляет Compose volume и его данные.

## Резервная копия

Backup сохраняется вне контейнера в игнорируемый Git каталог `backups/`. После установки MongoDB Database Tools выполните:

```powershell
./scripts/backup-mongo.ps1
```

Скрипт читает URI из `.env.local` без его вывода и допускает только локальную `iapteca` с `rs0`. Файл создаётся в формате gzip-архива `mongodump`. Храните копию отдельно от проекта/компьютера, если данные важны. Не добавляйте backup в Git. Для восстановления сначала сохраните текущий volume и проверьте целевую базу; не восстанавливайте архив поверх неизвестных данных.

## Переменные и секреты

`.env.local` нужен Next.js и Compose; Compose запускайте только с `--env-file .env.local`. `.env.example` демонстрирует имена необходимых переменных. Не помещайте реальные значения в README, логи, скриншоты, GitHub Actions или командные примеры.

Локальные key file, env-файл, MongoDB data и backup исключены из Git и Docker build context.
