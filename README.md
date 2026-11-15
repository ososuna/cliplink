# ClipLink

ClipLink turns long URLs into short ones at [cliplink.app](https://cliplink.app). Anyone can create a Link. Users who sign in with Google or GitHub can also name, find, and delete the Links they own.

It is one [Astro](https://astro.build) app on Vercel, with Postgres on Neon through [Drizzle](https://orm.drizzle.team).

## Getting started

Requirements: Node 24, pnpm 10, and Docker for the local database.

```sh
pnpm install
cp .env.example .env
pnpm db:dev       # Postgres 17 in Docker on port 5433
pnpm db:migrate
pnpm dev          # http://localhost:4321
```

To sign in locally, fill in `BETTER_AUTH_SECRET` and the development Google and GitHub OAuth apps in `.env` (see `.env.example` for the callback URLs).

## Scripts

| Script             | What it does                                                 |
| ------------------ | ------------------------------------------------------------ |
| `pnpm check`       | `astro check`, ESLint, Prettier check, and Vitest            |
| `pnpm e2e`         | Playwright against a production build                        |
| `pnpm format`      | Format everything with Prettier                              |
| `pnpm db:generate` | Generate a migration from `src/db/schema.ts` into `drizzle/` |
| `pnpm db:migrate`  | Apply migrations to `DATABASE_URL`                           |

A pre-commit hook lints and formats staged files.

## Deploy

Vercel deploys `main` to cliplink.app and every PR to a preview with its own Neon database branch. Each build migrates its database first (`vercel.json`).

## Docs

- `GLOSSARY.md`: the words Cliplink uses for its domain.
- `docs/adr/`: architecture decisions.
- `AGENTS.md`: instructions for coding agents.
