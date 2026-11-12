# Staff Account Lifecycle Hardening Brainstorm

Date: 2026-06-21

## Frame

Acme Fitness needs a customer-safe staff handoff path before live invite
delivery, phone/email providers, billing, POS, or member-ledger writes are
allowed. The existing path lets an owner add/reactivate a staff roster row and
lets staff claim the row with Neon Auth. The remaining beta risk is reversibility:
if the wrong email is added, a staff user leaves, or the dry-run needs reset, the
operator needs a clear disable path with audit proof.

## Options

1. Build real invite delivery.
   - Rejected for this slice. It opens email provider, delivery, and support
     behavior before the protected-preview handoff gate is green.
2. Add Auth-admin provisioning for staff users.
   - Rejected for this slice. It would create real Neon Auth accounts from owner
     action and expands support/security surface.
3. Add owner-controlled staff roster disable/reactivate.
   - Selected. It stays inside existing tenant-membership persistence, uses the
     same owner-only security-definer pattern, creates audit proof, and gives the
     dry-run a rollback lever.

## Selected Scope

- Add a transactional owner-only `disable_tenant_staff_member` RPC.
- Disable only existing staff memberships in the caller's active owner tenant.
- Preserve the user row and any Neon Auth link; disable blocks claim/workboard
  membership visibility through existing active-membership checks.
- Keep reactivation through the existing `upsert_tenant_staff_member` path.
- Show owner UI actions and copy that describe manual handoff, disable, and
  reactivation without implying invite email delivery.

## Non-Goals

- No invite email delivery.
- No Auth admin provisioning.
- No phone/email provider ingress.
- No notifications.
- No billing, POS, or member-ledger writes.
- No hosted proof claim from local or code-shape tests.
