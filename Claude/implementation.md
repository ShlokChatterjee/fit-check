
# Wardrobe Agent — V1 Implementation Specification

This document is the technical source of truth for V1 implementation.

Claude Code must read this file before implementing major features.

When implementing integrations, prefer current official documentation over tutorials, blog posts, or old examples.

Before using a framework/API:

1. Check the installed package version.
2. Check the current official documentation.
3. Do not copy deprecated APIs.
4. Keep provider-specific code isolated.
5. Do not introduce unnecessary dependencies.

---

# 1. Technology Stack

## Frontend / Application

- Next.js
- React
- TypeScript
- App Router

Use Server Components by default.

Use Client Components only where browser interaction/state requires them.

---

## Styling

- Tailwind CSS

Use the current Tailwind CSS setup for the installed version.

Do not assume the old Tailwind v3 configuration.

---

## Authentication

- Auth.js
- Google OAuth
- Prisma adapter/database persistence

Google is the only authentication provider in V1.

---

## Database

- PostgreSQL
- Prisma ORM 7

Important:

Prisma Next is currently an Early Access product.

For this application, use the generally available Prisma 7 ORM unless the project explicitly decides otherwise.

Do not migrate to Prisma Next during V1 implementation.

---

## Google Photos

- Google Photos Picker API
- Google OAuth 2.0

Use the Picker API rather than unrestricted Google Photos library access.

---

## AI

Use a vision-capable LLM provider.

The provider must be hidden behind an internal abstraction.

Example:

```text
lib/ai/
    provider.ts             // provider client + config (default: a vision-capable Claude model)
    analyze-clothing.ts     // image -> detected items
    interpret-request.ts    // NL outfit request -> structured intent
    generate-outfit-explanation.ts
    types.ts
```

Rules for the AI layer:

- No route handler, server action, or component imports a provider SDK directly.
- All AI calls go through `lib/ai/*` functions with typed inputs and outputs.
- AI functions return plain typed data — never database writes, never ownership decisions.
- The default provider is a vision-capable Claude model, selected via config so it can be swapped without touching callers.

---

# 2. Data Model (Prisma)

PostgreSQL via Prisma ORM 7. All user-owned rows carry a `userId` and are always queried scoped to the authenticated user.

Auth.js owns the identity tables (`User`, `Account`, `Session`, `VerificationToken`) via the Prisma adapter. Do not hand-roll these.

Application models:

```prisma
model WardrobeItem {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  category    Category
  name        String
  color       String?
  pattern     String?
  material    String?
  descriptors String[]          // free-form style tags
  imageUrl    String
  cropUrl     String?
  isFavorite  Boolean  @default(false)
  isActive    Boolean  @default(true)   // deactivate = exclude from generation, keep history
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  outfitItems OutfitItem[]
  @@index([userId, category])
}

enum Category {
  TOPS
  BOTTOMS
  SHOES
  OUTERWEAR
  ACCESSORIES
}

model IngestionEvent {
  id         String      @id @default(cuid())
  userId     String
  source     SourceType                 // DEVICE_UPLOAD | GOOGLE_PHOTOS
  imageUrl   String
  status     IngestStatus @default(PENDING_REVIEW)
  detections Detection[]
  createdAt  DateTime    @default(now())
  @@index([userId])
}

enum SourceType { DEVICE_UPLOAD GOOGLE_PHOTOS }
enum IngestStatus { PENDING_REVIEW CONFIRMED DISCARDED }

model Detection {
  id           String   @id @default(cuid())
  eventId      String
  event        IngestionEvent @relation(fields: [eventId], references: [id])
  category     Category
  name         String
  color        String?
  descriptors  String[]
  confidence   Float
  cropUrl      String?
  status       DetectionStatus @default(PENDING)  // PENDING | CONFIRMED | REJECTED
  createdItemId String?        // set when confirmed into a WardrobeItem
}

enum DetectionStatus { PENDING CONFIRMED REJECTED }

model Outfit {
  id          String       @id @default(cuid())
  userId      String
  request     String?                        // the natural-language request
  context     Json?                          // occasion / weather / formality
  explanation String?                        // AI-generated
  score       Float?                         // app-computed rank score
  items       OutfitItem[]
  feedback    Feedback?
  createdAt   DateTime     @default(now())
  @@index([userId])
}

model OutfitItem {
  id             String       @id @default(cuid())
  outfitId       String
  outfit         Outfit       @relation(fields: [outfitId], references: [id])
  wardrobeItemId String
  wardrobeItem   WardrobeItem @relation(fields: [wardrobeItemId], references: [id])
  slot           Category
}

model Feedback {
  id        String   @id @default(cuid())
  userId    String
  outfitId  String   @unique
  outfit    Outfit   @relation(fields: [outfitId], references: [id])
  liked     Boolean
  createdAt DateTime @default(now())
}

model Preference {
  id        String   @id @default(cuid())
  userId    String   @unique
  data      Json                              // inspectable weights: colors, categories, pairings
  updatedAt DateTime @updatedAt
}
```

Notes:

- `Preference.data` is application-owned JSON the code reads and writes directly — not opaque model state.
- Deactivation is a flag, not a delete, so outfit history stays intact.

---

# 3. Application Architecture

```text
app/
    (auth)/                       // sign-in
    (app)/                        // protected routes
        wardrobe/
        outfits/
        ingest/
    api/                          // route handlers where needed (uploads, picker callback)
lib/
    ai/                           // provider abstraction (see §1)
    db/                           // prisma client
    auth/                         // Auth.js config + session helpers
    wardrobe/                     // CRUD + duplicate detection
    outfits/                      // candidate generation, constraints, scoring
    preferences/                  // preference updates + scoring inputs
    gaps/                         // wardrobe gap analysis
```

