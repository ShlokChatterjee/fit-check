# Wardrobe Agent

An AI-powered personal wardrobe agent. It digitizes the clothes you already own,
builds outfits from them, learns your taste, and only then flags genuine gaps.
Guiding principle: **use what the user already owns before recommending anything new.**

See `Claude/plan.md` (product) and `Claude/implementation.md` (technical) for the
full V1 specification.

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript
- Tailwind CSS v4
- Auth.js v5 (Google OAuth only) with the Prisma adapter
- PostgreSQL · Prisma ORM 7 (pg driver adapter)
- Vitest + Testing Library

## Prerequisites

1. **PostgreSQL** database and its connection string.
2. **Google OAuth client** (Google Cloud Console → APIs & Services → Credentials).
   Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`.

## Setup

```bash
npm install
cp .env.example .env        # then fill in the values
npx auth secret             # generates AUTH_SECRET (or paste your own)
npx prisma generate         # generate the client (app/generated/prisma)
npx prisma migrate dev      # create the schema in your database
npm run dev
```

Open http://localhost:3000 and sign in with Google.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (also typechecks) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Run the Vitest suite |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:generate` | `prisma generate` |

## V1 status

Implemented in this foundation:

- **Feature 1 — Google authentication** (Auth.js + Prisma, server-side route protection)
- **Feature 2 — Digital wardrobe** (list/filter, add, edit, favorite, deactivate, delete)
- Full data model (`prisma/schema.prisma`) for all V1 features
- AI abstraction (`lib/ai/`) with typed, deterministic stubs

Deferred (need the AI provider key and Google Photos access):

- Clothing ingestion + multi-item detection (Features 3–4)
- Detection review/confirmation (Feature 5)
- Outfit generation, feedback, preference learning, gap analysis (Features 6–9)
