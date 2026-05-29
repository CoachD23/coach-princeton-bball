# Labels and State Transitions

## Labels

| Label | Meaning | Who applies it |
| --- | --- | --- |
| `phase1:ready` | Issue passes the readiness gate and can enter the manual loop. | Human |
| `agent:generate` | Codex should claim the issue and create or revise a draft PR. | Human or verifier |
| `agent:review` | Claude should review the PR against the issue, CI, tests, and codebase. | Human or generator |
| `loop:round-1` | First verifier review round is active. | Generator |
| `loop:round-2` | Second verifier review round is active. | Generator or human |
| `loop:round-3` | Final allowed verifier review round is active. | Generator or human |
| `needs-human` | Human decision required before merge, restart, or clarification. | Verifier or human |
| `blocked` | The loop cannot proceed without missing information or external action. | Either agent or human |
| `risk:elevated` | Work is allowed in the broad trial but needs extra scrutiny. | Generator, verifier, or human |
| `hard-stop` | Sensitive or protected surface touched; agents must stop. | Either agent or human |

## Readiness Gate

An issue can receive `agent:generate` only when all of these are true:

- Problem and desired outcome are clear.
- Acceptance criteria are specific and checkable.
- Evidence plan names tests, manual checks, or both.
- Constraints and out-of-scope sections are filled in.
- Risk notes identify changed surfaces and hard-stop concerns.
- Definition of done includes CI, verifier approval, and human merge.

If any item is missing, leave the issue without `agent:generate` and ask the definer to tighten the spec.

## Normal Flow

1. Human files an issue with the agent-ready template.
2. Human confirms the readiness gate and adds `agent:generate`.
3. Codex opens a draft PR, links the issue, fills the PR contract, and adds `loop:round-1`.
4. CI runs on the draft PR.
5. Human or generator adds `agent:review`.
6. Claude reviews and either approves or requests changes.
7. If changes are requested, replace `agent:review` with `agent:generate` and advance the round label.
8. If CI is green and Claude approves, remove agent routing labels, add `needs-human`, and mark the PR ready for review.
9. Human reviews and merges, comments with requested changes, or closes the loop.

## Round Counting

Count a round when Claude posts an approve or change-request decision after reviewing a generator revision.

- `loop:round-1` starts when the first draft PR is opened.
- Move to `loop:round-2` after the first change-request revision is requested.
- Move to `loop:round-3` after the second change-request revision is requested.
- After a third change-request decision, stop the loop and add `needs-human`.

Do not reset the round count for force-pushes, small follow-up commits, CI reruns, or comment replies.

## Hard Stops

Add `hard-stop` and `needs-human` immediately if the PR touches:

- Secrets, credentials, tokens, or key material.
- Auth, permissions, sessions, or access control.
- Billing, payments, invoicing, or entitlements.
- Protected paths, deployment config, production infrastructure, or release automation.
- Database migrations, destructive data changes, or irreversible jobs.
- Code whose owner is unclear.

Agents may summarize findings after a hard stop, but they must not continue revising the PR until a human gives explicit direction.

