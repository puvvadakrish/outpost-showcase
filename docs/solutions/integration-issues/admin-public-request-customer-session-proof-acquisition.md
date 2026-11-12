# Admin Public Request Customer-Session Proof Acquisition

## Summary

The public-request chain now has a current-chain bridge from hosted rehearsal evidence to the customer-observed session proof lane:

- `npm run admin:public-request-customer-session:proof-acquisition`
- `npm run admin:public-request-customer-session:proof-acquisition:inspect`

The packet consumes `admin_public_request_hosted_rehearsal_evidence`, re-inspects that parent, stores the parent SHA, and emits a non-secret command sequence for the later real customer session record, hosted import/proof, and first-gym go/no-go.

## Guardrails

- Customer-observed session remains unrecorded.
- Hosted customer-session proof remains unrecorded.
- First-gym go/no-go and first-gym run remain blocked.
- Public self-serve, browser approvals, automatic grants, invite delivery, notifications, phone/email providers, billing, POS, access control, and member-ledger writes remain blocked.

## Why It Exists

The existing customer-session recorder requires a scheduling/preflight artifact with real owner/gym session details. Hosted rehearsal evidence is proof of operator/browser rehearsal, not proof that a customer attended. This bridge keeps the command path visible without broadening the proof claim.
