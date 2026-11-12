import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { InMemoryStaffAuthRepository } from "@/application/staff-auth/in-memory-repository";
import { StaffAuthApplicationService } from "@/application/staff-auth/service";
import { auditEvents, memberships, tenants, users } from "@/domain/seed";

const migration = readdirSync("neon/migrations")
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(`neon/migrations/${file}`, "utf8"))
  .join("\n");
const rlsVerification = readFileSync("db/rls-answer-bank-verification.sql", "utf8");

function repository(overrides: Partial<ConstructorParameters<typeof InMemoryStaffAuthRepository>[0]> = {}) {
  return new InMemoryStaffAuthRepository({
    auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
    authEmail: "unlinked-staff@example.com",
    authUserId: "00000000-0000-0000-0000-000000000505",
    memberships: [
      ...memberships.map((membership) => ({ ...membership })),
      {
        id: "member_unlinked_staff_acme",
        tenantId: "tenant_acme_fitness",
        userId: "user_unlinked_staff_acme",
        role: "staff",
        inviteStatus: "active"
      }
    ],
    tenants: tenants.map((tenant) => ({ ...tenant })),
    users: [
      ...users.map((user) => ({ ...user })),
      {
        id: "user_unlinked_staff_acme",
        email: "unlinked-staff@example.com",
        name: "Unlinked Staff",
        createdAt: "2026-06-16T00:00:00.000Z"
      }
    ],
    ...overrides
  });
}

describe("staff auth persistence", () => {
  it("claims an existing active staff roster membership atomically", async () => {
    const repo = repository();
    const service = new StaffAuthApplicationService(repo);

    const claim = await service.claimStaffRosterMembership();
    const snapshot = repo.snapshot();

    expect(claim).toMatchObject({
      tenantId: "tenant_acme_fitness",
      membershipId: "member_unlinked_staff_acme",
      userId: "user_unlinked_staff_acme",
      email: "unlinked-staff@example.com",
      role: "staff",
      inviteStatus: "active"
    });
    expect(snapshot.users).toContainEqual(
      expect.objectContaining({
        id: "user_unlinked_staff_acme",
        externalAuthId: "00000000-0000-0000-0000-000000000505"
      })
    );
    expect(snapshot.auditEvents).toContainEqual(
      expect.objectContaining({
        tenantId: "tenant_acme_fitness",
        actorUserId: "user_unlinked_staff_acme",
        subjectType: "tenant_membership",
        subjectId: "member_unlinked_staff_acme",
        action: "tenant_membership.staff_claimed"
      })
    );
  });

  it("rolls back the auth link when audit persistence fails", async () => {
    const repo = repository();
    const before = repo.snapshot();
    const service = new StaffAuthApplicationService(repo);

    repo.requestFailureAfterUserLink();

    await expect(service.claimStaffRosterMembership()).rejects.toThrow(
      "Injected failure after staff roster user link."
    );

    expect(repo.snapshot()).toEqual(before);
  });

  it("rejects non-rostered and owner-only authenticated users", async () => {
    await expect(
      new StaffAuthApplicationService(repository({ authEmail: "missing@example.com" })).claimStaffRosterMembership()
    ).rejects.toThrow("Staff roster membership is required before sign-in.");

    await expect(
      new StaffAuthApplicationService(repository({ authEmail: "owner@example.com" })).claimStaffRosterMembership()
    ).rejects.toThrow("Active staff roster membership is required before sign-in.");
  });

  it("rejects unconfirmed authenticated email claims", async () => {
    await expect(
      new StaffAuthApplicationService(repository({ authEmailConfirmed: false })).claimStaffRosterMembership()
    ).rejects.toThrow("Confirmed authenticated email claim is required.");
  });

  it("defines staff claim as an authenticated transactional RPC", () => {
    expect(migration).toContain("create or replace function claim_staff_roster_membership");
    expect(migration).toContain("security definer");
    expect(migration).toContain("auth.uid()");
    expect(migration).toContain("auth.jwt() ->> 'email'");
    expect(migration).toContain('auth_users."emailVerified"');
    expect(migration).toContain("role = 'staff'");
    expect(migration).toContain("invite_status = 'active'");
    expect(migration).toContain("update users");
    expect(migration).toContain("insert into audit_events");
    expect(migration).toContain("'tenant_membership.staff_claimed'");
    expect(migration).toContain("revoke execute on function claim_staff_roster_membership()");
    expect(migration).toContain("grant execute on function claim_staff_roster_membership()");
  });

  it("extends RLS verification for staff claim happy path, denials, and rollback", () => {
    expect(rlsVerification).toContain("anon staff claim RPC unexpectedly executable");
    expect(rlsVerification).toContain("claim_staff_roster_membership()");
    expect(rlsVerification).toContain("disabled staff claim unexpectedly succeeded");
    expect(rlsVerification).toContain("disabled claimed staff retained task visibility");
    expect(rlsVerification).toContain("staff claim did not link auth user");
    expect(rlsVerification).toContain("staff claim did not grant own-tenant task visibility");
    expect(rlsVerification).toContain("staff claim leaked cross-tenant task visibility");
    expect(rlsVerification).toContain("unconfirmed staff claim unexpectedly succeeded");
    expect(rlsVerification).toContain("non-rostered staff claim unexpectedly succeeded");
    expect(rlsVerification).toContain("owner-only staff claim unexpectedly succeeded");
    expect(rlsVerification).toContain("staff claim rollback left auth link behind");
  });
});
