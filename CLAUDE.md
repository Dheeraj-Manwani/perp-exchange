# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A full-stack perpetual cryptocurrency exchange built as a Turborepo monorepo with a Next.js frontend, Express.js backend, PostgreSQL database, and Redis.

## Development Setup

### Prerequisites

Start local services before running any app:
```bash
docker-compose up -d   # starts PostgreSQL 16 on :5432 and Redis 7 on :6379
```

### Commands

Run from the monorepo root using `pnpm`:

```bash
pnpm dev          # run all apps in watch mode
pnpm build        # build all apps and packages
pnpm lint         # lint all packages
pnpm check-types  # TypeScript type check all packages
pnpm format       # Prettier format (TS, TSX, MD)
```

Run in a specific app/package directory:
```bash
cd apps/api && pnpm dev    # Express API on port 3001 (tsx watch)
cd apps/web && pnpm dev    # Next.js on port 3000
cd packages/db && pnpm db:generate  # regenerate Prisma client after schema changes
```

### Environment Variables

`packages/db/.env`:
```
DATABASE_URL=postgresql://perp:perp@localhost:5432/perpdb
```

`apps/api/.env`:
```
ACCESS_TOKEN_SECRET=
REFRESH_TOKEN_SECRET=
REDIS_URL=redis://localhost:6379
NODE_ENV=development
PORT=3001
```

### Database Migrations

```bash
cd packages/db
npx prisma migrate dev    # apply migrations in dev
npx prisma migrate deploy # apply migrations in production
```

## Architecture

### Monorepo Structure

```
apps/
  api/    - Express.js REST API
  web/    - Next.js 16 frontend (stub)
packages/
  db/     - Prisma client and schema (shared)
  schema/ - Zod validation schemas (shared)
  ui/     - Shared React component library
  eslint-config/      - Shared ESLint config
  typescript-config/  - Shared tsconfig files
```

### API Layer (`apps/api`)

Follows a strict 3-layer pattern — do not skip layers:

```
Controller → Service → Repository
```

- **Controller** (`src/controller/`): Parses and validates request, calls service, sends response
- **Service** (`src/service/`): Business logic, orchestrates repositories
- **Repository** (`src/repository/`): Direct Prisma queries, no business logic

Supporting modules:
- `src/middleware/` — auth middleware (JWT verification), error handler
- `src/lib/env.ts` — typed environment variable loading
- `src/lib/response.ts` — standardized response format
- `src/errors/` — `AppError` class with typed error codes
- `src/types/` — shared TypeScript types

### Authentication Flow

- Sign up/in endpoints issue a short-lived JWT access token and a long-lived refresh token
- Access token is sent in the `Authorization: Bearer <token>` header
- Refresh token is stored in an `httpOnly` secure cookie
- Token secrets come from `ACCESS_TOKEN_SECRET` / `REFRESH_TOKEN_SECRET` env vars

### Database Schema (`packages/db/prisma/schema.prisma`)

Core models for the exchange:
- `User` — accounts, KYC status, password hash
- `Market` — trading pairs (slug + symbol)
- `Order` — limit/market orders with buy/sell side and status
- `Fill` — execution records linking taker and maker orders
- `Position` — leveraged positions with entry price, margin, P&L
- `Balance` — per-user per-asset balances (available + locked)
- `Transaction` — audit log (deposits, withdrawals, trades, funding)

### Shared Schema Package (`packages/schema`)

Zod schemas used for input validation across API and web. Add new schemas here; import in both the API controller and web form validation.

### Turborepo Task Graph

`db:generate` must complete before `build`. The `turbo.json` encodes this dependency — always run `pnpm db:generate` after modifying `schema.prisma` before building.
