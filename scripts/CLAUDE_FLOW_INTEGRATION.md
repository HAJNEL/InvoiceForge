# Claude Flow — Web App ↔ Worker Contract

This describes exactly what the Claude Flow web app (built in Google AI Studio) must
read/write in Firestore for `claude-flow-worker.ts` to pick up and execute jobs. Give
this file to the AI Studio builder along with the worker script.

The worker only touches three collections: `projects`, `agents`, `runs`. It uses the
**Firebase Admin SDK**, so it bypasses Firestore security rules entirely — but the web
app itself is client-facing and needs rules that keep users scoped to their own data.

## 1. `projects/{projectId}`

One doc per GitHub repo the user has connected.

| Field     | Type   | Required | Notes                                                                 |
|-----------|--------|----------|------------------------------------------------------------------------|
| `userId`  | string | yes      | Firebase Auth UID of the owner. Used by app-side security rules.       |
| `repoUrl` | string | yes      | HTTPS GitHub URL, e.g. `https://github.com/owner/repo` (`.git` optional). |
| `branch`  | string | yes      | Base branch the worker clones from and opens PRs against, e.g. `main`. |

The worker does **not** need a GitHub token stored on this doc — it uses its own
`GITHUB_TOKEN` from the worker's local environment. Do not ask the user to paste a
GitHub token into the app; that would mean storing a live credential in Firestore.

## 2. `agents/{agentId}`

One doc per reusable "agent persona" the user can assign to a run.

| Field          | Type   | Required | Notes                                                              |
|----------------|--------|----------|-----------------------------------------------------------------------|
| `userId`       | string | yes      | Owner UID.                                                          |
| `role`         | string | yes      | Short label, e.g. `"UI/UX Auditor"`. Shown to Claude as its role.    |
| `instructions` | string | yes      | Free-text task description, e.g. "Fix AA contrast issues in the design system." |

## 3. `runs/{runId}` — created by the app, updated by the worker

This is the queue. The app creates a doc; the worker listens for it and updates it in
place as the job progresses.

### Fields the app must write when queuing a run

| Field       | Type   | Required | Notes                                                        |
|-------------|--------|----------|----------------------------------------------------------------|
| `userId`    | string | yes      | Must match the worker's `CLAUDE_FLOW_USER_ID` env var to be picked up. |
| `projectId` | string | yes      | Doc ID in `projects`.                                          |
| `agentId`   | string | yes      | Doc ID in `agents`.                                            |
| `status`    | string | yes      | Must be exactly `"queued"`. Do not set any other status.       |

Do not set `logs`, `outcomeSummary`, `completedAt`, `commitHash`, or `pullRequestUrl`
when creating the doc — the worker owns those fields from this point on.

### Fields the worker owns and writes back (the app should render these, not edit them)

| Field             | Type                                                  | Notes                                                                 |
|-------------------|--------------------------------------------------------|------------------------------------------------------------------------|
| `status`          | `"queued" \| "running" \| "completed" \| "failed"`      | Lifecycle. The app should subscribe (`onSnapshot`) to reflect live progress. |
| `logs`            | `{ timestamp: string; message: string; type: "info" \| "success" }[]` | Append-only progress feed. Render as a live log panel.       |
| `outcomeSummary`  | string                                                  | One/two-sentence human summary, set on both success and failure.     |
| `completedAt`     | number (ms epoch)                                       | Set when the run reaches `completed` or `failed`.                    |
| `commitHash`      | string (optional)                                       | Only present on success with real changes committed.                 |
| `pullRequestUrl`  | string (optional)                                       | Only present on success with a PR opened. Render as a link.          |

### Example run lifecycle (what the app will observe via `onSnapshot`)

```jsonc
// 1. App writes this to create the job:
{ "userId": "zA4w...", "projectId": "proj_abc", "agentId": "agent_xyz", "status": "queued" }

// 2. Worker claims it:
{ "status": "running", "logs": [{ "timestamp": "10:02:01 AM", "message": "Worker claimed job.", "type": "info" }] }

// 3. ...logs accumulate as the worker clones, analyzes, commits, pushes, opens a PR...

// 4a. Success:
{
  "status": "completed",
  "outcomeSummary": "Fixed 2 AA contrast violations in the button and badge components.",
  "completedAt": 1737200000000,
  "commitHash": "a1b2c3d",
  "pullRequestUrl": "https://github.com/owner/repo/pull/57"
}

// 4b. Or failure:
{ "status": "failed", "outcomeSummary": "Execution failed: GitHub PR creation failed (422): ...", "completedAt": 1737200000000 }
```

## 4. What the app does NOT need to build

- No GitHub OAuth/token handling — the worker holds `GITHUB_TOKEN` locally.
- No Claude/Anthropic API integration — the worker calls `@anthropic-ai/sdk` directly.
- No git operations, diffing, or PR creation — all handled by the worker process.
- No polling — Firestore `onSnapshot` listeners give real-time updates for free.

## 5. Suggested Firestore security rules (app-facing, client SDK)

The worker uses the Admin SDK and ignores these, but the web app's client reads/writes
should be locked down per-user:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /projects/{projectId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    match /agents/{agentId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    match /runs/{runId} {
      allow read: if request.auth != null && request.auth.uid == resource.data.userId;
      // Only allow creating queued runs with no worker-owned fields set by the client.
      allow create: if request.auth != null
        && request.auth.uid == request.resource.data.userId
        && request.resource.data.status == 'queued'
        && !request.resource.data.keys().hasAny(['logs', 'outcomeSummary', 'completedAt', 'commitHash', 'pullRequestUrl']);
      // Client should never update a run directly; only the Admin SDK worker does.
      allow update, delete: if false;
    }
  }
}
```

## 6. Firestore database

The worker connects to a **non-default** Firestore database, id:
`ai-studio-7d2df143-2f7b-450a-a32f-95be94a638fb` (overridable via `FIRESTORE_DATABASE_ID`).
Confirm the AI Studio app is writing to this same database, not the `(default)` one —
otherwise the worker will never see the queued runs.

## 7. One worker = one user (for now)

The worker is scoped to a single `CLAUDE_FLOW_USER_ID` via env var. If the app is
multi-tenant (multiple users each running their own worker), each user runs their own
instance of `claude-flow-worker.ts` with their own `CLAUDE_FLOW_USER_ID`,
`GITHUB_TOKEN`, `ANTHROPIC_API_KEY`, and Firebase service-account key. The app itself
doesn't need to change for this — it's purely a worker deployment detail.
