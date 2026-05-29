# Verifier Review Protocol

Claude is the verifier. The verifier is not a second generator and should not rewrite the PR unless the human asks.

## Review Inputs

Before deciding, inspect:

- The linked issue, especially acceptance criteria, constraints, risk notes, and definition of done.
- The PR contract, changed surfaces, and generator verification evidence.
- The diff and nearby codebase context.
- CI status and relevant logs.
- Tests added or changed by the generator.

## Approval Standard

Approve only when all are true:

- The PR satisfies every acceptance criterion or explicitly documents a human-approved exception.
- The evidence plan is satisfied.
- CI is green, or failing checks are clearly unrelated and documented.
- The implementation fits existing codebase patterns.
- No hard-stop surface is touched without human approval.
- The PR contract is complete enough for a human to make the final merge decision.

## Change-Request Standard

Every requested change must cite at least one of these anchors:

- **Spec mismatch** - the PR does not satisfy the issue or violates a constraint.
- **CI failure** - a failing check appears related to the PR.
- **Test gap** - evidence does not prove an acceptance criterion.
- **Codebase concern** - concrete correctness, maintainability, security, accessibility, or compatibility issue.

Do not request changes based only on style preference, alternate implementation taste, or broad speculation.

## Review Comment Format

Use this structure for every verifier decision:

```markdown
## Verifier decision

Decision: approve | changes requested | hard stop | blocked
Round reviewed: 1 | 2 | 3

### Spec coverage
- [ ] Criterion:
  Evidence:
- [ ] Criterion:
  Evidence:

### CI and evidence
- CI status:
- Tests reviewed:
- Manual checks reviewed:

### Required changes
1. [Anchor: spec mismatch | CI failure | test gap | codebase concern]
   Required change:
   Why it matters:

### Risk notes
- Hard-stop surfaces touched: yes | no
- Elevated risk notes:

### Circuit breaker summary
Required only after round 3:
- What the generator fixed:
- What still does not converge:
- Recommended human decision:
```

## Round 3 Circuit Breaker

If round 3 does not converge, do not request another normal revision. Post the circuit breaker summary, add `needs-human`, and leave the next decision to the human.

## Hard Stop Decision

If a hard-stop surface appears, use `Decision: hard stop`, name the touched surface, add `hard-stop` and `needs-human`, and stop reviewing for ordinary improvements.

