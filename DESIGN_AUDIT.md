# DESIGN_AUDIT.md — Automated UI/UX Audit

Instructions for an AI agent (Claude) performing an automated UI/UX audit of this repository. This file is designed for unattended scheduled runs: do NOT wait for human confirmation before filing issues.

If the `ui-ux-review` skill is available, invoke it and follow it, with the overrides in this file (autonomous mode, gh CLI, duplicate check). If not available, follow the steps below directly.

## Scope

Review all frontend source code in this repo: HTML, CSS, JS/TS, React/Vue/Svelte components, Flutter widgets, Razor/Blazor views — whatever UI code exists. Skip: `node_modules`, `dist`, `build`, `.dart_tool`, generated files, and vendored code. Code review only — do not attempt to run the app.

## Checklist

### Accessibility
- Semantic HTML: buttons are `<button>`, not `<div onClick>`; headings in logical order
- Every form input has an associated label
- Images have meaningful `alt` text (or `alt=""` if decorative)
- Color contrast meets WCAG AA (4.5:1 normal text, 3:1 large text)
- Interactive elements keyboard-reachable with visible focus states
- ARIA used correctly, not redundantly
- Error messages associated with their field (`aria-describedby`)
- No keyboard traps

### Visual / Design Consistency
- Spacing on a consistent scale (multiples of 4/8px), not arbitrary values
- Consistent typography scale and color usage (no scattered one-off hex values)
- Responsive at ~375px / ~768px / ~1024px: no fixed widths, overflow, missing wrapping
- Alignment consistent across rows/grids

### UX Flow
- Async actions (submit, save, delete) show loading states
- Success/error feedback after actions — no silent failures
- Empty states for lists/tables
- Destructive actions require confirmation
- Disabled controls explain why
- Navigation consistent, active state indicated

### Severity
- **Critical**: blocks a core task or serious accessibility barrier
- **High**: significant friction or clear accessibility violation
- **Medium**: noticeable inconsistency or missing feedback, workaround exists
- **Low**: cosmetic polish

## Rules

1. Only cite files/lines you actually read. Never fabricate paths or line numbers.
2. Each finding needs: Title (short, specific), Location (file:line), Category (Accessibility / Visual / UX Flow), Severity, Description (why it matters to the user), Suggested Fix (concrete code snippet).
3. File at most **10 new issues per run**, highest severity first. Note remaining findings count in the last issue filed.

## Duplicate check (required before filing anything)

Fetch ALL existing issues (open and closed) first:

```
gh issue list --state all --limit 500 --json number,title,state
```

Do not file a finding if an existing issue (open OR closed) covers the same problem in the same location — match by meaning, not exact title. Closed issues count as duplicates too (already fixed or rejected); do not re-file them.

## Filing issues (gh CLI)

For each new, non-duplicate finding:

```
gh issue create --title "<Title>" --body "<Body>" --label "design-audit"
```

If the `design-audit` label doesn't exist, create it once: `gh label create design-audit --color 6f42c1 --description "Automated UI/UX audit" 2>/dev/null || true`. Also apply `ui`, `ux`, or `accessibility` labels only if they already exist in the repo.

Issue body format:

```
**Category:** <Accessibility | Visual | UX Flow>
**Severity:** <Critical | High | Medium | Low>
**Location:** `path/to/file:line`

**Description**
<what's wrong and why it matters>

**Suggested fix**
```<lang>
<code snippet>
```

---
_Filed by automated design audit (DESIGN_AUDIT.md)_
```

## Output

Finish with a summary: number of files reviewed, findings found, issues created (with numbers), duplicates skipped.
