# Avito Messages WebSocket Monitor

Сервис мониторинга сообщений Авито в реальном времени. Backend на Nest.js с Puppeteer парсит сообщения из ЛК Авито и транслирует их на React-фронтенд через WebSocket.

## Архитектура

```
[Avito ЛК] <--Puppeteer--> [Nest.js Backend] <--WebSocket--> [React Frontend]
                                    |
                            [Cloudflared Tunnel]
                                    |
                            [Внешний доступ]
```

## Быстрый старт

### 1. Установка зависимостей

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Первичная настройка (получение cookies)

При первом запуске необходимо авторизоваться в Авито вручную:

```bash
cd backend
cp .env.example .env
# Убедитесь, что PUPPETEER_HEADLESS=false в .env
npm run start:dev
```

Откроется окно браузера. Перейдите на avito.ru, авторизуйтесь. После успешного входа cookies сохранятся автоматически в `backend/cookies/avito-cookies.json`.

### 3. Запуск

**Backend:**
```bash
cd backend
npm run start:dev
```

**Frontend:**
```bash
cd frontend
npm run dev
```

Откройте http://localhost:5173 — фронтенд подключится к WebSocket и будет отображать новые сообщения из чата в реальном времени.

### 4. Настройка переменных окружения

| Переменная | Описание | По умолчанию                   |
|---|---|--------------------------------|
| `AVITO_COOKIES_PATH` | Путь к файлу cookies | `./cookies/avito-cookies.json` |
| `PUPPETEER_HEADLESS` | Headless режим браузера | `false`                        |
| `TARGET_CHAT_NAME` | Имя чата для мониторинга | `Анжела`                       |
| `POLL_INTERVAL` | Интервал опроса (мс) | `5000`                         |

## Docker

```bash
# Сначала получите cookies локально (см. шаг 2)
# Затем:
docker-compose up --build
```

Frontend: http://localhost
Backend WS: ws://localhost:3000

## Cloudflared Tunnel

Для внешнего доступа:

```bash
# Установите cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
cloudflared tunnel --url http://localhost:80
```

Полученную ссылку можно использовать для доступа извне.

## Стек

- **Backend:** Nest.js, Puppeteer, Socket.IO, EventEmitter2
- **Frontend:** React, Vite, Socket.IO Client
- **Инфраструктура:** Docker, Nginx, Cloudflared
