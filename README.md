# Outpost

> **About this repo.** A public snapshot of Outpost, which I build on my own time with Claude Code as my pair. The working repo stays private. In this copy, customer and gym names are replaced with fictional ones (Acme Fitness, Summit Strength, Peak CrossFit), and internal planning docs are left out. `npm ci && npm test` runs 820 tests.

Outpost is a standalone, multi-tenant SaaS product that removes repetitive gym
front-desk work across phone and email. It uses owner-approved answers and
handoff rules, turns unresolved or risky requests into staff-ready tasks, and
gives owners evidence-qualified visibility into front-desk burden reduction.
Acme Fitness is customer zero and a design partner; the product remains
reusable for the next gym.

## Reading Order

1. This README is the short repository entry point and normal command guide.
2. [AGENTS.md](AGENTS.md) owns stable product boundaries, safety rules,
   workflow routing, and approval gates.
3. `PLOT.md` (a private working-state file, not included here) is the sole volatile current-state pointer. It names the
   verified basis, evidence classes, blocked gates, zero-or-one active plan, and
   next product or customer gate.
4. The unified plan named by PLOT, when present, owns confirmed scope and the
   implementation contract.
5. Code, immutable migrations, tests, and git history are implementation truth.
   Runbooks own executable procedures; completed plans and evidence remain
   discoverable history outside the default reading path.

## Normal Commands

```bash
npm ci
npm run dev
npm run check
npm run build
```

When authoring migrations, also run:

```bash
npm run db:migrations:validate
```

The complete command definitions live in [package.json](package.json). Test
selection and gate expectations live in the
[test-gates runbook](docs/runbooks/test-gates.md). Specialized and operator
procedures remain under [docs/runbooks](docs/runbooks/); do not duplicate their
command inventories here. The
[readiness-chain freeze](docs/readiness/2026-07-07-readiness-chain-freeze.md)
governs its preserved historical command path and thaw conditions.
