# Outpost Agent Instructions

Outpost is a standalone, multi-tenant SaaS product that removes repetitive gym
front-desk work across phone and email. Acme Fitness is customer zero and a
design partner, but every product decision must remain reusable for the next gym.

## Product Boundary

- Build around owner-approved answers and handoff rules.
- Handle routine phone and email requests conservatively.
- Turn unresolved, risky, or always-human requests into staff-ready tasks with
  clear provenance.
- Give owners trustworthy, evidence-qualified visibility into front-desk burden
  reduced.
- Keep human-gated decisions as the default. Autonomous mutating workflows are
  opt-in.
- Keep RequestHandoff separate. It remains the integration-neutral phone
  handoff product.
- Keep Club OS and Club Automation replacement work separate. Outpost v1 is not
  a POS, payment processor, billing-recovery system, member ledger, or access-
  control system.
- Do not expand Outpost into a broad autonomous customer-service platform.

## Authority and Reading Order

Use the smallest authority path that answers the task:

1. `README.md` is the short repository entry point and normal command guide.
2. `AGENTS.md` is the stable operating authority: product boundaries, safety
   rules, workflow routing, and approval gates.
3. `PLOT.md` is the sole volatile state pointer for this checkout: inspected
   basis, evidence-classified current state, blocked gates, zero-or-one active
   plan, and next product or customer gate.
4. These documents own durable product strategy and design:
   - `docs/brainstorms/2026-06-08-outpost-product-thesis-brainstorm.md`
   - `docs/plans/2026-06-08-feat-outpost-production-saas-plan.md`
   - `DESIGN.md`
5. The one unified plan named by `PLOT.md`, when present, owns confirmed scope
   and the implementation contract. Filename recency, historical `status`
   prose, and an old plan's self-description do not make it active.
6. Code, immutable migrations, tests, and git history are implementation truth.
   Documentation and proof summaries never override them.
7. Runbooks own executable operator procedures. Evidence records own hosted
   technical and customer-observed evidence.
8. Completed plans, brainstorms, solutions, scripts, migrations, runbooks,
   evidence, and generated artifacts remain discoverable history outside the
   default reading path.

`docs/systems/2026-06-08-outpost-agent-operating-system.md` is preserved
historical context, not active workflow authority. A temporary handoff supports
session continuity only; it must re-anchor to `PLOT.md`, the active plan, and
git state before work resumes.

## Stable Safety Rules

### Tenant and authority boundaries

- Derive tenant, location, and actor authority at trusted server and database
  boundaries. Browser intent, provider payloads, and caller-supplied identifiers
  never choose tenant authority.
- Keep founder-admin, owner, staff, runtime, policy-compiler, and provider-
  ingress capabilities separate and least-privileged.
- Preserve RLS, SECURITY DEFINER hardening, explicit function allowlists, and
  independent revocation gates. Do not infer authority from UI visibility or
  historical proof.

### Migrations and data

- Atlas checksummed, pending-only application is the migration path.
- Applied migrations and `neon/migrations/atlas.sum` are immutable history.
- Validate migrations locally and use disposable database verification for
  database, RLS, role, function, or authority changes.
- Destructive migrations, hosted application, ledger repair, or any mutation of
  shared data requires explicit authorization and the applicable runbook.

### Secrets and provider boundaries

- Secrets remain provider references or machine-local values. Never print,
  commit, expose to the browser, place in evidence, log with provider payloads,
  or send them to another model.
- Never inspect credential-bearing local files unless the task explicitly
  requires and authorizes that inspection.
- Live providers, outbound delivery, invites, hosted mutations, and customer
  actions remain closed until their individual gates are explicitly opened.
- Keep Vercel Preview and Production distinct. Technical proof in one
  environment does not authorize or prove the other.

### Runtime and recovery

- Preserve job and outbox leasing, retry, idempotency, settlement, recovery,
  and tenant stop/pause-generation behavior.
- Preserve normalized event and task provenance. Raw provider content must not
  leak into surfaces or records that intentionally store bounded projections.
- Owner review evidence is not executable runtime authority. Activation,
  rollback, evaluation, and outbound behavior require their own current checks
  and explicit gates.

### Evidence and readiness

- Keep customer-observed, hosted technical, synthetic, local, founder-operated,
  blocked, missing, and unknown evidence distinct. A weaker class never implies
  a stronger one.
