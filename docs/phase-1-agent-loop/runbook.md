# Manual Phase 1 Runbook

This runbook is the human-operated version of the agent PR loop. Use it before adding GitHub Actions, webhooks, or auto-routing.

## 1. File the Issue

Create an issue with `.github/ISSUE_TEMPLATE/agent-ready.yml`.

Before adding `agent:generate`, confirm:

- Problem, desired outcome, acceptance criteria, constraints, out-of-scope, risk notes, and definition of done are filled in.
- Acceptance criteria are checkable.
- Evidence plan prefers tests and includes a manual rubric when tests are not practical.
- Hard-stop concerns are either absent or explicitly approved for exploration.

If the issue is loose, tighten the issue instead of starting the loop.

## 2. Start the Generator

Add `agent:generate`.

Codex should:

- Claim the issue in a comment.
- Open a draft PR.
- Link the issue with `Closes #...`.
- Fill the PR contract.
- Add `loop:round-1`.
- Add `risk:elevated` if the change is large, cross-cutting, or affects user-critical behavior.
- Add `hard-stop` and `needs-human` if sensitive surfaces are touched.

## 3. Run CI

Let CI run on every push.

If CI fails:

- Generator may revise if the failure is clearly related and within the issue scope.
- Verifier must not approve while related CI is red.
- If CI is unavailable, the generator must provide the best local verification evidence in the PR contract.

## 4. Start the Verifier

Add `agent:review`.

Claude reviews the linked issue, PR contract, diff, tests, CI, and nearby code. Claude posts one of:

- `approve` - criteria satisfied, evidence is adequate, and no hard-stop concern remains.
- `changes requested` - anchored to spec mismatch, CI failure, test gap, or concrete codebase concern.
- `hard stop` - sensitive surface touched.
- `blocked` - missing information or external action prevents review.

## 5. Iterate

When Claude requests changes:

1. Remove `agent:review`.
2. Add `agent:generate`.
3. Advance the round label:
   - From `loop:round-1` to `loop:round-2`.
   - From `loop:round-2` to `loop:round-3`.
4. Codex revises the PR and updates the PR contract verification section.
5. CI reruns.
6. Add `agent:review` again.

Do not count comment-only clarification as a new round. Count only verifier decisions after a generator revision.

## 6. Stop Conditions

### Success

When CI is green and Claude approves:

- Remove `agent:generate` and `agent:review`.
- Add `needs-human`.
- Mark the PR ready for review.
- Human reviews, merges, requests changes, or closes.

### Circuit Breaker

After the third change-request decision:

- Add `needs-human`.
- Keep or add `blocked` if progress requires missing information.
- Verifier posts the circuit breaker summary:
  - What changed across the rounds.
  - What still does not converge.
  - Whether the human should clarify, accept risk, split the issue, or close the PR.

### Hard Stop

If secrets, auth, billing, protected paths, production config, migrations, destructive data changes, or unclear ownership appear:

- Add `hard-stop`.
- Add `needs-human`.
- Stop generator revisions.
- Human decides whether to continue, split scope, or close.

## 7. Phase 1 Test Scenarios

Run these manually across real issues before automating the loop:

| Scenario | Expected result |
| --- | --- |
| Small bug with failing test | Codex adds/fixes test, CI goes green, Claude approves, PR gets `needs-human`. |
| UI/docs/copy issue | PR uses manual rubric, verifier checks rubric, no fake test requirement blocks progress. |
| Larger feature | PR declares changed surfaces and risk; verifier checks evidence and scope carefully. |
| CI red | Claude withholds approval until related failures are fixed or documented as unrelated. |
| Repeated disagreement | Round 3 triggers circuit breaker summary and `needs-human`. |
| Sensitive path touched | PR immediately gets `hard-stop` and waits for human direction. |

## 8. Automation Readiness

Do not build auto-triggering until Phase 1 has produced several PRs where:

- Issues were specific enough for agents to act without relay.
- Verifier comments were concrete and anchored.
- Round counts were easy to track.
- Most failures came from real implementation issues, not vague specs.
- Human merge decisions were fast because the PR contract and verifier review were complete.

