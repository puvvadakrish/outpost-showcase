import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { InMemorySourceRepository } from "@/application/sources/in-memory-repository";
import { SourceApplicationService } from "@/application/sources/service";
import { auditEvents, sourceDocuments, sourceFacts } from "@/domain/seed";

const migration = readdirSync("neon/migrations")
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(`neon/migrations/${file}`, "utf8"))
  .join("\n");
const rlsVerification = readFileSync("db/rls-answer-bank-verification.sql", "utf8");
const ownerActions = readFileSync("src/app/owner/actions.ts", "utf8");

describe("manual source intake backend persistence", () => {
  it("upserts a manual source document and proposed facts through an atomic boundary", async () => {
    const repository = new InMemorySourceRepository({
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      sourceDocuments: sourceDocuments.map((document) => ({ ...document })),
      sourceFacts: sourceFacts.map((fact) => ({ ...fact }))
    });
    const service = new SourceApplicationService(repository);

    const sourceDocument = await service.upsertManualSourceDocument({
      tenantId: "tenant_acme_fitness",
      locationId: "loc_acme_main",
      actorUserId: "user_staff_acme",
      sourceDocumentId: "source_acme_owner_notes",
      label: "Owner setup notes",
      facts: [
        {
          topic: "hours",
          value: "Staffed hours are staged from owner manual notes and need review.",
          confidence: 0.9
        },
        {
          topic: "tours",
          value: "Tour requests should stay staff-routed until owner approval.",
          confidence: 0.88,
          conflictGroup: "tour-routing"
        }
      ]
    });
    const snapshot = repository.snapshot();

    expect(sourceDocument).toMatchObject({
      id: "source_acme_owner_notes",
      tenantId: "tenant_acme_fitness",
      locationId: "loc_acme_main",
      type: "manual",
      status: "needs_review",
      factsFound: 2,
      conflictsFound: 1
    });
    expect(
      snapshot.sourceFacts.filter((fact) => fact.sourceDocumentId === "source_acme_owner_notes")
    ).toHaveLength(2);
    expect(snapshot.sourceFacts).toContainEqual(
      expect.objectContaining({
        tenantId: "tenant_acme_fitness",
        locationId: "loc_acme_main",
        sourceDocumentId: "source_acme_owner_notes",
        topic: "tours",
        conflictGroup: "tour-routing",
        reviewStatus: "proposed"
      })
    );
    expect(snapshot.auditEvents).toContainEqual(
      expect.objectContaining({
        subjectType: "source_document",
        subjectId: "source_acme_owner_notes",
        action: "source_document.manual_intake_upserted",
        actorUserId: "user_staff_acme",
        metadata: expect.objectContaining({
          location_id: "loc_acme_main",
          source_type: "manual",
          facts_found: 2,
          conflicts_found: 1
        })
      })
    );
  });

  it("rolls back source document, source facts, and audit state when intake fails mid-write", async () => {
    const repository = new InMemorySourceRepository({
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      sourceDocuments: sourceDocuments.map((document) => ({ ...document })),
      sourceFacts: sourceFacts.map((fact) => ({ ...fact }))
    });
    const before = repository.snapshot();
    const service = new SourceApplicationService(repository);

    repository.requestFailureAfterSourceDocumentUpsert();

    await expect(
      service.upsertManualSourceDocument({
        tenantId: "tenant_acme_fitness",
        locationId: "loc_acme_main",
        actorUserId: "user_staff_acme",
        sourceDocumentId: "source_acme_owner_notes",
        label: "Owner setup notes",
        facts: [
          {
            topic: "hours",
            value: "This write should roll back.",
            confidence: 0.9
          }
        ]
      })
    ).rejects.toThrow("Injected failure after source document upsert.");

    expect(repository.snapshot()).toEqual(before);
  });

  it("rejects invalid manual source input without mutating state", async () => {
    const repository = new InMemorySourceRepository({
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      sourceDocuments: sourceDocuments.map((document) => ({ ...document })),
      sourceFacts: sourceFacts.map((fact) => ({ ...fact }))
    });
    const before = repository.snapshot();
    const service = new SourceApplicationService(repository);

    await expect(
      service.upsertManualSourceDocument({
        tenantId: "tenant_acme_fitness",
        locationId: "loc_acme_main",
        actorUserId: "user_staff_acme",
        label: "",
        facts: []
      })
    ).rejects.toThrow("Source label is required.");
    await expect(
      service.upsertManualSourceDocument({
        tenantId: "tenant_acme_fitness",
        locationId: "loc_acme_main",
        actorUserId: "user_staff_acme",
        label: "Owner setup notes",
        facts: [
          {
            topic: "hours",
            value: "Invalid confidence should fail before persistence.",
            confidence: 1.4
          }
        ]
      })
    ).rejects.toThrow("Source fact confidence must be between 0 and 1.");

    expect(repository.snapshot()).toEqual(before);
  });

  it("defines the manual source intake RPC as a multi-table write boundary", () => {
    expect(migration).toContain("create or replace function upsert_manual_source_document");
    expect(migration).toContain("language plpgsql");
    expect(migration).toContain("security definer");
    expect(migration).toContain("for update");
    expect(migration).toContain("insert into source_documents");
    expect(migration).toContain("delete from source_facts");
    expect(migration).toContain("insert into source_facts");
    expect(migration).toContain("insert into audit_events");
    expect(migration).toContain("'source_document.manual_intake_upserted'");
    expect(migration).toContain("is_active_tenant_member");
    expect(migration).toContain("if v_actor_user_id is null then");
    expect(migration).toContain("grant execute on function upsert_manual_source_document");
    expect(migration).toContain("revoke all on source_documents, source_facts from anonymous, authenticated");
    expect(migration).toContain("grant select on source_documents, source_facts to authenticated");
    expect(migration).not.toContain("grant insert on source_documents");
    expect(migration).not.toContain("grant update on source_documents");
    expect(migration).not.toContain("grant insert on source_facts");
    expect(migration).toContain(
      "revoke execute on function upsert_manual_source_document(text, text, text, text, jsonb)"
    );
  });

  it("extends rollback-only RLS verification for source intake and cross-tenant denial", () => {
    expect(rlsVerification).toContain("anon can execute manual source intake RPC");
    expect(rlsVerification).toContain("public can execute manual source intake RPC");
    expect(rlsVerification).toContain("upsert_manual_source_document(");
    expect(rlsVerification).toContain("manual source intake RPC did not return staged manual source");
    expect(rlsVerification).toContain("direct source document table insert unexpectedly succeeded");
    expect(rlsVerification).toContain("direct source fact table insert unexpectedly succeeded");
    expect(rlsVerification).toContain("cross-tenant source document leaked through RLS");
    expect(rlsVerification).toContain("cross-tenant source fact leaked through RLS");
    expect(rlsVerification).toContain("cross-tenant RPC manual source intake unexpectedly succeeded");
    expect(rlsVerification).toContain("cross-tenant manual source failure changed source fact count");
    expect(rlsVerification).toContain("invalid manual source fact unexpectedly succeeded");
    expect(rlsVerification).toContain("invalid manual source fact failure changed audit event count");
  });

  it("keeps the owner action from wiping a source with an empty fact submission", () => {
    expect(ownerActions).toContain("value.trim() ? Number(value) : Number.NaN");
    expect(ownerActions).toContain("facts.length === 0");
    expect(ownerActions).toContain("Add at least one proposed fact before saving manual source intake.");
  });
});
