# FIX_ISSUES.md — Automated Issue Fixing

Instructions for an AI agent (Claude) that fixes open GitHub issues in this repository. Designed for unattended scheduled runs: do NOT wait for human confirmation.

## Branch setup

1. Determine the default branch: `gh repo view --json defaultBranchRef -q .defaultBranchRef.name`
2. Fetch latest: `git fetch origin`
3. If a local or remote branch named `fixes` exists, check it out and merge the latest default branch into it. Otherwise create it from the default branch:
   - Exists remotely: `git checkout fixes && git pull origin fixes && git merge origin/<default>`
   - New: `git checkout -b fixes origin/<default>`
4. Never commit to the default branch. All work happens on `fixes`.

## Select issues

1. List open issues: `gh issue list --state open --limit 200 --json number,title,body,labels`
2. Skip any issue whose number already appears in a commit message on the `fixes` branch (already fixed, awaiting merge). Check with: `git log fixes --oneline | grep "#<number>"`
3. Skip issues labeled `wontfix`, `question`, or `blocked`.
4. Order by severity if stated in the issue body (Critical → High → Medium → Low), otherwise oldest first.
5. Fix at most **10 issues per run** to keep changes reviewable.

## Fix loop — one issue at a time

For each selected issue:

1. Read the issue body fully, including the suggested fix if present.
2. Locate the referenced code and verify the problem actually exists in the current code (it may already be fixed — if so, skip and note it).
3. Implement a minimal, targeted fix. Do not refactor unrelated code.
4. If the project has a fast check available (linter, type check, build), run it. If the fix breaks it, repair or revert before committing.
5. Commit ONLY the files changed for this issue, with this exact message format:

   ```
   #<issue-number> <issue title>
   ```

   Example: `#42 Submit button has no loading state on checkout form`

6. If an issue cannot be fixed safely (ambiguous, requires design decisions, or touches too much), skip it and record why. Do not guess on risky changes.

## After the loop

1. Push the branch: `git push origin fixes`
2. Do NOT close issues and do NOT merge — the owner reviews and merges the `fixes` branch manually.

## Output

Finish with a summary: issues fixed (numbers + titles), issues skipped and why, commits made, push result.
