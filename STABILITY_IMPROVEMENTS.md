# InvoiceForge — Stability Improvement Plan

_Generated 2026-06-20 from a full-application scan. Findings are ordered by severity. Each item lists the impact, the location(s), and a concrete recommendation. Line numbers reflect the state of the code at scan time and may drift as the code changes._

## Executive summary

The app is a React 19 + Vite SPA backed by Firebase (Auth/Firestore/Storage) with an Express server (`server.ts`) that proxies LLM extraction and performs Firebase-Admin actions. The biggest stability risks are **not** in day-to-day feature logic but in cross-cutting infrastructure:

1. **Unauthenticated admin endpoints** allow account takeover / deletion.
2. **No React error boundary** — a single render throw white-screens the whole app.
3. **Firestore security rules** leave several collections publicly readable and disable all schema validation.
4. **`useAuth` is a per-component hook, not a shared context** — 13 concurrent auth listeners run reconciliation writes, causing races and redundant writes.
5. **Unbounded Firestore listeners** with no pagination will degrade as data grows.

Addressing the Critical and High sections below will materially harden the app.

---

## 🔴 Critical

### C1. Admin endpoints have no authentication or authorization
- **Where:** `server.ts:901` (`/api/team-members/reset-password`), `server.ts:931` (`/api/team-members/delete-account`)
- **Impact:** Any caller who can reach the server can reset **any** user's password (full account takeover) or delete **any** auth account, given only a `userId`. There is no `verifyIdToken`, no caller-identity check, and no ownership check. This is the single most serious issue.
- **Fix:**
  - Require an `Authorization: Bearer <idToken>` header; verify with `admin.auth().verifyIdToken()`.
  - Authorize the action: confirm the caller is the **owner** of the team member being modified (look up `team_members/{userId}.ownerId === caller.uid`).
  - Add rate limiting and audit logging on these routes.

### C2. No React Error Boundary
- **Where:** `src/main.tsx`, `src/App.tsx` (no `ErrorBoundary` / `componentDidCatch` anywhere in the codebase).
- **Impact:** Any uncaught render error (e.g. a malformed invoice doc, a `.toLowerCase()` on `undefined`, a map render bug) unmounts the entire React tree and shows a blank white screen with no recovery.
- **Fix:** Add a top-level `ErrorBoundary` around `<App />` (and ideally per-route) that renders a fallback UI with a "reload / report" action. Given the many `||` fallback chains in data mapping, partial failures are likely.

### C3. Gemini API key shipped to the browser bundle
- **Where:** `vite.config.ts:11` (`'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)`) consumed by `src/lib/gemini.ts:5` (`new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })`).
- **Impact:** Vite inlines this value into client-side JS, so the Gemini key is downloadable by any user. Leads to quota theft, unexpected billing, and key revocation churn.
- **Fix:** Move all Gemini calls behind the Express server (like the OpenAI/xAI/Llama flows already are) and never expose the key to the client. Same scrutiny applies to `GOOGLE_MAPS_PLATFORM_KEY` (`SettingsPage.tsx:9`) — restrict it by HTTP referrer in the Google Cloud console at minimum.

### C4. Firestore rules: public reads + disabled validation
- **Where:** `firestore.rules`
  - `team_members` `get`/`list`: `if true` (lines 149–150) — all team member docs (emails, names, ownerIds) are world-readable.
  - `settings` `read`: `if true` (line 135) — all settings docs world-readable.
  - `trips/{tripId}` `get`: `if true` (line 121) — any trip readable by anyone.
  - `stock/{document=**}` `read, write: if isSignedIn()` (line 182) — **any** signed-in user can read/write **all** tenants' stock (cross-tenant data leak + tampering).
  - `isValidInvoice`/`isValidClient`/…/`isValidProduct` all `return true` (lines 40–50) — schema validation is fully disabled, so malformed/oversized documents can be written and later crash the UI.
- **Impact:** PII exposure, cross-tenant data access, and corrupt documents that destabilize the client.
- **Fix:** Scope public `if true` reads to `isSignedIn()` + ownership/team checks; partition `stock` by `userId`/`ownerId`; reintroduce real (but lenient) field validation in the `isValid*` helpers (type + size checks on the fields the UI actually depends on).

---

## 🟠 High

