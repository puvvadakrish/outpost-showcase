import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { InMemoryNotificationDestinationRepository } from "@/application/notification-destinations/in-memory-repository";
import { NotificationDestinationApplicationService } from "@/application/notification-destinations/service";
import { auditEvents, notificationDestinations } from "@/domain/seed";

const neonRepository = readFileSync(
  "src/infrastructure/neon/notification-destination-repository.ts",
  "utf8"
);

const migration = readdirSync("neon/migrations")
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(`neon/migrations/${file}`, "utf8"))
  .join("\n");
const rlsVerification = readFileSync("db/rls-answer-bank-verification.sql", "utf8");

describe("notification-destination backend persistence", () => {
  it("creates a server-identified draft with an initial revision and audit event", async () => {
    const repository = new InMemoryNotificationDestinationRepository({
      destinations: notificationDestinations.map((destination) => ({ ...destination })),
      revisions: [],
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } }))
    });
    const service = new NotificationDestinationApplicationService(repository);

    const created = await service.createNotificationDestinationDraft({
      tenantId: " tenant_acme_fitness ",
      locationId: " loc_acme_main ",
      creationKey: " local-destination-1 ",
      actorUserId: "user_owner_acme",
      type: "owner_email",
      label: " Owner escalation inbox ",
      destination: " owner@example.com "
    });
    const snapshot = repository.snapshot();

    expect(created).toMatchObject({
      tenantId: "tenant_acme_fitness",
      locationId: "loc_acme_main",
      type: "owner_email",
      label: "Owner escalation inbox",
      destination: "owner@example.com",
      status: "draft"
    });
    expect(created.id).toBeTruthy();
    expect(snapshot.revisions).toContainEqual(
      expect.objectContaining({
        tenantId: "tenant_acme_fitness",
        locationId: "loc_acme_main",
        notificationDestinationId: created.id,
        actorUserId: "user_owner_acme",
        previousType: "owner_email",
        nextType: "owner_email",
        previousLabel: "Owner escalation inbox",
        nextLabel: "Owner escalation inbox",
        previousDestination: "owner@example.com",
        nextDestination: "owner@example.com",
        previousStatus: "draft",
        nextStatus: "draft"
      })
    );
    expect(snapshot.auditEvents).toContainEqual(
      expect.objectContaining({
        tenantId: "tenant_acme_fitness",
        actorUserId: "user_owner_acme",
        subjectType: "notification_destination",
        subjectId: created.id,
        action: "notification_destination.created",
        metadata: expect.objectContaining({
          destination_type: "owner_email",
          label: "Owner escalation inbox",
          destination: "owner@example.com",
          status: "draft",
          revision_id: expect.any(String),
          creation_key: "local-destination-1"
        })
      })
    );
  });

  it("returns the original draft without duplicate evidence for a retried creation key", async () => {
    const repository = new InMemoryNotificationDestinationRepository({
      destinations: notificationDestinations.map((destination) => ({ ...destination })),
      revisions: [],
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } }))
    });
    const service = new NotificationDestinationApplicationService(repository);
    const command = {
      tenantId: "tenant_acme_fitness",
      creationKey: "local-destination-idempotent",
      actorUserId: "user_owner_acme",
      type: "staff_email" as const,
      label: "Staff escalation inbox",
      destination: "staff@example.com"
    };

    const first = await service.createNotificationDestinationDraft(command);
    const afterFirst = repository.snapshot();
    const retried = await service.createNotificationDestinationDraft(command);
    const afterRetry = repository.snapshot();

    expect(retried).toEqual(first);
    expect(afterRetry).toEqual(afterFirst);
  });

  it("rejects creation-key reuse for different destination work", async () => {
    const repository = new InMemoryNotificationDestinationRepository({
      destinations: [],
      revisions: [],
      auditEvents: []
    });
    const service = new NotificationDestinationApplicationService(repository);
    const command = {
      tenantId: "tenant_acme_fitness",
      creationKey: "same-destination-request",
      actorUserId: "user_owner_acme",
      type: "staff_email" as const,
      label: "Staff inbox",
      destination: "staff@example.com"
    };

    await service.createNotificationDestinationDraft(command);
    await expect(
      service.createNotificationDestinationDraft({ ...command, destination: "other@example.com" })
    ).rejects.toThrow("Notification destination creation key conflicts with different work.");
  });

  it("replays a creation key without duplicating the row, revision, or audit", async () => {
    const repository = new InMemoryNotificationDestinationRepository({
      destinations: notificationDestinations.map((destination) => ({ ...destination })),
      revisions: [],
      auditEvents: []
    });
    const service = new NotificationDestinationApplicationService(repository);
    const command = {
      tenantId: "tenant_acme_fitness",
      creationKey: "same-destination-request",
      actorUserId: "user_owner_acme",
      type: "staff_email" as const,
      label: "Staff inbox",
      destination: "staff@example.com"
    };

    const first = await service.createNotificationDestinationDraft(command);
    const second = await service.createNotificationDestinationDraft(command);
    const snapshot = repository.snapshot();

    expect(second.id).toBe(first.id);
    expect(
      snapshot.destinations.filter((destination) => destination.id === first.id)
    ).toHaveLength(1);
    expect(snapshot.revisions).toHaveLength(1);
    expect(snapshot.auditEvents).toHaveLength(1);
  });

  it.each([
    {
      injectFailure: (repository: InMemoryNotificationDestinationRepository) =>
        repository.requestFailureAfterDestinationCreate(),
      message: "Injected failure after notification destination create."
    },
    {
      injectFailure: (repository: InMemoryNotificationDestinationRepository) =>
        repository.requestFailureAfterInitialRevisionCreate(),
      message: "Injected failure after initial notification destination revision create."
    }
  ])("rolls back draft creation when a transaction stage fails", async ({ injectFailure, message }) => {
    const repository = new InMemoryNotificationDestinationRepository({
      destinations: notificationDestinations.map((destination) => ({ ...destination })),
      revisions: [],
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } }))
    });
    const before = repository.snapshot();
    const service = new NotificationDestinationApplicationService(repository);
    injectFailure(repository);

    await expect(
      service.createNotificationDestinationDraft({
        tenantId: "tenant_acme_fitness",
        creationKey: "local-destination-rollback",
        actorUserId: "user_owner_acme",
        type: "staff_email",
        label: "Rollback destination",
        destination: "rollback@example.com"
      })
    ).rejects.toThrow(message);

    expect(repository.snapshot()).toEqual(before);
  });

  it("rejects invalid draft creation fields before repository mutation", async () => {
    const repository = new InMemoryNotificationDestinationRepository({
      destinations: notificationDestinations.map((destination) => ({ ...destination })),
      revisions: [],
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } }))
    });
    const before = repository.snapshot();
    const service = new NotificationDestinationApplicationService(repository);
    const valid = {
      tenantId: "tenant_acme_fitness",
      creationKey: "local-destination-valid",
      actorUserId: "user_owner_acme",
      type: "staff_email" as const,
      label: "Staff inbox",
      destination: "staff@example.com"
    };

    await expect(
      service.createNotificationDestinationDraft({ ...valid, tenantId: " " })
    ).rejects.toThrow("Tenant identifier is required.");
    await expect(
      service.createNotificationDestinationDraft({ ...valid, creationKey: " " })
    ).rejects.toThrow(
      "Notification destination creation key is required and must be 200 characters or fewer."
    );
    await expect(
      service.createNotificationDestinationDraft({ ...valid, creationKey: "x".repeat(201) })
    ).rejects.toThrow(
      "Notification destination creation key is required and must be 200 characters or fewer."
    );
    await expect(
      service.createNotificationDestinationDraft({ ...valid, label: " " })
    ).rejects.toThrow("Notification destination label is required.");
    await expect(
      service.createNotificationDestinationDraft({ ...valid, destination: " " })
    ).rejects.toThrow("Notification destination value is required.");
    await expect(
      service.createNotificationDestinationDraft({ ...valid, type: "invalid" as never })
    ).rejects.toThrow("Notification destination type is invalid.");
    await expect(
      service.createNotificationDestinationDraft({ ...valid, label: "x".repeat(121) })
    ).rejects.toThrow("Notification destination label must be 120 characters or fewer.");
    await expect(
      service.createNotificationDestinationDraft({ ...valid, destination: "x".repeat(241) })
    ).rejects.toThrow("Notification destination value must be 240 characters or fewer.");

    expect(repository.snapshot()).toEqual(before);
  });

  it("maps draft creation to the Neon RPC without forwarding ids or status", () => {
    const createRpc = neonRepository.slice(
      neonRepository.indexOf('this.neon.rpc("create_notification_destination_draft"'),
      neonRepository.indexOf("if (error)", neonRepository.indexOf('this.neon.rpc("create_notification_destination_draft"'))
    );

    expect(createRpc).toContain("p_tenant_id: input.tenantId");
    expect(createRpc).toContain("p_location_id: input.locationId ?? null");
    expect(createRpc).toContain("p_creation_key: input.creationKey");
    expect(createRpc).toContain("p_destination_type: input.type");
    expect(createRpc).toContain("p_label: input.label");
    expect(createRpc).toContain("p_destination: input.destination");
    expect(createRpc).toContain("p_note: input.note");
    expect(createRpc).not.toContain("actorUserId");
    expect(createRpc).not.toContain("status");
    expect(createRpc).not.toContain("destinationId");
    expect(neonRepository).toContain(
      "Unable to create notification destination draft: RPC returned no destination."
    );
  });

  it("updates an existing notification destination through an atomic repository boundary", async () => {
    const repository = new InMemoryNotificationDestinationRepository({
      destinations: notificationDestinations.map((destination) => ({ ...destination })),
      revisions: [],
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } }))
    });
    const service = new NotificationDestinationApplicationService(repository);

    const updated = await service.updateNotificationDestination({
      tenantId: "tenant_acme_fitness",
      destinationId: "dest_acme_staff_email",
      actorUserId: "user_owner_acme",
      type: "staff_email",
      label: "Staff notification inbox",
      destination: "team@example.com",
      status: "ready"
    });
    const snapshot = repository.snapshot();

    expect(updated).toMatchObject({
      id: "dest_acme_staff_email",
      label: "Staff notification inbox",
      destination: "team@example.com",
      status: "ready"
    });
    expect(snapshot.revisions).toContainEqual(
      expect.objectContaining({
        notificationDestinationId: "dest_acme_staff_email",
        previousType: "staff_email",
        nextType: "staff_email",
        previousLabel: "Staff notification email",
        nextLabel: "Staff notification inbox",
        previousDestination: "frontdesk@example.com",
        nextDestination: "team@example.com",
        previousStatus: "draft",
        nextStatus: "ready"
      })
    );
    expect(snapshot.auditEvents).toContainEqual(
      expect.objectContaining({
        subjectType: "notification_destination",
        subjectId: "dest_acme_staff_email",
        action: "notification_destination.updated",
        metadata: expect.objectContaining({
          previous_label: "Staff notification email",
          next_label: "Staff notification inbox",
          previous_destination: "frontdesk@example.com",
          next_destination: "team@example.com",
          previous_status: "draft",
          next_status: "ready"
        })
      })
    );
  });

  it("rolls back destination, revision, and audit state when the transaction fails mid-write", async () => {
    const repository = new InMemoryNotificationDestinationRepository({
      destinations: notificationDestinations.map((destination) => ({ ...destination })),
      revisions: [],
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } }))
    });
    const before = repository.snapshot();
    const service = new NotificationDestinationApplicationService(repository);

    repository.requestFailureAfterDestinationUpdate();

    await expect(
      service.updateNotificationDestination({
        tenantId: "tenant_acme_fitness",
        destinationId: "dest_acme_staff_email",
        actorUserId: "user_owner_acme",
        type: "staff_email",
        label: "This update should roll back",
        destination: "rollback@example.com",
        status: "ready"
      })
    ).rejects.toThrow("Injected failure after notification destination update.");

    expect(repository.snapshot()).toEqual(before);
  });

  it("rejects missing or invalid destination updates without mutating state", async () => {
    const repository = new InMemoryNotificationDestinationRepository({
      destinations: notificationDestinations.map((destination) => ({ ...destination })),
      revisions: [],
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } }))
    });
    const before = repository.snapshot();
    const service = new NotificationDestinationApplicationService(repository);

    await expect(
      service.updateNotificationDestination({
        tenantId: "tenant_acme_fitness",
        destinationId: "missing_destination",
        actorUserId: "user_owner_acme",
        type: "staff_email",
        label: "missing",
        destination: "frontdesk@example.com",
        status: "draft"
      })
    ).rejects.toThrow("Notification destination not found.");
    await expect(
      service.updateNotificationDestination({
        tenantId: "tenant_acme_fitness",
        destinationId: "dest_acme_staff_email",
        actorUserId: "user_owner_acme",
        type: "staff_email",
        label: "",
        destination: "frontdesk@example.com",
        status: "draft"
      })
    ).rejects.toThrow("Notification destination label is required.");
    await expect(
      service.updateNotificationDestination({
        tenantId: "tenant_acme_fitness",
        destinationId: "dest_acme_staff_email",
        actorUserId: "user_owner_acme",
        type: "not_a_type" as never,
        label: "Staff notification email",
        destination: "frontdesk@example.com",
        status: "draft"
      })
    ).rejects.toThrow("Notification destination type is invalid.");

    expect(repository.snapshot()).toEqual(before);
  });

  it("defines the notification-destination update RPC as a multi-table write boundary", () => {
    expect(migration).toContain("create table notification_destination_revisions");
    expect(migration).toContain("create or replace function update_notification_destination");
    expect(migration).toContain("language plpgsql");
    expect(migration).toContain("security definer");
    expect(migration).toContain("for update");
    expect(migration).toContain("insert into notification_destination_revisions");
    expect(migration).toContain("insert into audit_events");
    expect(migration).toContain("'notification_destination.updated'");
    expect(migration).toContain("previous_destination_type");
    expect(migration).toContain("next_destination_type");
    expect(migration).toContain("previous_label");
    expect(migration).toContain("next_label");
    expect(migration).toContain("previous_destination");
    expect(migration).toContain("next_destination");
    expect(migration).toContain("if v_actor_user_id is null then");
    expect(migration).toContain("grant execute on function update_notification_destination");
    expect(migration).toContain("gen_random_uuid()::text");
    expect(migration).not.toContain("grant update on notification_destinations");
    expect(migration).not.toContain("grant insert on notification_destination_revisions");
    expect(migration).toContain(
      "revoke execute on function update_notification_destination(text, text, text, text, text, text, text)"
    );
  });

  it("extends rollback-only RLS verification for notification persistence and cross-tenant denial", () => {
    expect(rlsVerification).toContain("visible_own_notification_destinations <> 3");
    expect(rlsVerification).toContain("cross-tenant notification destination leaked through RLS");
    expect(rlsVerification).toContain("anon can execute notification-destination update RPC");
    expect(rlsVerification).toContain("public can execute notification-destination update RPC");
    expect(rlsVerification).toContain("update_notification_destination(");
    expect(rlsVerification).toContain(
      "notification_revisions_after <> notification_revisions_before + 1"
    );
    expect(rlsVerification).toContain(
      "notification_audit_events_after <> notification_audit_events_before + 1"
    );
    expect(rlsVerification).toContain(
      "cross-tenant RPC notification-destination update unexpectedly succeeded"
    );
  });
});