- Dashboards, packets, rehearsals, and generated summaries do not substitute for
  actual customer use.
- `docs/readiness/2026-07-07-readiness-chain-freeze.md` remains authoritative
  for the readiness-chain freeze decision, retained command path, and thaw
  conditions. Its dated product-direction section is historical and does not
  supersede `PLOT.md`. The chain may thaw only around a scheduled real Acme Fitness session with honest protected Preview observations, a verified blocker
  and thaw rationale, and explicit human approval. Synthetic rehearsal, missing
  local artifacts, or speculative launch planning do not justify a new packet,
  proof script, readiness dashboard, or status projection.

### Repository preservation

- Inspect branch, status, and diff before editing. Preserve dirty work and
  untracked files as user-owned unless the user explicitly includes them.
- Never reset, absorb, rewrite, delete, stage, or commit unrelated work.
- Preserve historical plans, scripts, migrations, evidence, runbooks, and proof
  records unless a separate proof and authorization explicitly permits a
  change.

## Compound Engineering v3.20 Routes

Use the installed native Compound Engineering skills for mechanics. Do not add
project wrappers or copy plugin skill files into the repository. The highest-
risk applicable route wins; route selection is not based on diff size alone.

| Route | Trigger | Required output | Human gate | Skip condition | Completion / return |
| --- | --- | --- | --- | --- | --- |
| **Customer-validation** | The outcome is customer-observed learning, including a Acme Fitness session. | One bounded session outcome using existing runbooks and honest evidence destinations; no new packet. | Explicit approval for scheduling, customer/provider/hosted activity, outbound behavior, and recording as individually applicable. | None when customer-observed learning is the stated outcome; synthetic, local, or hosted technical proof cannot substitute. | Return with observed facts, unknowns, and the next product decision; do not auto-create a follow-up plan. |
| **High-risk** | Tenant authority, RLS, migrations, secrets, providers, privacy, hosted mutation, production operations, or incident response. | One unified plan unless emergency remediation makes prior planning unsafe; meaningful requirements/security review; focused code review; risk-specific verification. | Separate approval for implementation and every external or irreversible tail. | Incident response may start with `ce-debug` and the smallest reversible fix; it does not bypass provider/hosted/data gates. | Return after local and required disposable verification; hosted application and shipping remain separately gated. |
| **Default** | Meaningful product behavior with settled scope and no high-risk boundary. | Use `ce-brainstorm` only if WHAT is unresolved; otherwise one unified plan, proportional `ce-doc-review`, `ce-plan`, authorized `ce-work`, focused tests, and review. | Human confirms scope and separately authorizes implementation and shipping. | Escalate to high-risk or customer-validation whenever either trigger applies. | Return after verified behavior and findings disposition; no automatic commit/PR tail. |
| **Small** | Settled, reversible, low-risk mechanical work. | Direct scoped change plus focused local verification; no mandatory brainstorm or plan. | The user's change request authorizes only the scoped local edit. | Any ambiguity, product behavior, safety boundary, external action, or broader refactor moves it to another route. | Return with the changed paths and verification; no ceremony or external tail. |

Apply these conditional tools inside the four routes rather than inventing more
first-class workflows:

- Use `ce-brainstorm` only while WHAT remains unresolved. Preserve its Product
  Contract when enriching the same unified artifact with `ce-plan`.
- Use stable R-, AE-, KTD-, and U-IDs for traceability. Execution progress comes
  from git and verification evidence, never document task markers.
- Use `ce-doc-review` proportionally for meaningful requirements, architecture,
  security, privacy, or operational risk.
- Use `ce-work` only after implementation authorization. It may edit the
  approved local scope and run local verification; its native shipping tail is
  still subject to the approval gates below.
- For production incidents, begin with `ce-debug` and favor the smallest
  reversible remediation. Incident urgency does not bypass provider, hosted,
  customer-data, or shipping gates.
- Add `ce-test-browser` for UI or UX changes. `ce-dogfood` remains a separate,
  explicitly authorized interaction or mutation pass.
- Use `ce-simplify-code` after non-trivial implementation when it can reduce
  complexity without changing behavior. Skip it for mechanical work.
- Use proportional `ce-code-review` for default work and require it for high-
  risk boundaries. Cross-model review is a separate egress decision.
