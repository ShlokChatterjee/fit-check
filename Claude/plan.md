# Wardrobe Agent — V1 Product & Engineering Plan

## 1. Project Vision

Build an AI-powered personal wardrobe agent.

The application understands what the user already owns and helps them:

- build a digital wardrobe
- discover outfits using existing clothes
- combine existing clothes into new outfits
- learn their style preferences
- identify useful additions to their wardrobe
- avoid recommending items they already own

The central product principle is:

> Use what the user already owns before recommending something new.

---

# 2. V1 Goal

V1 should prove the complete core product loop:

1. User signs in with Google.
2. User builds a digital wardrobe.
3. User can add clothing through image uploads.
4. User can optionally select existing photos from Google Photos.
5. AI identifies clothing items from those images.
6. User reviews and confirms the detected items.
7. Confirmed items become part of the user's wardrobe.
8. User can browse and manage their wardrobe.
9. User can request an outfit.
10. The system generates outfits primarily from their existing wardrobe.
11. User can like/dislike outfits.
12. Feedback influences future recommendations.
13. The application identifies wardrobe gaps.
14. The application can suggest categories/types of items that would improve the wardrobe.

---

# 3. Product Principles

## 3.1 Existing wardrobe first

The application should never recommend a purchase simply because it is fashionable.

Before suggesting something new, the system should understand:

- what the user owns
- what they already have multiple versions of
- what combinations are possible
- what categories are missing
- what new item would create additional useful combinations

---

## 3.2 AI assists; application logic controls

AI should be used for:

- image understanding
- clothing identification
- clothing attribute extraction
- natural-language interpretation
- explanations
- subjective ranking where appropriate

Normal application code should control:

- authentication
- authorization
- ownership
- database operations
- hard constraints
- candidate generation
- scoring
- preference updates
- duplicate prevention

The LLM must not be the source of truth for:

- whether a user owns something
- whether an item belongs to a user
- whether an outfit violates a hard constraint
- what gets permanently saved to the database

---

## 3.3 AI output must be reviewable

AI detections are predictions.

The application must not silently add every detected item.

Example:

User uploads:

> Photo of user wearing a navy jacket, white shirt, jeans and sneakers.

AI returns:

- Navy jacket
- White shirt
- Blue jeans
- White sneakers

The user sees:

> We found 4 clothing items.

and can:

- confirm
- edit
- remove
- reject

before saving them.

---

# 4. V1 Features

## Feature 1 — Google Authentication

Use Google as the only authentication provider.

Requirements:

- Google sign-in
- Google sign-out
- persistent authenticated session
- protected application routes
- authenticated user ID used for all application data access

Do not implement:

- password authentication
- username/password
- email magic links
- additional OAuth providers

---

# Feature 2 — Digital Wardrobe

Users can:

- view all wardrobe items
- filter by category
- open an item
- edit an item
- favorite an item
- deactivate an item
- delete an item
- add new items

Initial categories:

- Tops
- Bottoms
- Shoes
- Outerwear
- Accessories

---

# Feature 3 — Clothing Ingestion

The application supports two main ingestion methods.

### Method A — Device upload

User uploads a photo from their device.

### Method B — Google Photos

User selects photos from Google Photos using the Google Photos Picker API.

The application must NOT scan the user's entire Google Photos library.

The user explicitly chooses the photos they want to share.

---

# Feature 4 — Multi-item Image Detection

One image may contain multiple clothing items.

Example:

```text
Photo
 ├── Jacket
 ├── T-shirt
 ├── Jeans
 └── Sneakers
```

Requirements:

- accept one image containing one or more clothing items
- detect each distinct clothing item separately
- return a structured list of detected items
- extract per-item attributes (category, color, pattern, material guess, style descriptors)
- attach the source image (and a per-item crop where feasible) to each detection
- assign each detection a confidence signal the UI can surface

The detection output is a **prediction set**, never a wardrobe write. Nothing is saved at this stage.

Do not implement:

- automatic saving of detected items
- background scanning of images the user did not submit
- brand or exact-product identification (V1 identifies *type/attributes*, not SKUs)

---

# Feature 5 — Detection Review & Confirmation

Every detected item passes through a human review step before it enters the wardrobe.

The user sees the detected items and can, per item:

- confirm
- edit attributes (category, color, name, descriptors)
- remove a false detection
- add an item the AI missed

Requirements:

- present all detections from an ingestion event as a reviewable batch
- allow per-item confirm / edit / remove
- allow manual addition of a missed item
- only confirmed items are written to the wardrobe
- writes are attributed to the authenticated user
- prevent obvious duplicates at confirmation time (flag likely matches to existing wardrobe items)

Duplicate prevention is **application logic**, not an AI decision.

Do not implement:

- silent auto-confirmation
- bulk-accept without the user seeing the items at least once

---

# Feature 6 — Outfit Generation

The user requests an outfit; the system assembles one **primarily from items the user already owns**.

Request input is a **single natural-language request** ("something for a rainy work day", "casual weekend brunch"). There are no structured selectors in V1.

Generation responsibilities split as follows:

