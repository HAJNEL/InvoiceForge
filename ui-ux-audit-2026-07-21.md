# InvoiceForge UI/UX Audit — 2026-07-21

**Status: GitHub issues NOT filed.** This sandbox has no `gh` authentication and no GitHub MCP connector available, so I could not create issues programmatically as the task requires. Findings below are fully drafted and ready to file as-is — once GitHub access is available, each section can be pasted directly into `gh issue create --label ...`.

Repo: `HAJNEL/InvoiceForge` (detected from `git remote get-url origin`)

## Duplicate check

4 open issues already exist and overlap with app-wide themes found in this audit — **not re-filed**:

| # | Title |
|---|---|
| [#1](https://github.com/HAJNEL/InvoiceForge/issues/1) | Deleting an invoice has no confirmation dialog |
| [#2](https://github.com/HAJNEL/InvoiceForge/issues/2) | Form labels are not programmatically associated with their inputs |
| [#3](https://github.com/HAJNEL/InvoiceForge/issues/3) | Icon-only action buttons rely on title instead of aria-label |
| [#4](https://github.com/HAJNEL/InvoiceForge/issues/4) | Modal overlays lack dialog semantics and keyboard Escape support |

Everything below is new — it does not duplicate #1–#4 (invoice-list delete, label association, title-vs-aria-label, and modal dialog semantics respectively).

Suggested labels to create if missing: `accessibility`, `ui`, `ux`, `responsive`, `priority: critical`, `priority: high`, `priority: medium`, `priority: low`, `ui-audit` (marker for this batch). Existing repo labels: `bug`, `documentation`, `duplicate`, `enhancement`, `good first issue`, `help wanted`, `invalid`, `question`, `wontfix`.

---

## Issue A — UX Flow: Non-functional buttons mislead users (Invoice Form, Invoice Detail, Main Layout)

**Labels:** `bug`, `ux`, `priority: critical`, `ui-audit`

Several primary-looking buttons across invoice screens and the header render fully styled with icons but have no handler wired up. Users click them expecting an action and get silent failure.

- [ ] **`src/features/invoices/InvoiceForm.tsx` — "Save Invoice" button does nothing (lines 74-77)**
  A fully filled-out invoice form has no submit handler at all — no persistence, no navigation, no feedback.
  ```tsx
  <button className="inline-flex items-center gap-2 px-6 py-2 bg-brand-primary text-white rounded-lg text-sm font-bold tracking-widest uppercase hover:bg-zinc-800 transition-colors shadow-lg shadow-zinc-200">
    <Save className="w-4 h-4" />
    Save Invoice
  </button>
  ```
  Fix: wire to a real submit handler that persists via Firestore (mirror the pattern in `ExtractionReview.tsx`), or if this screen is dead code superseded by the Bulk Import → Extraction Review flow, remove the route/link to it so users can't reach a dead end.
  Acceptance criteria: clicking Save either persists the invoice and navigates to the detail view, or the route no longer exists in the app.

- [ ] **`src/features/invoices/InvoiceDetail.tsx` — "Send Invoice", "Export Audit Trail", "View Metadata" have no `onClick` (lines 215-218, 480-486)**
  ```tsx
  <button className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-semibold hover:bg-zinc-800 transition-colors shadow-lg shadow-zinc-200">
    <Send className="w-4 h-4" />
    Send Invoice
  </button>
  ```
  Fix: implement the handlers, or mark as `disabled title="Coming soon"` until they are, so the UI doesn't promise capability it doesn't have.
  Acceptance criteria: buttons either perform their labeled action or are visibly disabled with an explanatory title.

- [ ] **`src/layout/MainLayout.tsx` — header search input has no `onChange`/state (lines 139-143)**
  Looks like a working search box; typing into it does nothing.
  Fix: wire to actual search/filter state, or remove until implemented.

- [ ] **`src/layout/MainLayout.tsx` (lines 171) / `src/layout/MobileLayout.tsx` (lines 61-68) — notification bell is non-functional**
  Fix: wire to a real notifications panel or remove the affordance.

**Severity:** critical (InvoiceForm save), medium (rest)

---

## Issue B — Accessibility: Keyboard-inaccessible clickable elements (Dashboard, Invoice List)

**Labels:** `bug`, `accessibility`, `priority: high`, `ui-audit`

- [ ] **`src/features/dashboard/components/StatCard.tsx` — clickable KPI cards are `<div onClick>` with no keyboard support (lines 18-27)**
  Used for Fuel / Partially Complete / Delivered / Invoiced dashboard cards — all primary navigation actions — but keyboard-only users cannot activate them (no `role`, `tabIndex`, or `onKeyDown`).
  ```tsx
  <div
    onClick={onClick}
    className={cn(
      "saas-card p-6 group transition-all relative overflow-hidden",
      onClick ? "cursor-pointer hover:border-brand-primary ..." : "..."
    )}
  >
  ```
  Fix:
  ```tsx
  <div
    onClick={onClick}
    role={onClick ? "button" : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    className={cn(...)}
  >
  ```
  Acceptance criteria: card is focusable via Tab and activates on Enter/Space; verify with keyboard-only navigation.

- [ ] **`src/features/invoices/InvoiceList.tsx` — table rows use `<tr onClick>` to expand line items with no keyboard access (lines 457-463)**
  ```tsx
  <tr onClick={() => toggleInvoiceExpanded(invoice.id)} className={cn("group hover:bg-zinc-50/70 ...", ...)}>
  ```
  Fix: add `role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') toggleInvoiceExpanded(invoice.id); }}`, or move the toggle to a dedicated icon button inside the row (cleaner a11y semantics — a `<tr>` shouldn't itself be a button).
  Acceptance criteria: row expand/collapse is reachable and operable via keyboard.

**Severity:** high

---

## Issue C — Accessibility: `src/index.css` has no global focus-visible style

**Labels:** `bug`, `accessibility`, `priority: medium`, `ui-audit`

- [ ] Many interactive elements across the app (MainLayout nav/buttons, InvoiceList table rows, StatCard's clickable div) apply no `focus:` ring classes at all, and there is no global fallback in `src/index.css`, so keyboard focus is effectively invisible in those spots.
  Fix — add a global fallback:
  ```css
  @layer base {
    :focus-visible {
      outline: 2px solid var(--color-brand-accent);
      outline-offset: 2px;
    }
  }
  ```
  Acceptance criteria: Tab through the app; every interactive element shows a visible focus ring even where component-level focus classes are missing.

**Severity:** medium

---

## Issue D — UX Flow: Destructive actions without confirmation (Todo Board, Trip Form)

**Labels:** `bug`, `ux`, `priority: high`, `ui-audit`

Note: invoice-list delete is already tracked in #1. These are separate, unconfirmed destructive actions elsewhere in the app.

- [ ] **`src/features/todos/TodoBoard.tsx` — delete task has no confirmation (line 134)**
  ```tsx
  <button onClick={() => deleteTask(task.id)} className="p-1.5 rounded-lg text-zinc-400 hover:bg-red-100 hover:text-red-600 transition-colors" title="Delete">
  ```
  Fix:
  ```tsx
  <button onClick={() => { if (confirm(`Delete task "${task.title}"?`)) deleteTask(task.id); }} title="Delete task">
  ```

- [ ] **`src/features/invoices/InvoiceListMobile.tsx` — mobile delete action menu also has no confirmation (line 354)**
  ```tsx
  { label: 'Delete', icon: Trash2, destructive: true, onClick: () => deleteInvoice(invoice.id) }
  ```
  Fix: route through a confirm step before calling `deleteInvoice` (same fix as #1, applied to the mobile actions-menu variant, which #1's desktop-only fix won't cover).

- [ ] **`src/features/trips/TripForm.tsx` — "Clear All" wipes all trip stops with no confirmation (lines 982-990)**
  ```tsx
  <button type="button" onClick={() => { setStops([]); setFormData(prev => ({ ...prev, invoiceIds: [] })); }} className="text-[10px] font-black uppercase text-red-500 border border-red-100 hover:bg-red-50 px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap">
    Clear All
  </button>
  ```
  Fix: `onClick={() => { if (confirm('Remove all stops from this trip?')) { setStops([]); setFormData(prev => ({ ...prev, invoiceIds: [] })); } }}`

- [ ] **`src/features/invoices/BulkImport.tsx` — "Clear all" removes all queued files with no confirmation (lines 441-446)**
  Fix: same confirm-gate pattern.

Acceptance criteria for all: clicking the destructive action shows a confirm step (dialog or `window.confirm`) before data loss; canceling leaves state unchanged.

**Severity:** high

---

## Issue E — Accessibility/Bug: Copy-paste `title` error on Truck modal close button

**Labels:** `bug`, `accessibility`, `priority: medium`, `ui-audit`

- [ ] **`src/features/trucks/TruckList.tsx` line 451 — close (X) button's `title` reads unrelated marketing copy**
  ```tsx
  <button title='Comprehensive Fleet Management' onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-400 transition-all">
  ```
  This was clearly copy-pasted from adjacent subtitle text. Screen-reader users hovering/focusing this X button hear "Comprehensive Fleet Management" instead of "Close."
  Fix: `title="Close"`
  Acceptance criteria: hovering/focusing the button announces "Close", not fleet-management copy.

- [ ] **`src/layout/MainLayout.tsx` line 171 — notification bell has placeholder `title='ok'`**
  ```tsx
  <button title='ok' className="p-2 text-zinc-500 hover:bg-zinc-100 rounded-lg transition-colors relative">
  ```
  Fix: `title="Notifications"`

**Severity:** medium

---

## Issue F — UX Flow: Missing error states for failed data fetches (Dashboard, Reports)

**Labels:** `bug`, `ux`, `priority: medium`, `ui-audit`

- [ ] **`src/features/dashboard/Dashboard.tsx` (lines 46-48, 96-103) — only `loading` is checked from `useInvoices`/`useTrucks`/`useTrips`, no `error` branch**
  If a fetch fails, the dashboard silently renders as if there's no data, with no indication anything went wrong — inconsistent with `InvoiceList.tsx`/`InvoiceDetail.tsx`, which do show error UI.
  Fix: destructure `error` from each hook and render an error banner/retry affordance when present (mirror `InvoiceList.tsx`'s pattern).

- [ ] **`src/features/reports/ReportsPage.tsx` (lines 30, 77-84) — same gap for `useInvoices`**
  Fix: same pattern.

Acceptance criteria: simulate a failed fetch (e.g. throw in the hook during dev) and confirm an error message renders instead of an empty/zeroed view.

**Severity:** medium

---

## Issue G — Accessibility: Missing `title` attributes on buttons/selects (project convention)

**Labels:** `bug`, `accessibility`, `priority: low`, `ui-audit`

Per this project's CLAUDE.md, all `<button>` and `<select>` elements must have a `title` attribute. Coverage is inconsistent — good in `ProductList.tsx`, `TripList.tsx`, `TruckList.tsx` (mostly), `TeamMembersSection.tsx` (mostly); missing in the files below. (Distinct from issue #3, which argues existing `title` usage should also gain `aria-label` — this issue is about buttons with **no** accessible name at all.)

- [ ] `src/features/auth/Login.tsx` lines 182, 205 — submit / Google sign-in buttons
- [ ] `src/features/auth/Register.tsx` line 99 — submit button
- [ ] `src/features/auth/TeamRegister.tsx` lines 250, 299-305, 348 — Google sign-up, show/hide password toggle, Activate Portal Access
- [ ] `src/layout/MainLayout.tsx` lines 115-121, 124-129 — logout button, sidebar collapse/expand toggle
- [ ] `src/features/invoices/InvoiceList.tsx` lines 262, 321, 339, 349, 745-748, 799-816 — filter toggle, group-by options, Reset All, Apply, status-dialog option buttons, Cancel/Save
- [ ] `src/features/invoices/InvoiceForm.tsx` lines 67-73 — Discard button, line-item qty/price inputs use vague `placeholder='qty'` instead of a label
- [ ] `src/features/invoices/ExtractionReview.tsx` lines 413-445 — Back, Save as Draft, Confirm & Save/Update Invoice
- [ ] `src/components/EditInvoiceModal.tsx` lines 555-562 — Cancel/Save footer buttons
- [ ] `src/components/PartialConfirmModal.tsx` lines 306-320 — Cancel/Confirm footer buttons
- [ ] `src/features/settings/SettingsPage.tsx` lines 322, 567, 605, 850, 857 — Save Key, Save, Save geocode, Cancel logo, Apply Brand Logo
- [ ] `src/features/settings/components/TeamMembersSection.tsx` lines 805-817 — delete-confirm Cancel/Remove
- [ ] `src/features/trips/TripForm.tsx` lines 973-979, 1158-1163, 1181-1186 — Add Stop, back-navigation buttons
- [ ] `src/features/todos/TodoBoard.tsx` lines 145-154, 183-188 — group-collapse toggle, Add task
- [ ] `src/features/products/components/ProductList.tsx` lines 459-465 — "Auto-Import From Existing Invoices" empty-state CTA
- [ ] `src/features/trucks/TruckList.tsx` line 488 — "Fleet Status" `<select>` has `aria-label` but no `title`
- [ ] `src/features/invoices/BulkImport.tsx` lines 394-410, 441-446 — extraction-mode toggle, Clear all
- [ ] `src/features/trips/TripListComponents/StatusBadge.tsx` line 25 — `title` is `undefined` when non-interactive; should default to a readable status string

Fix pattern (repeat per item): add a concise `title="..."` describing the action, e.g. `title="Sign in to your account"`, `title="Toggle filter panel"`, `title="Save changes"`.

Acceptance criteria: every `<button>`/`<select>` in the files above has a non-empty, descriptive `title` attribute.

**Severity:** low (aggregate — high volume, low individual risk)

---

## Issue H — UX Flow / Visual: Miscellaneous smaller findings

**Labels:** `bug`, `ux`, `priority: low`, `ui-audit`

- [ ] **`src/features/auth/Login.tsx` line 167 — "Forgot?" link is a dead `href="#"`**
  ```tsx
  <a href="#" className="text-[10px] uppercase font-bold tracking-widest text-brand-accent hover:underline">Forgot?</a>
  ```
  Fix: point to a real forgot-password route, or remove the link until the flow exists — a dead `#` link that jumps to page top is a common source of user confusion.

- [ ] **`src/features/auth/Register.tsx` line 21 — Company name field is collected but never persisted**
  ```tsx
  // We could store the company info in a user document here if needed
  ```
  User fills in a field that silently has no effect. Fix: persist it, or remove the field.

- [ ] **`src/features/trips/TripList.tsx` lines 1285-1310 — inline delete-confirm pattern (trash icon → pulsing red checkmark) is visually inconsistent with the confirm-dialog pattern used elsewhere (InvoiceDetail, TeamMembersSection)**
  Not a missing safeguard (it does confirm), but a UX pattern inconsistency. Fix: standardize on one destructive-confirmation pattern app-wide (dialog vs. inline toggle) — pick one and apply consistently; flagging for a follow-up design decision rather than prescribing a specific direction here.

**Severity:** low

---

## Summary

| Group | Category | Page/Component | Findings | Highest Severity |
|---|---|---|---|---|
| A | UX Flow | InvoiceForm / InvoiceDetail / MainLayout | 4 | Critical |
| B | Accessibility | Dashboard StatCard / InvoiceList | 2 | High |
| C | Accessibility | index.css (global) | 1 | Medium |
| D | UX Flow | TodoBoard / InvoiceListMobile / TripForm / BulkImport | 4 | High |
| E | Accessibility/Bug | TruckList / MainLayout | 2 | Medium |
| F | UX Flow | Dashboard / ReportsPage | 2 | Medium |
| G | Accessibility | App-wide (17 files) | 17 | Low |
| H | UX Flow / Visual | Login / Register / TripList | 3 | Low |

**Not re-filed (already open):** #1 (invoice delete confirm), #2 (label association), #3 (title vs aria-label), #4 (modal dialog semantics).

## Next step to actually file these

This sandbox couldn't authenticate `gh` or reach a GitHub MCP connector, so nothing was created on GitHub. To file these as real issues:
1. Connect a GitHub MCP/connector in this app, or provide a `gh auth login` token in the sandbox environment, then
2. Re-run this task — it will pick up this draft, skip #1–#4, and create issues A–H with the labels noted above.

Alternatively, paste each section's title + body directly into `gh issue create` manually.
