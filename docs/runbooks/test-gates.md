# Test Gates

Outpost has two deliberately separate verification tiers.

## Pull Request Gate

Run `npm run check` and `npm run build`. `check` executes TypeScript plus the
fast behavioral/unit suite. CI also runs the production dependency audit,
migration checksum validation, a full fresh PostgreSQL migration apply, and
focused executable database contracts. This tier must remain deterministic and
finish within the CI timeout.

## Evidence Gate

Run `npm run check:evidence` (or the backward-compatible
`npm run test:readiness-chain`) before protected Preview rehearsal, customer
evidence refresh, or a release decision. This serial suite validates the long
artifact/readiness chain and intentionally does not run on every pull request.
It is not a substitute for hosted commands or Chrome rehearsal.

When an evidence test becomes a stable product invariant, move its behavioral
core into the fast suite and keep only artifact-chain orchestration in the
evidence tier. Do not add source-text assertions when an executable domain,
route, SQL, or browser contract is practical.
