# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev        # start with tsx watch on src/index.ts (port 3001)
pnpm build      # tsc compile to dist/
pnpm start      # run compiled output
pnpm lint       # eslint src/
```

There is no test runner configured yet.

## Architecture

Strict 3-layer pattern — never skip layers or call across them sideways:

```
Controller → Service → Repository
```

- **Controller** (`src/controller/`): Parse/validate request body with Zod (via `@repo/schema`), call one service function, send response using helpers from `src/lib/response.ts`. Never import Prisma directly.
- **Service** (`src/service/`): All business logic lives here. Orchestrates repositories, throws `AppError` for domain errors.
- **Repository** (`src/repository/`): Prisma queries only — no logic, no error mapping.

## Key Conventions

**Routes** (`src/routes/`): Two routers exported from `index.ts` — `unProtectedRoutes` and `protectedRoutes`. All routes mounted after `authenticate` middleware are protected. Add new route files to one of these two routers.

**Error handling**: Throw `AppError(statusCode, ErrorCode, message)` from services. The global `errorHandler` middleware (`src/middleware/errorHandler.ts`) catches `AppError`, `ZodError`, and all Prisma error types and maps them to consistent JSON responses. Prisma errors P2002/P2025/P2003 are already mapped — add others to `PRISMA_ERROR_MAP` as needed.

**Response format**: Always use `ok()`, `created()`, or `noContent()` from `src/lib/response.ts`. Shape: `{ success: true, data, message? }`. Errors: `{ success: false, code, message }`.

**Auth tokens**: Access token (15 min, in `Authorization: Bearer` header) contains `sub`, `username`, `kycStatus`, `isActive`. Refresh token (7 days, in `httpOnly` cookie named `refresh`) contains only `sub`. The `authenticate` middleware sets `req.userId` from the access token after DB lookup.

**Env vars**: All accessed via `src/lib/env.ts` — add new required vars with `requireEnv()`, optional ones with a fallback. Never read `process.env` directly elsewhere.

**Zod validation schemas** live in `packages/schema` — import `AuthInput` / `authInput` from `@repo/schema`. Add new schemas there, not inline in controllers.

**`req.userId`** is typed in `src/types/express.d.ts` as `string | undefined` — it is guaranteed to be set in any protected route handler after `authenticate` runs.