Rules:

- Server Components by default. Client Components only for interactive review, filters, and feedback controls.
- Mutations use Server Actions or route handlers; every one re-derives the user from the session and scopes queries by `userId`.
- Business logic lives in `lib/*`, not in components or route files.

---

# 4. Server Actions / API Surface

| Action | Type | Responsibility |
| --- | --- | --- |
| `createIngestionEvent` | action | store submitted image, create event (status `PENDING_REVIEW`) |
| `analyzeIngestion` | action | call `lib/ai/analyze-clothing`, persist `Detection[]` |
| `confirmDetections` | action | write confirmed detections to `WardrobeItem`, run duplicate check |
| `listWardrobe` / `updateItem` / `toggleFavorite` / `deactivateItem` / `deleteItem` | action | wardrobe CRUD |
| `generateOutfit` | action | AI interprets prompt → app builds ranked candidates → serve top → persist `Outfit` |
| `showAnotherOutfit` | action | advance to next-ranked candidate; record a soft-negative skip signal |
| `submitFeedback` | action | store `Feedback`, trigger preference update |
| `getGapSuggestions` | action | run `lib/gaps` analysis over the active wardrobe |

Every action enforces ownership: the row's `userId` must equal the session user, or it returns not-found.

---

# 5. AI Abstraction Contract

`lib/ai/analyze-clothing.ts`

- Input: image (URL or bytes).
- Output: `DetectedItem[]` — `{ category, name, color?, descriptors[], confidence, cropHint? }`.
- Never persists. Never claims ownership.

`lib/ai/interpret-request.ts`

- Input: the user's natural-language outfit request.
- Output: a structured intent — `{ occasion?, weather?, formality?, descriptors[] }`.
- Interpretation only. The app decides how the intent maps to hard constraints; the LLM does not enforce anything.

`lib/ai/generate-outfit-explanation.ts`

- Input: the app-selected outfit (owned items + interpreted intent).
- Output: a short explanation string.
- Ranking may be AI-assisted, but the candidate set is supplied by application code.

`lib/ai/types.ts` holds these shared types. Callers depend on the types, not the provider.

---

# 6. Outfit Generation (Application Logic)

Request input is a **natural-language prompt only** — no structured selectors. The LLM does not assemble outfits from scratch. The pipeline:

0. **Guard**: require at least one active item in each required slot (top, bottom, shoes). If not met, return a "add the basics" prompt instead of generating.
1. **Interpret**: `lib/ai/interpret-request` turns the prompt into a structured intent `{ occasion?, weather?, formality?, descriptors[] }`. Application code — not the LLM — maps that intent to hard constraints.
2. **Load** active, owned items for the user.
3. **Generate candidates**: combine items across required slots (top + bottom + shoes; optional outerwear/accessory).
4. **Apply hard constraints**: category coverage, interpreted weather/formality, exclude deactivated items. Candidates failing a hard constraint are dropped.
5. **Score** each candidate using preference signals (§7) plus simple coherence heuristics.
6. **Rank** into an internal candidate list; optionally let AI re-rank the top-N and write the explanation.
7. **Serve one at a time**: present the top-ranked candidate. `showAnotherOutfit` advances to the next candidate and records a soft-negative skip.
8. **Persist** the served `Outfit` with concrete `OutfitItem` references — never free text.

Invariant: every item in a generated outfit is a real `WardrobeItem` owned by the user. The LLM cannot introduce an item.

---

# 7. Preference Model & Scoring

- `Preference.data` holds inspectable weights: liked/disliked colors, categories/styles, and pairing signals.
- On `submitFeedback`, application code adjusts these weights (like → reinforce constituent attributes/pairings; dislike → penalize).
- `showAnotherOutfit` applies a **weaker** penalty than an explicit dislike (soft-negative skip).
- `generateOutfit` reads these weights into candidate scoring.
- No opaque per-user ML state; everything is readable and resettable by the app.

---

# 8. Wardrobe Gap Analysis (Application Logic)

- Runs **on request only** (`getGapSuggestions`), never proactively on the wardrobe view in V1.
- Requires the same baseline as generation (≥1 active item per required slot) before producing suggestions.
- Compute category coverage and per-item combination counts over the active wardrobe.
- Identify categories/types whose addition would unlock the most new valid outfits.
- Return **category-level** suggestions with an explanation of which combinations they enable.
- Never suggest a type the user already owns a sufficient version of. No brands, products, or shopping links.

AI may phrase the explanation; the gap itself is computed from wardrobe data.

---

# 9. Google Photos Ingestion

- Use the **Google Photos Picker API** — the user explicitly selects photos.
- Never request or use full-library read scopes.
- Selected photo bytes/URLs flow into the same `IngestionEvent` → detection → review pipeline as device uploads.

---

# 10. Auth & Authorization

- Auth.js with Google OAuth only; sessions persisted via the Prisma adapter.
- All protected routes require a valid session.
- Authorization is enforced in application code on every read and write: `row.userId === session.user.id`. The LLM is never consulted for authorization.

---

# 11. Environment / Configuration

Required environment variables (names indicative):

```text
DATABASE_URL
AUTH_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
AI_PROVIDER_API_KEY
AI_MODEL                 // default: a vision-capable Claude model
BLOB_STORAGE_*           // image storage for uploads/crops
```

Do not commit secrets. Keep provider keys server-side only.

---

# 12. Non-Negotiables

- The LLM is never the source of truth for ownership, persistence, or hard constraints.
- Nothing is written to the wardrobe without passing through user review.
- All user data access is scoped to the authenticated user.
- Provider-specific code stays inside `lib/ai/`.
- Use Prisma 7 (GA), not Prisma Next, in V1.