- **AI interprets** the natural-language request into a structured intent (occasion, weather, formality, style descriptors) and, separately, ranks candidates and writes a short human-readable explanation.
- **Application logic** applies that interpreted intent as **hard constraints**, generates candidate outfits by combining owned items across required slots (e.g. top + bottom + shoes, plus optional outerwear/accessory), and enforces those constraints.

The LLM interprets language; it does not decide ownership, enforce constraints, or invent items.

Presentation:

- present **one outfit at a time**, not a grid
- the application builds an internal **ranked candidate set**; the UI shows the top candidate first
- a **"show another"** action advances to the next-ranked candidate

Requirements:

- generate a complete outfit from owned, active items
- require at least one active item in each required slot (top, bottom, shoes) before generation is offered
- respect hard constraints (category coverage, interpreted weather/formality, deactivated items excluded)
- return each outfit as a set of specific wardrobe item references (not free text)
- include a brief explanation per outfit
- never fabricate an item the user does not own

Hard constraints and candidate generation are **application logic**. The LLM must not invent items or claim ownership.

Do not implement:

- structured occasion/weather/formality selectors (V1 is prompt-only)
- outfits composed of items not in the wardrobe
- purchase-first recommendations in the generation flow (gaps are a separate feature)

---

# Feature 7 — Outfit Feedback

Users react to generated outfits so the system can learn.

Requirements:

- like / dislike at the outfit level (the core signal in V1)
- persist feedback linked to the outfit, its constituent items, and the user
- feedback is available as a signal for future generation and preference learning
- allow requesting a fresh outfit after feedback
- treat "show another" (skipping the current outfit) as a **soft-negative** signal, weaker than an explicit dislike

Do not implement:

- per-item thumbs within an outfit (V1 feedback is outfit-level only)
- mandatory feedback (an outfit can be viewed without rating)
- free-text-only feedback as the primary signal in V1 (structured like/dislike is the core signal)

---

# Feature 8 — Preference Learning

Feedback shapes future recommendations.

The system maintains a lightweight, inspectable preference model per user, derived from likes/dislikes:

- preferred and disliked colors
- preferred and disliked categories/styles
- item-level and combination-level signals (which pairings tested well or poorly)

Requirements:

- update preference signals from outfit feedback
- feed preference signals into candidate scoring/ranking
- keep preferences owned per user and inspectable by application code

Preference updates and scoring are **application logic**. The LLM may explain preferences but is not the store of record for them.

Do not implement:

- opaque model state the application cannot read or reset
- cross-user preference sharing

---

# Feature 9 — Wardrobe Gap Analysis

The system identifies what the wardrobe is missing — only after understanding what it contains.

Gap analysis runs **only when the user asks for it** — it is not surfaced proactively on the wardrobe view in V1.

Requirements:

- run on request (an explicit "suggest what's missing" action), not automatically
- require the same baseline as generation (at least one active item per required slot) before producing suggestions
- analyze the wardrobe for under-covered categories and low-combination items
- identify gaps whose filling would unlock the most additional valid outfits
- suggest **categories/types** of items (e.g. "a neutral pair of chinos"), not specific products or brands
- explain why each suggested category helps (which combinations it enables)
- never suggest something the user already owns a sufficient version of

Gap analysis is grounded in the actual wardrobe. Suggestions are additive reasoning, not fashion trends.

Do not implement:

- proactive gap hints on the wardrobe view (V1 is on-request only)
- specific-product or brand recommendations
- affiliate/shopping links
- suggestions that duplicate items the user already owns

---

# 5. Out of Scope for V1

- password / email / non-Google authentication
- brand or exact-product identification
- in-app purchasing, checkout, or shopping links
- social features (sharing, following, feeds)
- multi-user / shared wardrobes
- mobile native apps (V1 is web)
- full Google Photos library scanning

---

# 6. V1 Success Criteria

V1 is successful when a user can, end to end:

1. sign in with Google
2. add clothing via upload or Google Photos Picker
3. see AI-detected items and confirm them into their wardrobe
4. browse and manage the wardrobe
5. request an outfit and receive one built from owned items with an explanation
6. like/dislike outfits and see feedback influence later recommendations
7. receive at least one grounded wardrobe-gap suggestion (category-level)

Throughout, the application — not the LLM — remains the source of truth for ownership, persistence, and hard constraints.

---

# 7. Resolved Product Decisions

These forks were considered and decided for V1:

- **Outfit request UX** → **natural-language prompt only**. No structured selectors. The AI interprets the prompt into a structured intent; application code applies that intent as hard constraints.
- **Outfits per request** → **one at a time**, backed by an internal ranked candidate set, with a "show another" action to advance. No grid of options.
- **Feedback granularity** → **outfit-level like/dislike only**. No per-item thumbs in V1. "Show another" counts as a soft-negative signal.
- **Gap suggestions** → **on request only**. Not surfaced proactively on the wardrobe view.
- **Minimum wardrobe baseline** → outfit generation and gap analysis require **at least one active item in each required slot (top, bottom, shoes)**. Below that, prompt the user to add the basics.

Deferred to a later version (not V1): structured request selectors, multi-outfit grids, per-item feedback, proactive gap hints.