### H1. `useAuth` is a non-shared hook (duplicate auth listeners + write races)
- **Where:** `src/core/hooks/useAuth.ts`, imported and called in **13** components/hooks.
- **Impact:** Each `useAuth()` call registers its own `onAuthStateChanged` listener and independently runs the team-member **reconciliation writes** (`writeBatch`/`updateDoc`, lines 46–68). On login this fires up to ~13× concurrently → write races, redundant Firestore reads/writes, and inconsistent `isTeamMember` timing across the tree.
- **Fix:** Convert to a single `AuthProvider` (React Context) mounted once at the root; have all consumers read from context. Move the one-time reconciliation out of the listener (or guard it so it runs once per session).

### H2. `handleFirestoreError` stringifies PII and breaks error handling
- **Where:** `src/lib/firestore-errors.ts:29-48`
- **Impact:** It builds an object containing the user's `email`, `uid`, provider emails, etc., then `throw new Error(JSON.stringify(errInfo))`. Consequences: (a) user PII is embedded into error messages/logs and surfaced to the UI; (b) callers that do `handleFirestoreError(...); return false;` (e.g. `useInvoices.ts:50,90`) never reach `return false` because the function always throws; (c) UI code that shows `err.message` displays raw JSON.
- **Fix:** Log diagnostics internally (without PII, or to a secured sink), and either return a typed error or throw a clean, user-safe `Error`. Decide one contract (throw **or** return) and apply consistently.

### H3. Unbounded Firestore listeners / no pagination
- **Where:** 58 `onSnapshot`/`getDocs` calls across 21 files; only 9 uses of `limit`/`orderBy` (mostly `limit(1)` in auth). E.g. `useInvoices.ts:103` queries the whole `invoices` collection for the user with no limit and sorts client-side.
- **Impact:** Memory growth, slow renders, and rising Firestore read costs as invoices/trips/stock accumulate. Large snapshots also increase the chance of a render-time crash (see C2).
- **Fix:** Add `orderBy` + `limit` with cursor pagination (`startAfter`) to list queries; consider server-side aggregation for dashboards instead of pulling full collections into the client.

### H4. Server trusts unvalidated request bodies and LLM/PDF output
- **Where:** `server.ts` endpoints (`:205`, `:283`, `:746`, `:821`) use manual `as` casts and `JSON.parse(...)` on model output (`:257`, `:382`, `:796`) without schema validation. `zod` is already a dependency but unused on the server.
- **Impact:** Malformed bodies or non-JSON LLM responses throw inside handlers; without consistent guards this can return 500s or crash a request path. Parsing attacker-controlled PDF/LLM text without bounds is also a DoS vector.
- **Fix:** Define `zod` schemas for each endpoint's request body and for the expected extraction shape; `safeParse` and return 400 on failure. Add body-size limits and timeouts on outbound LLM calls.

### H5. `alert()` used for errors and as control flow
- **Where:** 25 `alert()`/`confirm()` calls across 11 files (e.g. `useInvoices.ts:76`, `TripForm.tsx`, `StockScreen.tsx`, `TeamDashboard.tsx`).
- **Impact:** `alert`/`confirm` block the main thread, can be suppressed by browsers, and are being used inside data-mutation logic (`updateInvoice`) as a flow gate. Poor UX and brittle on mobile.
- **Fix:** Replace with a non-blocking toast/modal system and return structured results from mutation functions so callers control UX.

---

## 🟡 Medium

### M1. Status normalization logic duplicated across the app
- **Where:** Legacy-status normalization is copy-pasted in `StockScreen.tsx`, `TeamDashboard.tsx`, `TripForm.tsx`, `InvoicePin.tsx`, `MapComponent.tsx`, `InteractiveTripMap.tsx`, `useDashboardAnalytics.ts`, `InvoiceList.tsx`, `InvoiceDetail.tsx`.
- **Impact:** The recent color/label-map consolidation fixed the lookup tables, but the `if (status === 'assembly') status = 'assembled'`-style logic still lives in many files. Divergence here produces inconsistent filtering/coloring/counting bugs.
- **Fix:** Create a single `normalizeStatus(raw): CanonicalStatus` util (plus a `CanonicalStatus` union type) and route every consumer through it. Normalize on write so new data is always canonical.

### M2. Pervasive `any` typing
- **Where:** ~84 `any` occurrences in `.tsx` (plus more in `.ts`); Firestore doc mapping relies on loose `Record<string, unknown>` with long `||` fallbacks (`useInvoices.ts:109-133`).
- **Impact:** Type safety is bypassed exactly where untrusted Firestore/LLM data enters the app, which is where most runtime crashes originate.
- **Fix:** Introduce typed document interfaces + a parsing layer (zod or hand-written guards) at the Firestore boundary; enable stricter lint against `any`.

