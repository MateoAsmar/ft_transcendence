# ft_transcendence

> A modern, multiplayer Pong experience built around real-time play, tournaments, and a social player community.

Transcendence brings the arcade classic into a full-stack web app. Create an account, challenge friends or matchmaking opponents, play against an AI, and follow your performance across profiles, match history, and leaderboards.

## Highlights

- **Multiple ways to play** — local, online multiplayer, AI matches, and bracket tournaments.
- **Real-time game sessions** — Socket.IO/WebSocket sessions with a dedicated game engine service.
- **A player community** — profiles, avatars, friend requests, presence, and game invitations.
- **Competitive tracking** — match history, player statistics, and leaderboards.
- **Account security** — registration and login, Google OAuth, and optional email one-time codes for two-factor authentication.
- **Responsive interface** — a TypeScript single-page app with responsive layouts and touch-friendly game controls.

## Architecture

The browser app is served behind Nginx. The API gateway handles HTTP endpoints and delegates domain work to gRPC services. Kafka carries asynchronous events, and the services use a shared SQLite database volume.

~~~mermaid
flowchart LR
  U[Browser] -->|HTTPS :8080| N[Nginx reverse proxy]
  N --> F[Vite frontend :5173]
  N -->|/api| A[Fastify API gateway :8000]
  N -->|/socket.io| G[Game sessions :4002]
  A -->|gRPC| P[Profile service]
  A -->|gRPC| R[Friends service]
  A -->|gRPC| S[Statistics service]
  A -->|gRPC| M[Matchmaking service]
  A -->|gRPC| G
  P --> D[(SQLite volume)]
  R --> D
  S --> D
  G --> D
  P -. events .-> K[Kafka + ZooKeeper]
  R -. events .-> K
  G -. events .-> K
  M -. events .-> K
~~~

### Services and stack

| Area | Technologies |
| --- | --- |
| Frontend | TypeScript, Vite, Tailwind CSS, Chart.js, Socket.IO client |
| API | Node.js, TypeScript, Fastify, JWT, gRPC |
| Realtime game | Socket.IO, custom Pong game engine |
| Domain services | Profile, friends, statistics, matchmaking, game sessions |
| Messaging | Apache Kafka, ZooKeeper |
| Data | SQLite (better-sqlite3) |
| Delivery | Docker Compose, Nginx, HTTPS for local development |

## Run locally with Docker

### Requirements

- Docker Engine with the Docker Compose plugin (or Docker Desktop with Compose)
- make is optional; the commands below use Docker Compose directly

### 1. Configure the environment

From the repository root:

~~~sh
cp .env.example .env
# docker-compose.yml also loads this file; keep it empty unless you add private overrides.
touch .env.secrets
mkdir -p database/dbdata
~~~

On PowerShell, use:

~~~powershell
Copy-Item .env.example .env
New-Item -ItemType File -Path .env.secrets -Force
New-Item -ItemType Directory -Path database/dbdata -Force
~~~

Set a unique, long JWT_SECRET in .env before using the app. Google OAuth and SendGrid email delivery are optional; add their credentials to .env.secrets if you enable those integrations. Keep .env and .env.secrets private and do not commit them.

### 2. Build and start the stack

~~~sh
docker compose up -d --build
~~~

The first build downloads container images and can take a few minutes. Nginx creates a self-signed certificate for local development on first start, so your browser may show a certificate warning.

### 3. Open the app

Visit **[https://localhost:8080](https://localhost:8080)**. Register an account to get started. The frontend and backend are also published on ports 5173 and 8000 for development and API debugging.

### 4. Stop the stack

~~~sh
docker compose down
~~~

The database files live in database/dbdata and remain there when containers stop. To inspect service logs or health:

~~~sh
docker compose ps
docker compose logs -f
# For one service, for example:
docker compose logs -f api-gateway
~~~

## Configuration

The committed .env.example documents the environment keys used by the Compose stack. The main settings are:

| Variable | Purpose |
| --- | --- |
| JWT_SECRET | Signs API and game-session authentication tokens; set a unique random value. |
| KAFKA_BROKERS | Broker list used by backend services (local Compose default: kafka:9092). |
| HOST_DB_PATH | Host directory mounted for the shared SQLite database (default: ./database/dbdata). |
| GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET | Optional Google sign-in credentials. Register https://localhost:8080/api/oauth/google/callback as an authorized redirect URI when using the local HTTPS endpoint. |
| SENDGRID_API_KEY, SENDGRID_FROM_EMAIL | Optional SendGrid settings used to deliver 2FA email codes. |
| PUBLIC_BACKEND_URL, PUBLIC_FRONTEND_URL | Optional public URLs for OAuth redirects when running outside the local defaults. |

## Project layout

~~~text
.
├── backend/
│   ├── api-gateway/             # HTTP API, authentication, OAuth, route aggregation
│   ├── friends-service/         # Friends, requests, presence and invitations
│   ├── game-session-service/    # Pong engine, real-time sessions and tournaments
│   ├── matchmaking-service/     # Queue and opponent matching
│   ├── profile-service/         # Player profiles and avatar operations
│   ├── stats-service/           # Match statistics and leaderboard data
│   └── protos/                  # Shared gRPC contracts
├── database/                    # SQLite schema, initialization and default avatar
├── frontend/                    # TypeScript SPA and game UI
├── nginx/                       # HTTPS reverse proxy for local development
├── docker-compose.yml
├── Makefile
└── .env.example
~~~

## Development notes

- The recommended local path is through Nginx at https://localhost:8080; this routes normal API traffic and game WebSocket sessions to their respective services.
- The project uses a shared SQLite database file mounted under database/dbdata. Back up that directory before removing or resetting local data.
- Google OAuth and email-based 2FA require credentials from their providers. Core local play does not require either integration.
- The frontend package exposes a production build command (`npm run build` from `frontend/`); backend packages expose TypeScript build commands.