- Use `ce-worktree` when isolation is needed to protect dirty work or establish
  a current base. Creating or switching branches still requires authorization.
- Use `ce-compound` only for genuinely durable reusable learning. Use
  `ce-compound-refresh` only to repair a specific stale learning.
- Use `ce-handoff` only for a real context transfer or explicit request. Default
  to temporary non-repository storage, point back to `PLOT.md`, the active plan,
  and git state, and revalidate them on resumption.
- Keep `ce-product-pulse` future-stage until Outpost has approved
  instrumentation sources and a deliberate measurement question. It must not
  become a second current-state dashboard.

## Human Approval Gates

Authorization is capability-specific and non-transitive:

- Approval to audit, brainstorm, plan, review, or diagnose is read-only unless
  the same grant explicitly includes edits.
- Approval to implement or invoke `ce-work` permits only the scoped repository
  edits and local verification. It does not authorize a commit, push, PR,
  babysitting, dogfood, cross-model egress, deployment, hosted/provider/customer
  action, outbound behavior, or `lfg`.
- Commit, push, PR creation, and `ce-babysit-pr` are separate capabilities. A PR
  grant does not imply babysitting or merging.
- `ce-dogfood`, hosted operations, provider calls, customer scheduling or
  interaction, outbound messages, evidence recording, deployment, and database
  mutation each require an explicit grant for the exact action and environment.
- Cross-model review or implementation requires per-run approval naming the
  recipient, the exact document/source/diff scope, and whether customer,
  tenant, or operational data is present. Secrets and credential-bearing local
  configuration never leave the local environment. Without approval, use a
  local-only fallback or stop.
- Enabled machine preferences belong only in the ignored
  `.compound-engineering/config.local.yaml`. They may choose among behavior that
  `AGENTS.md` already permits, but they cannot override these rules, approval
  gates, or safety invariants. A per-run grant can satisfy only a gate explicitly
  described as authorizable; it cannot relax tenant isolation, migration
  authority, secret handling, provider safety, or evidence integrity.
- `lfg` is opt-in. Its authorization must enumerate the allowed tail and never
  implies data or secret egress, provider/customer activity, deployment, or
  merge.
- Autonomous mutating workflows are opt-in. If a native skill's defaults would
  cross an ungranted boundary, disable that tail or return for approval.

## Documentation and Evidence Rules

- Replace `PLOT.md` in place. Keep only its bounded current-state fields; never
  append a chronological slice log.
- Keep `AGENTS.md` stable. Do not add completed-slice summaries, current status,
  proof narration, command inventories, or implementation patterns here.
- Update stable product strategy or `DESIGN.md` only when its owning durable
  decision changes.
- Preserve completed plans and evidence as immutable history. Never infer active
  work from dates, filenames, task markers, or stale status prose; only
  `PLOT.md` names the zero-or-one active plan.
- Route genuinely durable implementation patterns to `docs/solutions/` or an
  existing `CONCEPTS.md`. Slice-specific outcomes need no durable learning
  artifact.
- Keep detailed procedures in runbooks and specialized commands in their
  existing operator sources, outside the root critical reading path.
- Do not create a new readiness artifact, plan registry, command registry,
  dashboard, packet, status projection, or archive layer to explain current
  state.
- Record evidence only in its existing authorized destination and at its honest
  evidence class. `PLOT.md` may summarize the classification but is not an
  evidence record.

## Verification Routing

- Match verification to the affected boundary. Prefer focused tests during
  implementation and the repository's default local verification before
  completion.
- Database, migration, RLS, role, function, and authority changes require Atlas
  validation plus disposable PostgreSQL verification; hosted application stays
  separately gated.
- UI changes require local desktop and responsive browser verification. A local
  browser result is not hosted or customer evidence.
- Provider, concurrency, lease, retry, idempotency, stop-generation, recovery,
  and tenant-boundary changes require their focused contract and integration
  checks.
- Run the frozen readiness-chain suite only when readiness scripts, package
  aliases, or proof behavior change, as defined by the freeze document.
- Hosted and customer-observed verification are never implicit follow-ups to
  local verification. They require their own explicit authorization and report
  only their observed evidence class.
- Before closeout, inspect the actual diff and status, confirm excluded work is
  untouched, and report changed paths, commands run, results, and any deliberate
  verification exception.