### M3. Inconsistent Firestore field naming handled by long fallback chains
- **Where:** `useInvoices.ts:113-132` (e.g. `d.subTotal ?? d.sub_total ?? d.summary?.sub_total ?? …`).
- **Impact:** snake_case/camelCase/`summary.*` variants coexist in stored documents; each read must guess. Fragile and a frequent source of "shows 0 / Unknown" bugs.
- **Fix:** Pick one canonical schema, write a one-time migration, and normalize at write time. Keep read fallbacks only as a temporary bridge.

### M4. Unreliable date sorting on free-form strings
- **Where:** `useInvoices.ts:117,137` — `date` may be `'N/A'` or vary in format, yet sorting uses `b.date.localeCompare(a.date)`.
- **Impact:** Incorrect ordering and unstable lists; `'N/A'` entries sort unpredictably.
- **Fix:** Store an ISO timestamp (or Firestore `Timestamp`) and sort on that; format for display separately.

### M5. Fragile global modal-detection effect
- **Where:** `src/App.tsx:37-86` — a `MutationObserver` on the whole `document.body` subtree that matches modals by Tailwind class strings (`.bg-black\\/60`, etc.).
- **Impact:** Runs on every DOM mutation (perf cost) and silently breaks if class names change. Coupling app behavior to CSS class names is brittle.
- **Fix:** Track modal open/close via React state/context (a `useModal` provider), not DOM scraping.

### M6. Startup Firestore probe with no surfaced state
- **Where:** `src/main.tsx:8-17` — `testConnection()` does a server read on every load and only `console.error`s on offline.
- **Impact:** Extra read each load and no user-visible signal when Firebase is unreachable; the app proceeds and fails later in less obvious ways.
- **Fix:** Remove the probe or fold connectivity status into the `AuthProvider`/error boundary with a visible offline state.

### M7. No structured logging
- **Where:** 168 `console.*` calls across 40 files.
- **Impact:** Noisy production console, leaks data into the browser console (see H2), and no log levels or filtering.
- **Fix:** Introduce a small logger with levels that is silenced/forwarded appropriately in production; strip debug logs from the client build.

---

## 🟢 Low / housekeeping

### L1. No automated tests
- **Where:** No `*.test.*`/`*.spec.*` files; `package.json` `scripts` has only `lint` (no `test`).
- **Impact:** Refactors (like the status consolidation) rely entirely on manual verification; regressions are easy to introduce in the 1,000+ line components.
- **Fix:** Add Vitest + React Testing Library; start with the data-mapping/normalization utilities and the status logic (high value, low effort).

### L2. Very large components
- **Where:** `StockScreen.tsx` (1,754), `TeamTripDetail.tsx` (1,458), `TripForm.tsx` (1,428), `TeamDashboard.tsx` (1,074), `TruckList.tsx` (961).
- **Impact:** Hard to reason about, high regression risk, slow to render/test.
- **Fix:** Decompose into smaller components/hooks; extract pure logic into testable utilities.

### L3. Stray dev scripts committed to root
- **Where:** `find_unlabeled.mjs`, `fix_labels.mjs`.
- **Impact:** Clutter; unclear whether safe to run; may reference stale assumptions.
- **Fix:** Move to a `scripts/` dir with a README, or remove if obsolete.

### L4. `firebase-blueprint.json` status enum drift
- **Where:** `firebase-blueprint.json` (status enum) vs. actual written statuses.
- **Impact:** The blueprint omitted `invoiced` (recently added) and had typo/duplicate variants — a sign the data-model doc isn't the source of truth.
- **Fix:** Treat one place (ideally a shared TS type) as the canonical status definition and generate/validate the rest from it.

---

## Suggested order of work

1. **C1** (auth on admin endpoints) and **C4** (lock down rules) — security-critical, relatively contained.
2. **C2** (error boundary) and **C3** (move Gemini key server-side) — small, high-leverage.
3. **H1** (AuthProvider context) — removes a whole class of races; touches many files but mechanical.
4. **H2** (error-handling contract) and **H4** (server validation) — make failures predictable.
5. **H3** (pagination) — needed before data volume grows.
6. Medium items as part of normal feature work; start **M1** (centralize status normalization) since the groundwork is already done.
7. **L1** (tests) incrementally, prioritizing the utilities touched by the above.
