# Admin Public Request Customer-Session Proof Acquisition Brainstorm

## What We're Building

Add a current-chain bridge from recorded public-request hosted rehearsal evidence to the customer-observed session proof lane. The output should be a non-secret command packet that tells an operator what to run when the real owner is available, without recording or claiming the customer-observed session itself.

## Why This Approach

The existing customer-session recorder intentionally consumes scheduling/preflight artifacts with owner/gym details. The public-request chain now has hosted rehearsal evidence, but it should not pretend that evidence is the same as a customer-observed session. A proof-acquisition packet preserves lineage and makes the next manual step repeatable.

## Key Decisions

- Consume only `admin_public_request_hosted_rehearsal_evidence`.
- Re-run the hosted rehearsal evidence inspector before trusting the parent.
- Emit command guidance for `admin:customer-session:record`, local inspection, hosted import/proof, and first-gym go/no-go.
- Keep customer-observed completion, hosted customer-session proof, go/no-go, first-gym run, public launch, invite delivery, providers, billing, POS, access control, and member-ledger writes blocked.

## Open Questions

- None for this slice.
