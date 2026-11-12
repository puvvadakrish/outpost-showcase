import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { InMemoryOnboardingRepository } from "@/application/onboarding/in-memory-repository";
import { OnboardingApplicationService } from "@/application/onboarding/service";

const migration = readdirSync("neon/migrations")
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(`neon/migrations/${file}`, "utf8"))
  .join("\n");
const rlsVerification = readFileSync("db/rls-answer-bank-verification.sql", "utf8");

function emptyRepository() {
  return new InMemoryOnboardingRepository({
    auditEvents: [],
    handoffRules: [],
    locations: [],
    memberships: [],
    notificationDestinations: [],
    providerConnections: [],
    sourceDocuments: [],
    tenants: [],
    users: []
  });
}

describe("owner onboarding bootstrap persistence", () => {
  it("bootstraps a tenant, owner membership, first location, starter setup rows, and audit event atomically", async () => {
    const repository = emptyRepository();
    const service = new OnboardingApplicationService(repository);

    const result = await service.bootstrapOwnerTenant({
      ownerEmail: " Founder@Example.com ",
      ownerName: " Founder Owner ",
      tenantName: " Keystone Strength ",
      locationName: " Main Desk ",
      locationAddress: " 100 Front Desk Way ",
      timezone: " America/Chicago ",
      publicPhone: " (555) 123-4567 "
    });
    const snapshot = repository.snapshot();

    expect(result).toMatchObject({
      tenantName: "Keystone Strength",
      locationName: "Main Desk"
    });
    expect(snapshot.users).toContainEqual(
      expect.objectContaining({
        email: "founder@example.com",
        name: "Founder Owner"
      })
    );
    expect(snapshot.tenants).toContainEqual(
      expect.objectContaining({
        id: result.tenantId,
        name: "Keystone Strength",
        status: "setup",
        planId: "plan_single_location",
        billingMode: "pilot"
      })
    );
    expect(snapshot.memberships).toContainEqual(
      expect.objectContaining({
        tenantId: result.tenantId,
        role: "owner",
        inviteStatus: "active"
      })
    );
    expect(snapshot.locations).toContainEqual(
      expect.objectContaining({
        id: result.locationId,
        tenantId: result.tenantId,
        name: "Main Desk",
        address: "100 Front Desk Way",
        publicPhone: "(555) 123-4567",
        status: "draft"
      })
    );
    expect(snapshot.sourceDocuments).toContainEqual(
      expect.objectContaining({
        tenantId: result.tenantId,
        locationId: result.locationId,
        type: "manual",
        status: "missing",
        factsFound: 0
      })
    );
    expect(snapshot.handoffRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tenantId: result.tenantId,
          trigger: "always_human",
          action: "create_task",
          status: "active"
        }),
        expect.objectContaining({
          tenantId: result.tenantId,
          trigger: "low_confidence",
          action: "create_task",
          status: "active"
        })
      ])
    );
    expect(snapshot.notificationDestinations).toContainEqual(
      expect.objectContaining({
        tenantId: result.tenantId,
        type: "task_queue",
        status: "ready"
      })
    );
    expect(snapshot.providerConnections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tenantId: result.tenantId,
          channel: "phone",
          providerKey: "retell",
          status: "not_configured"
        }),
        expect.objectContaining({
          tenantId: result.tenantId,
          channel: "email",
          providerKey: "gmail",
          status: "not_configured"
        })
      ])
    );
    expect(snapshot.auditEvents).toContainEqual(
      expect.objectContaining({
        tenantId: result.tenantId,
        subjectType: "tenant",
        subjectId: result.tenantId,
        action: "tenant.bootstrapped",
        metadata: expect.objectContaining({
          location_id: result.locationId,
          live_providers_enabled: false
        })
      })
    );
  });

  it("rolls back bootstrap state when the transaction fails mid-write", async () => {
    const repository = emptyRepository();
    const before = repository.snapshot();
    const service = new OnboardingApplicationService(repository);

    repository.requestFailureAfterTenantInsert();

    await expect(
      service.bootstrapOwnerTenant({
        ownerEmail: "owner@example.com",
        ownerName: "Owner",
        tenantName: "Rollback Gym",
        locationName: "Main",
        locationAddress: "100 Rollback",
        timezone: "America/Chicago"
      })
    ).rejects.toThrow("Injected failure after tenant insert.");

    expect(repository.snapshot()).toEqual(before);
  });

  it("rejects invalid input before mutating state", async () => {
    const repository = emptyRepository();
    const before = repository.snapshot();
    const service = new OnboardingApplicationService(repository);

    await expect(
      service.bootstrapOwnerTenant({
        ownerEmail: "not-an-email",
        ownerName: "Owner",
        tenantName: "Gym",
        locationName: "Main",
        locationAddress: "100 Main",
        timezone: "America/Chicago"
      })
    ).rejects.toThrow("Owner email must be valid.");
    await expect(
      service.bootstrapOwnerTenant({
        ownerEmail: "owner@example.com",
        ownerName: "",
        tenantName: "Gym",
        locationName: "Main",
        locationAddress: "100 Main",
        timezone: "America/Chicago"
      })
    ).rejects.toThrow("Owner name is required.");

    expect(repository.snapshot()).toEqual(before);
  });

  it("defines bootstrap as an authenticated multi-table RPC without direct insert grants", () => {
    expect(migration).toContain("create or replace function bootstrap_owner_tenant");
    expect(migration).toContain("security definer");
    expect(migration).toContain("auth.uid()");
    expect(migration).toContain("authenticated email claim is required");
    expect(migration).toContain("user already has an active tenant membership");
    expect(migration).toContain("insert into users");
    expect(migration).toContain("insert into tenants");
    expect(migration).toContain("insert into tenant_memberships");
    expect(migration).toContain("insert into locations");
    expect(migration).toContain("insert into source_documents");
    expect(migration).toContain("insert into handoff_rules");
    expect(migration).toContain("insert into notification_destinations");
    expect(migration).toContain("insert into provider_connections");
    expect(migration).toContain("insert into audit_events");
    expect(migration).toContain("'tenant.bootstrapped'");
    expect(migration).toContain("grant execute on function bootstrap_owner_tenant");
    expect(migration).toContain(
      "revoke execute on function bootstrap_owner_tenant(text, text, text, text, text, text, text)"
    );
    expect(migration).not.toContain("grant insert on tenants");
    expect(migration).not.toContain("grant insert on tenant_memberships");
    expect(migration).not.toContain("grant insert on locations");
  });

  it("extends rollback-only RLS verification for onboarding bootstrap", () => {
    expect(rlsVerification).toContain("anon can execute owner bootstrap RPC");
    expect(rlsVerification).toContain("public can execute owner bootstrap RPC");
    expect(rlsVerification).toContain("bootstrap_owner_tenant(");
    expect(rlsVerification).toContain("bootstrap did not create one tenant");
    expect(rlsVerification).toContain("bootstrap did not create one owner membership");
    expect(rlsVerification).toContain("bootstrap did not create provider stubs");
    expect(rlsVerification).toContain("bootstrap audit event missing");
    expect(rlsVerification).toContain("cross-tenant bootstrap tenant leaked through RLS");
    expect(rlsVerification).toContain("direct tenant insert unexpectedly succeeded");
    expect(rlsVerification).toContain("staff bootstrap unexpectedly succeeded");
    expect(rlsVerification).toContain("mismatched email claim bootstrap unexpectedly succeeded");
    expect(rlsVerification).toContain("missing email claim bootstrap unexpectedly succeeded");
  });
});
