import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { InMemoryStaffAccessRepository } from "@/application/staff-access/in-memory-repository";
import { StaffAccessApplicationService } from "@/application/staff-access/service";
import { auditEvents, memberships, users } from "@/domain/seed";

const migration = readdirSync("neon/migrations")
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(`neon/migrations/${file}`, "utf8"))
  .join("\n");
const rlsVerification = readFileSync("db/rls-answer-bank-verification.sql", "utf8");

function repository() {
  return new InMemoryStaffAccessRepository({
    auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
    memberships: memberships.map((membership) => ({ ...membership })),
    users: users.map((user) => ({ ...user }))
  });
}

describe("staff access persistence", () => {
  it("upserts a staff roster member through an atomic repository boundary", async () => {
    const repo = repository();
    const service = new StaffAccessApplicationService(repo);

    const member = await service.upsertTenantStaffMember({
      tenantId: " tenant_acme_fitness ",
      actorUserId: "user_owner_acme",
      staffEmail: " FrontDeskLead@AcmeFitness.example ",
      staffName: " Front Desk Lead "
    });
    const snapshot = repo.snapshot();

    expect(member).toMatchObject({
      email: "frontdesklead@acmefitness.example",
      name: "Front Desk Lead",
      role: "staff",
      inviteStatus: "active"
    });
    expect(snapshot.users).toContainEqual(
      expect.objectContaining({
        id: member.userId,
        email: "frontdesklead@acmefitness.example",
        name: "Front Desk Lead"
      })
    );
    expect(snapshot.memberships).toContainEqual(
      expect.objectContaining({
        id: member.membershipId,
        tenantId: "tenant_acme_fitness",
        userId: member.userId,
        role: "staff",
        inviteStatus: "active"
      })
    );
    expect(snapshot.auditEvents).toContainEqual(
      expect.objectContaining({
        tenantId: "tenant_acme_fitness",
        actorUserId: "user_owner_acme",
        subjectType: "tenant_membership",
        subjectId: member.membershipId,
        action: "tenant_membership.staff_upserted",
        metadata: expect.objectContaining({
          user_id: member.userId,
          email: "frontdesklead@acmefitness.example",
          next_role: "staff",
          next_invite_status: "active"
        })
      })
    );
  });

  it("disables a staff roster member through an audited owner boundary", async () => {
    const repo = repository();
    const service = new StaffAccessApplicationService(repo);

    const member = await service.disableTenantStaffMember({
      tenantId: " tenant_acme_fitness ",
      actorUserId: "user_owner_acme",
      membershipId: " member_staff_acme "
    });
    const snapshot = repo.snapshot();

    expect(member).toMatchObject({
      membershipId: "member_staff_acme",
      userId: "user_staff_acme",
      email: "frontdesk@example.com",
      role: "staff",
      inviteStatus: "disabled"
    });
    expect(snapshot.memberships).toContainEqual(
      expect.objectContaining({
        id: "member_staff_acme",
        tenantId: "tenant_acme_fitness",
        userId: "user_staff_acme",
        role: "staff",
        inviteStatus: "disabled"
      })
    );
    expect(snapshot.auditEvents).toContainEqual(
      expect.objectContaining({
        tenantId: "tenant_acme_fitness",
        actorUserId: "user_owner_acme",
        subjectType: "tenant_membership",
        subjectId: "member_staff_acme",
        action: "tenant_membership.staff_disabled",
        metadata: expect.objectContaining({
          user_id: "user_staff_acme",
          email: "frontdesk@example.com",
          previous_invite_status: "active",
          next_invite_status: "disabled",
          role: "staff"
        })
      })
    );
  });

  it("reactivates a disabled staff roster member through the existing upsert path", async () => {
    const repo = repository();
    const service = new StaffAccessApplicationService(repo);

    await service.disableTenantStaffMember({
      tenantId: "tenant_acme_fitness",
      actorUserId: "user_owner_acme",
      membershipId: "member_staff_acme"
    });

    const member = await service.upsertTenantStaffMember({
      tenantId: "tenant_acme_fitness",
      actorUserId: "user_owner_acme",
      staffEmail: "frontdesk@example.com",
      staffName: "Front Desk Reactivated"
    });

    expect(member).toMatchObject({
      membershipId: "member_staff_acme",
      userId: "user_staff_acme",
      email: "frontdesk@example.com",
      name: "Front Desk Reactivated",
      role: "staff",
      inviteStatus: "active"
    });
  });

  it("returns already-disabled staff roster rows without writing duplicate audit events", async () => {
    const repo = repository();
    const service = new StaffAccessApplicationService(repo);

    await service.disableTenantStaffMember({
      tenantId: "tenant_acme_fitness",
      actorUserId: "user_owner_acme",
      membershipId: "member_staff_acme"
    });
    const afterFirstDisable = repo.snapshot();

    const member = await service.disableTenantStaffMember({
      tenantId: "tenant_acme_fitness",
      actorUserId: "user_owner_acme",
      membershipId: "member_staff_acme"
    });

    expect(member.inviteStatus).toBe("disabled");
    expect(repo.snapshot().auditEvents).toEqual(afterFirstDisable.auditEvents);
  });

  it("rolls back staff disable when the membership is not a tenant staff row", async () => {
    const repo = repository();
    const before = repo.snapshot();
    const service = new StaffAccessApplicationService(repo);

    await expect(
      service.disableTenantStaffMember({
        tenantId: "tenant_acme_fitness",
        actorUserId: "user_owner_acme",
        membershipId: "member_owner_acme"
      })
    ).rejects.toThrow("Tenant staff membership is required.");

    expect(repo.snapshot()).toEqual(before);
  });

  it("projects whether roster rows have claimed Neon Auth accounts", async () => {
    const repo = repository();
    const service = new StaffAccessApplicationService(repo);

    const initialMembers = await service.listTenantMembers("tenant_acme_fitness");
    const initialStaff = initialMembers.find((member) => member.role === "staff");

    expect(initialStaff).toMatchObject({
      authLinked: false,
      inviteStatus: "active"
    });

    const linkedRepo = new InMemoryStaffAccessRepository({
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      memberships: memberships.map((membership) => ({ ...membership })),
      users: users.map((user) =>
        user.id === "user_staff_acme" ? { ...user, externalAuthId: "auth_staff_acme" } : { ...user }
      )
    });
    const linkedMembers = await new StaffAccessApplicationService(linkedRepo).listTenantMembers(
      "tenant_acme_fitness"
    );

    expect(linkedMembers.find((member) => member.userId === "user_staff_acme")).toMatchObject({
      authLinked: true
    });
  });

  it("rolls back user, membership, and audit state when roster persistence fails mid-write", async () => {
    const repo = repository();
    const before = repo.snapshot();
    const service = new StaffAccessApplicationService(repo);

    repo.requestFailureAfterUserUpsert();

    await expect(
      service.upsertTenantStaffMember({
        tenantId: "tenant_acme_fitness",
        actorUserId: "user_owner_acme",
        staffEmail: "rollback-staff@example.com",
        staffName: "Rollback Staff"
      })
    ).rejects.toThrow("Injected failure after staff user upsert.");

    expect(repo.snapshot()).toEqual(before);
  });

  it("does not rename an existing outside user when adding them to the tenant staff roster", async () => {
    const repo = new InMemoryStaffAccessRepository({
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      memberships: [
        ...memberships.map((membership) => ({ ...membership })),
        {
          id: "member_partner_other",
          tenantId: "tenant_partner_gym",
          userId: "user_partner_staff",
          role: "staff",
          inviteStatus: "active"
        }
      ],
      users: [
        ...users.map((user) => ({ ...user })),
        {
          id: "user_partner_staff",
          email: "partner@example.com",
          name: "Partner Staff",
          createdAt: "2026-06-15T00:00:00.000Z"
        }
      ]
    });
    const service = new StaffAccessApplicationService(repo);

    const member = await service.upsertTenantStaffMember({
      tenantId: "tenant_acme_fitness",
      actorUserId: "user_owner_acme",
      staffEmail: "partner@example.com",
      staffName: "Renamed By Acme Fitness"
    });
    const snapshot = repo.snapshot();

    expect(member).toMatchObject({
      userId: "user_partner_staff",
      name: "Partner Staff",
      role: "staff",
      inviteStatus: "active"
    });
    expect(snapshot.users).toContainEqual(
      expect.objectContaining({
        id: "user_partner_staff",
        name: "Partner Staff"
      })
    );
    expect(snapshot.memberships).toContainEqual(
      expect.objectContaining({
        tenantId: "tenant_acme_fitness",
        userId: "user_partner_staff",
        role: "staff",
        inviteStatus: "active"
      })
    );
  });

  it("rejects invalid staff access input before mutating state", async () => {
    const repo = repository();
    const before = repo.snapshot();
    const service = new StaffAccessApplicationService(repo);

    await expect(
      service.upsertTenantStaffMember({
        tenantId: "tenant_acme_fitness",
        actorUserId: "user_owner_acme",
        staffEmail: "not-an-email",
        staffName: "Staff"
      })
    ).rejects.toThrow("Staff email must be valid.");
    await expect(
      service.upsertTenantStaffMember({
        tenantId: "tenant_acme_fitness",
        actorUserId: "user_owner_acme",
        staffEmail: "staff@example.com",
        staffName: ""
      })
    ).rejects.toThrow("Staff name is required.");

    expect(repo.snapshot()).toEqual(before);
  });

  it("defines staff access as an owner-only transactional RPC without direct table grants", () => {
    expect(migration).toContain("create or replace function upsert_tenant_staff_member");
    expect(migration).toContain("create or replace function disable_tenant_staff_member");
    expect(migration).toContain("create or replace function list_tenant_staff_access_members");
    expect(migration).toContain("is_active_tenant_owner(p_tenant_id)");
    expect(migration).toContain("auth_linked boolean");
    expect(migration).toContain("users.external_auth_id is not null");
    expect(migration).toContain("grant execute on function list_tenant_staff_access_members");
    expect(migration).toContain("security definer");
    expect(migration).toContain("is_active_tenant_owner(p_tenant_id)");
    expect(migration).toContain("insert into users");
    expect(migration).toContain("insert into tenant_memberships");
    expect(migration).toContain("insert into audit_events");
    expect(migration).toContain("'tenant_membership.staff_upserted'");
    expect(migration).toContain("'tenant_membership.staff_disabled'");
    expect(migration).toContain("only staff memberships can be managed through staff access");
    expect(migration).toContain("grant execute on function upsert_tenant_staff_member");
    expect(migration).toContain("grant execute on function disable_tenant_staff_member");
    expect(migration).toContain(
      "revoke execute on function upsert_tenant_staff_member(text, text, text)"
    );
    expect(migration).toContain(
      "revoke execute on function disable_tenant_staff_member(text, text)"
    );
    expect(migration).not.toContain("grant insert on users");
    expect(migration).not.toContain("grant update on tenant_memberships");
  });

  it("extends RLS verification for staff access happy path, cross-tenant denial, and rollback", () => {
    expect(rlsVerification).toContain("anon staff access RPC unexpectedly executable");
    expect(rlsVerification).toContain("anon staff access disable RPC unexpectedly executable");
    expect(rlsVerification).toContain("anon staff access projection RPC unexpectedly executable");
    expect(rlsVerification).toContain("upsert_tenant_staff_member(");
    expect(rlsVerification).toContain("disable_tenant_staff_member(");
    expect(rlsVerification).toContain("list_tenant_staff_access_members(");
    expect(rlsVerification).toContain("staff access projection did not expose claimed staff row");
    expect(rlsVerification).toContain("staff access projection unexpectedly allowed staff caller");
    expect(rlsVerification).toContain("staff access did not create user row");
    expect(rlsVerification).toContain("staff access did not create active staff membership");
    expect(rlsVerification).toContain("staff access did not disable staff membership");
    expect(rlsVerification).toContain("staff access disable audit event missing");
    expect(rlsVerification).toContain("staff access did not reactivate disabled staff membership");
    expect(rlsVerification).toContain("reactivated staff access did not restore active member visibility");
    expect(rlsVerification).toContain("staff access audit event missing");
    expect(rlsVerification).toContain("cross-tenant staff access unexpectedly succeeded");
    expect(rlsVerification).toContain("cross-tenant staff access disable unexpectedly succeeded");
    expect(rlsVerification).toContain("staff access renamed an existing outside user");
    expect(rlsVerification).toContain("staff access rollback left user row behind");
    expect(rlsVerification).toContain("staff access rollback wrote audit event");
  });
});
