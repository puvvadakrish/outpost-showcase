import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { InMemoryLocationRepository } from "@/application/locations/in-memory-repository";
import { LocationApplicationService } from "@/application/locations/service";
import { auditEvents, locations } from "@/domain/seed";

const migration = readdirSync("neon/migrations")
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(`neon/migrations/${file}`, "utf8"))
  .join("\n");
const rlsVerification = readFileSync("db/rls-answer-bank-verification.sql", "utf8");

describe("location profile backend persistence", () => {
  it("creates an idempotent draft while enforcing the tenant plan allowance", async () => {
    const repository = new InMemoryLocationRepository({
      locations: locations.map((location) => ({ ...location })),
      revisions: [],
      auditEvents: [],
      includedLocationsByTenant: { tenant_acme_fitness: 2 }
    });
    const service = new LocationApplicationService(repository);
    const command = {
      tenantId: "tenant_acme_fitness",
      creationKey: "location-request-1",
      actorUserId: "user_owner_acme",
      name: "Acme Fitness North",
      address: "200 North Street",
      publicPhone: "(555) 010-3000",
      timezone: "America/Chicago"
    };

    const first = await service.createLocationDraft(command);
    const second = await service.createLocationDraft(command);
    const snapshot = repository.snapshot();

    expect(first).toMatchObject({
      tenantId: "tenant_acme_fitness",
      name: "Acme Fitness North",
      address: "200 North Street",
      status: "draft"
    });
    expect(second.id).toBe(first.id);
    expect(snapshot.revisions).toHaveLength(1);
    expect(snapshot.auditEvents).toContainEqual(
      expect.objectContaining({
        subjectId: first.id,
        action: "location.created",
        metadata: expect.objectContaining({
          creation_key: "location-request-1",
          provider_stubs: 2
        })
      })
    );

    await expect(
      service.createLocationDraft({ ...command, name: "Different location" })
    ).rejects.toThrow("Location creation key conflicts with different work.");

    await expect(
      service.createLocationDraft({ ...command, creationKey: "location-request-2" })
    ).rejects.toThrow("Location allowance reached for the current plan.");
  });

  it("rolls back a failed draft location creation", async () => {
    const repository = new InMemoryLocationRepository({
      locations: locations.map((location) => ({ ...location })),
      revisions: [],
      auditEvents: [],
      includedLocationsByTenant: { tenant_acme_fitness: 2 }
    });
    const before = repository.snapshot();
    const service = new LocationApplicationService(repository);
    repository.requestFailureAfterLocationCreate();

    await expect(
      service.createLocationDraft({
        tenantId: "tenant_acme_fitness",
        creationKey: "location-rollback",
        actorUserId: "user_owner_acme",
        name: "Rollback",
        address: "Rollback address",
        timezone: "America/Chicago"
      })
    ).rejects.toThrow("Injected failure after location creation.");
    expect(repository.snapshot()).toEqual(before);
  });

  it("updates an existing location profile through an atomic repository boundary", async () => {
    const repository = new InMemoryLocationRepository({
      locations: locations.map((location) => ({ ...location })),
      revisions: [],
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } }))
    });
    const service = new LocationApplicationService(repository);

    const updated = await service.updateLocationProfile({
      tenantId: "tenant_acme_fitness",
      locationId: "loc_acme_main",
      actorUserId: "user_owner_acme",
      name: "Acme Fitness HQ",
      address: "Customer-zero verified location",
      publicPhone: "(555) 010-1111",
      routingPhone: "(555) 010-2222",
      timezone: "America/Chicago",
      status: "active"
    });
    const snapshot = repository.snapshot();

    expect(updated).toMatchObject({
      id: "loc_acme_main",
      name: "Acme Fitness HQ",
      address: "Customer-zero verified location",
      publicPhone: "(555) 010-1111",
      routingPhone: "(555) 010-2222",
      status: "active"
    });
    expect(snapshot.revisions).toContainEqual(
      expect.objectContaining({
        locationId: "loc_acme_main",
        previousName: "Acme Fitness Main",
        nextName: "Acme Fitness HQ",
        previousAddress: "Customer-zero location",
        nextAddress: "Customer-zero verified location",
        previousPublicPhone: "(555) 010-1000",
        nextPublicPhone: "(555) 010-1111",
        previousRoutingPhone: "(555) 010-2000",
        nextRoutingPhone: "(555) 010-2222",
        previousStatus: "draft",
        nextStatus: "active"
      })
    );
    expect(snapshot.auditEvents).toContainEqual(
      expect.objectContaining({
        subjectType: "location",
        subjectId: "loc_acme_main",
        action: "location.updated",
        metadata: expect.objectContaining({
          previous_name: "Acme Fitness Main",
          next_name: "Acme Fitness HQ",
          previous_address: "Customer-zero location",
          next_address: "Customer-zero verified location",
          previous_status: "draft",
          next_status: "active"
        })
      })
    );
  });

  it("rolls back location, revision, and audit state when the transaction fails mid-write", async () => {
    const repository = new InMemoryLocationRepository({
      locations: locations.map((location) => ({ ...location })),
      revisions: [],
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } }))
    });
    const before = repository.snapshot();
    const service = new LocationApplicationService(repository);

    repository.requestFailureAfterLocationUpdate();

    await expect(
      service.updateLocationProfile({
        tenantId: "tenant_acme_fitness",
        locationId: "loc_acme_main",
        actorUserId: "user_owner_acme",
        name: "This update should roll back",
        address: "Rollback address",
        publicPhone: "(555) 010-9999",
        routingPhone: "(555) 010-9998",
        timezone: "America/Chicago",
        status: "active"
      })
    ).rejects.toThrow("Injected failure after location update.");

    expect(repository.snapshot()).toEqual(before);
  });

  it("rejects missing or invalid location updates without mutating state", async () => {
    const repository = new InMemoryLocationRepository({
      locations: locations.map((location) => ({ ...location })),
      revisions: [],
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } }))
    });
    const before = repository.snapshot();
    const service = new LocationApplicationService(repository);

    await expect(
      service.updateLocationProfile({
        tenantId: "tenant_acme_fitness",
        locationId: "missing_location",
        actorUserId: "user_owner_acme",
        name: "Missing",
        address: "Missing address",
        timezone: "America/Chicago",
        status: "draft"
      })
    ).rejects.toThrow("Location not found.");
    await expect(
      service.updateLocationProfile({
        tenantId: "tenant_acme_fitness",
        locationId: "loc_acme_main",
        actorUserId: "user_owner_acme",
        name: "",
        address: "Customer-zero location",
        timezone: "America/Chicago",
        status: "draft"
      })
    ).rejects.toThrow("Location name is required.");
    await expect(
      service.updateLocationProfile({
        tenantId: "tenant_acme_fitness",
        locationId: "loc_acme_main",
        actorUserId: "user_owner_acme",
        name: "Acme Fitness Main",
        address: "Customer-zero location",
        timezone: "America/Chicago",
        status: "not_a_status" as never
      })
    ).rejects.toThrow("Location status is invalid.");

    expect(repository.snapshot()).toEqual(before);
  });

  it("defines the location update RPC as a multi-table write boundary", () => {
    expect(migration).toContain("create table location_revisions");
    expect(migration).toContain("create or replace function update_location_profile");
    expect(migration).toContain("language plpgsql");
    expect(migration).toContain("security definer");
    expect(migration).toContain("for update");
    expect(migration).toContain("insert into location_revisions");
    expect(migration).toContain("insert into audit_events");
    expect(migration).toContain("'location.updated'");
    expect(migration).toContain("previous_public_phone");
    expect(migration).toContain("next_routing_phone");
    expect(migration).toContain("if v_actor_user_id is null then");
    expect(migration).toContain("grant execute on function update_location_profile");
    expect(migration).toContain("gen_random_uuid()::text");
    expect(migration).not.toContain("grant update on locations");
    expect(migration).not.toContain("grant insert on location_revisions");
    expect(migration).toContain(
      "revoke execute on function update_location_profile(text, text, text, text, text, text, text, text, text)"
    );
  });

  it("defines plan-enforced location creation with blocked provider stubs", () => {
    expect(migration).toContain("create or replace function create_additional_location_draft");
    expect(migration).toContain("for update of tenants");
    expect(migration).toContain("v_location_count >= v_included_locations");
    expect(migration).toContain("'location allowance reached for the current plan'");
    expect(migration).toContain("'location.created'");
    expect(migration).toContain("insert into location_revisions");
    expect(migration).toContain("insert into provider_connections");
    expect(migration).toContain("'not_configured', null, null, 'not configured'");
    expect(migration).toContain(
      "revoke execute on function create_additional_location_draft("
    );
    expect(migration).not.toContain("grant insert on locations");
    expect(migration).not.toContain("grant insert on provider_connections");
  });

  it("extends rollback-only RLS verification for location persistence and cross-tenant denial", () => {
    expect(rlsVerification).toContain("visible_own_locations <> 1");
    expect(rlsVerification).toContain("cross-tenant location leaked through RLS");
    expect(rlsVerification).toContain("anon can execute location update RPC");
    expect(rlsVerification).toContain("public can execute location update RPC");
    expect(rlsVerification).toContain("update_location_profile(");
    expect(rlsVerification).toContain("location_revisions_after <> location_revisions_before + 1");
    expect(rlsVerification).toContain(
      "location_audit_events_after <> location_audit_events_before + 1"
    );
    expect(rlsVerification).toContain("cross-tenant RPC location update unexpectedly succeeded");
  });
});
