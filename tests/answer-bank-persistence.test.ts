import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AnswerBankApplicationService } from "@/application/answer-bank/service";
import { InMemoryAnswerBankRepository } from "@/application/answer-bank/in-memory-repository";
import { answerBankEntries, answerBankRevisions, auditEvents, sourceDocuments, sourceFacts } from "@/domain/seed";

const migration = readdirSync("neon/migrations")
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(`neon/migrations/${file}`, "utf8"))
  .join("\n");
const proposalMigration = readFileSync(
  "neon/migrations/20260613020000_answer_proposals_from_manual_source.sql",
  "utf8"
);
const answerReviewMigration = readFileSync(
  "neon/migrations/20260613030000_owner_answer_review_queue.sql",
  "utf8"
);
const rlsVerification = readFileSync("db/rls-answer-bank-verification.sql", "utf8");

describe("answer-bank backend persistence tracer bullet", () => {
  it("edits one draft answer through an atomic repository boundary", async () => {
    const repository = new InMemoryAnswerBankRepository({
      entries: answerBankEntries.map((entry) => ({ ...entry })),
      revisions: answerBankRevisions.map((revision) => ({ ...revision })),
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } }))
    });
    const service = new AnswerBankApplicationService(repository);

    const edited = await service.editDraftAnswer({
      tenantId: "tenant_acme_fitness",
      entryId: "answer_hours",
      actorUserId: "user_owner_acme",
      topic: "hours",
      question: "What are your verified staffed hours?",
      answer: "Staffed hours are pending final owner confirmation."
    });
    const snapshot = repository.snapshot();

    expect(edited).toMatchObject({
      id: "answer_hours",
      approvalStatus: "draft",
      ownerAction: "edit",
      runtimeBehavior: "needs_owner_review",
      answer: "Staffed hours are pending final owner confirmation."
    });
    expect(snapshot.revisions).toContainEqual(
      expect.objectContaining({
        answerBankEntryId: "answer_hours",
        revisionIntent: "edit",
        previousStatus: "draft",
        nextStatus: "draft"
      })
    );
    expect(snapshot.auditEvents).toContainEqual(
      expect.objectContaining({
        subjectType: "answer_bank_entry",
        subjectId: "answer_hours",
        action: "answer_bank_entry.draft_edited"
      })
    );
  });

  it("rolls back answer, revision, and audit state when the transaction fails mid-write", async () => {
    const repository = new InMemoryAnswerBankRepository({
      entries: answerBankEntries.map((entry) => ({ ...entry })),
      revisions: answerBankRevisions.map((revision) => ({ ...revision })),
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } }))
    });
    const before = repository.snapshot();
    const service = new AnswerBankApplicationService(repository);

    repository.requestFailureAfterAnswerUpdate();

    await expect(
      service.editDraftAnswer({
        tenantId: "tenant_acme_fitness",
        entryId: "answer_hours",
        actorUserId: "user_owner_acme",
        topic: "hours",
        question: "This update should roll back",
        answer: "This answer should roll back"
      })
    ).rejects.toThrow("Injected failure after answer update.");

    expect(repository.snapshot()).toEqual(before);
  });

  it("approves a draft answer through an atomic repository boundary", async () => {
    const repository = new InMemoryAnswerBankRepository({
      entries: answerBankEntries.map((entry) => ({ ...entry })),
      revisions: answerBankRevisions.map((revision) => ({ ...revision })),
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } }))
    });
    const service = new AnswerBankApplicationService(repository);

    const approved = await service.approveAnswer({
      tenantId: "tenant_acme_fitness",
      entryId: "answer_hours",
      actorUserId: "user_owner_acme"
    });
    const snapshot = repository.snapshot();

    expect(approved).toMatchObject({
      id: "answer_hours",
      approvalStatus: "approved",
      approvedByUserId: "user_owner_acme",
      ownerAction: "approve",
      runtimeBehavior: "answer_live"
    });
    expect(approved.approvedAt).toBeDefined();
    expect(snapshot.revisions).toContainEqual(
      expect.objectContaining({
        answerBankEntryId: "answer_hours",
        revisionIntent: "approval",
        previousStatus: "draft",
        nextStatus: "approved"
      })
    );
    expect(snapshot.auditEvents).toContainEqual(
      expect.objectContaining({
        subjectType: "answer_bank_entry",
        subjectId: "answer_hours",
        action: "answer_bank_entry.approved"
      })
    );
  });

  it("approves a conflict answer as an owner conflict-resolution approval", async () => {
    const repository = new InMemoryAnswerBankRepository({
      entries: answerBankEntries.map((entry) => ({ ...entry })),
      revisions: answerBankRevisions.map((revision) => ({ ...revision })),
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } }))
    });
    const service = new AnswerBankApplicationService(repository);

    const approved = await service.approveAnswer({
      tenantId: "tenant_acme_fitness",
      entryId: "answer_pricing",
      actorUserId: "user_owner_acme"
    });
    const snapshot = repository.snapshot();

    expect(approved).toMatchObject({
      id: "answer_pricing",
      approvalStatus: "approved",
      runtimeBehavior: "answer_live"
    });
    expect(snapshot.revisions).toContainEqual(
      expect.objectContaining({
        answerBankEntryId: "answer_pricing",
        revisionIntent: "approval",
        previousStatus: "conflict",
        nextStatus: "approved"
      })
    );
  });

  it("edits a conflict answer back to draft review", async () => {
    const repository = new InMemoryAnswerBankRepository({
      entries: answerBankEntries.map((entry) => ({ ...entry })),
      revisions: answerBankRevisions.map((revision) => ({ ...revision })),
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } }))
    });
    const service = new AnswerBankApplicationService(repository);

    const edited = await service.editDraftAnswer({
      tenantId: "tenant_acme_fitness",
      entryId: "answer_pricing",
      actorUserId: "user_owner_acme",
      topic: "pricing",
      question: "What should staff say about pricing?",
      answer: "Pricing should be reviewed with staff before sharing exact numbers."
    });
    const snapshot = repository.snapshot();

    expect(edited).toMatchObject({
      id: "answer_pricing",
      approvalStatus: "draft",
      runtimeBehavior: "needs_owner_review"
    });
    expect(snapshot.revisions).toContainEqual(
      expect.objectContaining({
        answerBankEntryId: "answer_pricing",
        revisionIntent: "conflict_resolution",
        previousStatus: "conflict",
        nextStatus: "draft"
      })
    );
    expect(snapshot.auditEvents).toContainEqual(
      expect.objectContaining({
        subjectType: "answer_bank_entry",
        subjectId: "answer_pricing",
        action: "answer_bank_entry.conflict_resolved"
      })
    );
  });

  it("retires a draft answer through an atomic repository boundary", async () => {
    const repository = new InMemoryAnswerBankRepository({
      entries: answerBankEntries.map((entry) => ({ ...entry })),
      revisions: answerBankRevisions.map((revision) => ({ ...revision })),
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } }))
    });
    const service = new AnswerBankApplicationService(repository);

    const retired = await service.retireAnswer({
      tenantId: "tenant_acme_fitness",
      entryId: "answer_hours",
      actorUserId: "user_owner_acme"
    });
    const snapshot = repository.snapshot();

    expect(retired).toMatchObject({
      id: "answer_hours",
      approvalStatus: "retired",
      ownerAction: "retire",
      runtimeBehavior: "blocked_until_resolved"
    });
    expect(retired.retiredAt).toBeDefined();
    expect(snapshot.revisions).toContainEqual(
      expect.objectContaining({
        answerBankEntryId: "answer_hours",
        revisionIntent: "retirement",
        previousStatus: "draft",
        nextStatus: "retired"
      })
    );
    expect(snapshot.auditEvents).toContainEqual(
      expect.objectContaining({
        subjectType: "answer_bank_entry",
        subjectId: "answer_hours",
        action: "answer_bank_entry.retired"
      })
    );
  });

  it("rolls back retirement answer, revision, and audit state when the transaction fails mid-write", async () => {
    const repository = new InMemoryAnswerBankRepository({
      entries: answerBankEntries.map((entry) => ({ ...entry })),
      revisions: answerBankRevisions.map((revision) => ({ ...revision })),
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } }))
    });
    const before = repository.snapshot();
    const service = new AnswerBankApplicationService(repository);

    repository.requestFailureAfterAnswerUpdate();

    await expect(
      service.retireAnswer({
        tenantId: "tenant_acme_fitness",
        entryId: "answer_hours",
        actorUserId: "user_owner_acme"
      })
    ).rejects.toThrow("Injected failure after answer update.");

    expect(repository.snapshot()).toEqual(before);
  });

  it("rolls back approval answer, revision, and audit state when the transaction fails mid-write", async () => {
    const repository = new InMemoryAnswerBankRepository({
      entries: answerBankEntries.map((entry) => ({ ...entry })),
      revisions: answerBankRevisions.map((revision) => ({ ...revision })),
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } }))
    });
    const before = repository.snapshot();
    const service = new AnswerBankApplicationService(repository);

    repository.requestFailureAfterAnswerUpdate();

    await expect(
      service.approveAnswer({
        tenantId: "tenant_acme_fitness",
        entryId: "answer_hours",
        actorUserId: "user_owner_acme"
      })
    ).rejects.toThrow("Injected failure after answer update.");

    expect(repository.snapshot()).toEqual(before);
  });

  it("stages answer proposals from manual source facts without approving them", async () => {
    const repository = new InMemoryAnswerBankRepository({
      entries: answerBankEntries.map((entry) => ({ ...entry })),
      revisions: answerBankRevisions.map((revision) => ({ ...revision })),
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      sourceDocuments: sourceDocuments.map((document) => ({ ...document })),
      sourceFacts: [
        ...sourceFacts.map((fact) => ({ ...fact })),
        {
          id: "fact_manual_tours",
          tenantId: "tenant_acme_fitness",
          locationId: "loc_acme_main",
          sourceDocumentId: "source_acme_owner_notes",
          topic: "tour windows",
          value: "Tours can be offered on weekday evenings after staff confirmation.",
          confidence: 0.91,
          reviewStatus: "proposed",
          createdAt: "2026-06-13T12:00:00.000Z"
        },
        {
          id: "fact_manual_pricing",
          tenantId: "tenant_acme_fitness",
          locationId: "loc_acme_main",
          sourceDocumentId: "source_acme_owner_notes",
          topic: "pricing",
          value: "Pricing language conflicts with public copy and must stay blocked.",
          confidence: 0.76,
          conflictGroup: "pricing-public-copy",
          reviewStatus: "proposed",
          createdAt: "2026-06-13T12:01:00.000Z"
        }
      ]
    });
    const service = new AnswerBankApplicationService(repository);

    const result = await service.proposeAnswersFromManualSource({
      tenantId: "tenant_acme_fitness",
      sourceDocumentId: "source_acme_owner_notes",
      actorUserId: "user_owner_acme"
    });
    const snapshot = repository.snapshot();
    const stagedEntries = snapshot.entries.filter((entry) => entry.id.startsWith("answer_proposal_"));

    expect(result).toEqual({ proposedCount: 2, conflictCount: 1 });
    expect(stagedEntries).toHaveLength(2);
    expect(stagedEntries).toContainEqual(
      expect.objectContaining({
        approvalStatus: "draft",
        runtimeBehavior: "needs_owner_review",
        sourceDocumentId: "source_acme_owner_notes"
      })
    );
    expect(stagedEntries).toContainEqual(
      expect.objectContaining({
        approvalStatus: "conflict",
        runtimeBehavior: "blocked_until_resolved",
        sourceDocumentId: "source_acme_owner_notes"
      })
    );
    expect(stagedEntries.every((entry) => !entry.approvedAt && !entry.approvedByUserId)).toBe(true);
    expect(snapshot.revisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ revisionIntent: "import_proposal", nextStatus: "draft" }),
        expect.objectContaining({ revisionIntent: "import_proposal", nextStatus: "conflict" })
      ])
    );
    expect(snapshot.sourceFacts).toContainEqual(
      expect.objectContaining({
        id: "fact_manual_tours",
        reviewStatus: "needs_review",
        proposedAnswerEntryId: expect.stringMatching(/^answer_proposal_/)
      })
    );
    expect(snapshot.sourceFacts).toContainEqual(
      expect.objectContaining({
        id: "fact_manual_pricing",
        reviewStatus: "conflict",
        proposedAnswerEntryId: expect.stringMatching(/^answer_proposal_/)
      })
    );
    expect(snapshot.auditEvents).toContainEqual(
      expect.objectContaining({
        subjectType: "source_document",
        subjectId: "source_acme_owner_notes",
        action: "source_document.answer_proposals_staged",
        metadata: expect.objectContaining({
          source_type: "manual",
          proposed_count: 2,
          conflict_count: 1
        })
      })
    );
  });

  it("rolls back answer proposals, revisions, source facts, and audit state when proposal staging fails", async () => {
    const repository = new InMemoryAnswerBankRepository({
      entries: answerBankEntries.map((entry) => ({ ...entry })),
      revisions: answerBankRevisions.map((revision) => ({ ...revision })),
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      sourceDocuments: sourceDocuments.map((document) => ({ ...document })),
      sourceFacts: [
        ...sourceFacts.map((fact) => ({ ...fact })),
        {
          id: "fact_manual_tours",
          tenantId: "tenant_acme_fitness",
          locationId: "loc_acme_main",
          sourceDocumentId: "source_acme_owner_notes",
          topic: "tour windows",
          value: "This proposal should roll back.",
          confidence: 0.91,
          reviewStatus: "proposed",
          createdAt: "2026-06-13T12:00:00.000Z"
        }
      ]
    });
    const before = repository.snapshot();
    const service = new AnswerBankApplicationService(repository);

    repository.requestFailureAfterProposalAnswerInsert();

    await expect(
      service.proposeAnswersFromManualSource({
        tenantId: "tenant_acme_fitness",
        sourceDocumentId: "source_acme_owner_notes",
        actorUserId: "user_owner_acme"
      })
    ).rejects.toThrow("Injected failure after proposal answer insert.");

    expect(repository.snapshot()).toEqual(before);
  });

  it("refreshes an existing draft proposal for the same manual source topic instead of duplicating it", async () => {
    const repository = new InMemoryAnswerBankRepository({
      entries: [
        ...answerBankEntries.map((entry) => ({ ...entry })),
        {
          id: "answer_proposal_existing_hours",
          tenantId: "tenant_acme_fitness",
          locationId: "loc_acme_main",
          topic: "hours",
          question: "What should staff say about hours?",
          answer: "Old hours draft.",
          approvalStatus: "draft",
          sourceDocumentId: "source_acme_owner_notes",
          sourceLabel: "Owner setup notes",
          ownerAction: "edit",
          runtimeBehavior: "needs_owner_review",
          reviewNote: "Old proposal.",
          updatedAt: "2026-06-13T11:00:00.000Z"
        }
      ],
      revisions: answerBankRevisions.map((revision) => ({ ...revision })),
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      sourceDocuments: sourceDocuments.map((document) => ({ ...document })),
      sourceFacts: [
        ...sourceFacts.map((fact) => ({ ...fact })),
        {
          id: "fact_manual_hours_refresh",
          tenantId: "tenant_acme_fitness",
          locationId: "loc_acme_main",
          sourceDocumentId: "source_acme_owner_notes",
          topic: "hours",
          value: "New staffed hours draft from re-intake.",
          confidence: 0.94,
          reviewStatus: "proposed",
          createdAt: "2026-06-13T12:00:00.000Z"
        }
      ]
    });
    const before = repository.snapshot();
    const service = new AnswerBankApplicationService(repository);

    const result = await service.proposeAnswersFromManualSource({
      tenantId: "tenant_acme_fitness",
      sourceDocumentId: "source_acme_owner_notes",
      actorUserId: "user_owner_acme"
    });
    const snapshot = repository.snapshot();
    const refreshed = snapshot.entries.find((entry) => entry.id === "answer_proposal_existing_hours");

    expect(result).toEqual({ proposedCount: 1, conflictCount: 0 });
    expect(snapshot.entries).toHaveLength(before.entries.length);
    expect(refreshed).toMatchObject({
      answer: "New staffed hours draft from re-intake.",
      approvalStatus: "draft",
      runtimeBehavior: "needs_owner_review"
    });
    expect(snapshot.revisions).toContainEqual(
      expect.objectContaining({
        answerBankEntryId: "answer_proposal_existing_hours",
        revisionIntent: "import_proposal",
        previousStatus: "draft",
        nextStatus: "draft"
      })
    );
    expect(snapshot.sourceFacts).toContainEqual(
      expect.objectContaining({
        id: "fact_manual_hours_refresh",
        proposedAnswerEntryId: "answer_proposal_existing_hours",
        reviewStatus: "needs_review"
      })
    );
  });

  it("rejects approval for missing or already-final answers without mutating state", async () => {
    const repository = new InMemoryAnswerBankRepository({
      entries: answerBankEntries.map((entry) => ({ ...entry })),
      revisions: answerBankRevisions.map((revision) => ({ ...revision })),
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } }))
    });
    const before = repository.snapshot();
    const service = new AnswerBankApplicationService(repository);

    await expect(
      service.approveAnswer({
        tenantId: "tenant_acme_fitness",
        entryId: "missing_answer",
        actorUserId: "user_owner_acme"
      })
    ).rejects.toThrow("Answer bank entry not found.");
    await expect(
      service.approveAnswer({
        tenantId: "tenant_acme_fitness",
        entryId: "answer_amenities",
        actorUserId: "user_owner_acme"
      })
    ).rejects.toThrow("Only draft or conflict answers can be approved.");
    await expect(
      service.approveAnswer({
        tenantId: "tenant_acme_fitness",
        entryId: "answer_tours",
        actorUserId: "user_owner_acme"
      })
    ).rejects.toThrow("Only draft or conflict answers can be approved.");

    expect(repository.snapshot()).toEqual(before);
  });

  it("defines the answer edit RPC as the only multi-table write boundary", () => {
    expect(migration).toContain("create or replace function edit_answer_bank_draft");
    expect(migration).toContain("language plpgsql");
    expect(migration).toContain("security definer");
    expect(migration).toContain("insert into answer_bank_revisions");
    expect(migration).toContain("insert into audit_events");
    expect(migration).toContain("grant execute on function edit_answer_bank_draft");
    expect(migration).toContain("gen_random_uuid()::text");
    expect(migration).not.toContain("p_revision_id");
    expect(migration).not.toContain("p_audit_event_id");
    expect(migration).not.toContain("grant update on answer_bank_entries");
    expect(migration).toContain("length(p_answer) > 4000");
    expect(migration).toContain(
      "revoke execute on function edit_answer_bank_draft(text, text, text, text, text, text) from public, anonymous;"
    );
  });

  it("defines the answer approval RPC as a multi-table write boundary", () => {
    expect(migration).toContain("create or replace function approve_answer_bank_entry");
    expect(migration).toContain("language plpgsql");
    expect(migration).toContain("security definer");
    expect(migration).toContain("approval_status = 'approved'");
    expect(migration).toContain("approved_by_user_id = v_actor_user_id");
    expect(migration).toContain("runtime_behavior = 'answer_live'");
    expect(migration).toContain("insert into answer_bank_revisions");
    expect(migration).toContain("'approval'");
    expect(migration).toContain("insert into audit_events");
    expect(migration).toContain("'answer_bank_entry.approved'");
    expect(migration).toContain("grant execute on function approve_answer_bank_entry");
    expect(migration).toContain("gen_random_uuid()::text");
    expect(migration).toContain("v_existing.approval_status not in ('draft', 'conflict')");
    expect(migration).toContain(
      "revoke execute on function approve_answer_bank_entry(text, text, text) from public, anonymous;"
    );
  });

  it("defines the manual-source answer proposal RPC as a multi-table write boundary", () => {
    expect(migration).toContain("create or replace function propose_answers_from_manual_source");
    expect(migration).toContain("language plpgsql");
    expect(migration).toContain("security definer");
    expect(migration).toContain("is_active_tenant_owner");
    expect(migration).toContain("and source_type = 'manual'");
    expect(migration).toContain("insert into answer_bank_entries");
    expect(migration).toContain("insert into answer_bank_revisions");
    expect(migration).toContain("'import_proposal'");
    expect(migration).toContain("update source_facts");
    expect(migration).toContain("proposed_answer_entry_id = v_entry.id");
    expect(migration).toContain("update source_documents");
    expect(migration).toContain("insert into audit_events");
    expect(migration).toContain("'source_document.answer_proposals_staged'");
    expect(migration).toContain("grant execute on function propose_answers_from_manual_source");
    expect(migration).toContain(
      "revoke execute on function propose_answers_from_manual_source(text, text, text)"
    );
    expect(proposalMigration).not.toContain("approval_status = 'approved'");
    expect(proposalMigration).not.toContain("runtime_behavior = 'answer_live'");
    expect(answerReviewMigration).toContain("v_existing_proposal");
    expect(answerReviewMigration).toContain("approval_status in ('draft', 'conflict')");
    expect(answerReviewMigration).toContain("lower(btrim(topic)) = lower(btrim(v_fact.topic))");
  });

  it("defines the answer retirement RPC as a multi-table write boundary", () => {
    expect(migration).toContain("create or replace function retire_answer_bank_entry");
    expect(migration).toContain("language plpgsql");
    expect(migration).toContain("security definer");
    expect(migration).toContain("approval_status = 'retired'");
    expect(migration).toContain("retired_at = now()");
    expect(migration).toContain("owner_action = 'retire'");
    expect(migration).toContain("'retirement'");
    expect(migration).toContain("'answer_bank_entry.retired'");
    expect(migration).toContain("grant execute on function retire_answer_bank_entry");
    expect(migration).toContain(
      "revoke execute on function retire_answer_bank_entry(text, text, text) from public, anonymous;"
    );
  });

  it("enables deny-by-default RLS for every table reachable by the workflow", () => {
    for (const table of [
      "plans",
      "plan_entitlements",
      "tenants",
      "users",
      "tenant_memberships",
      "locations",
      "source_documents",
      "answer_bank_entries",
      "answer_bank_revisions",
      "audit_events"
    ]) {
      expect(migration).toContain(`alter table ${table} enable row level security;`);
    }

    expect(migration).toContain("create policy \"members read answer bank entries\"");
    expect(migration).toContain("revoke execute on function current_app_user_id() from public, anonymous;");
    expect(migration).toContain("revoke execute on function is_active_tenant_member(text) from public, anonymous;");
    expect(migration).toContain("revoke execute on function is_active_tenant_owner(text) from public, anonymous;");
    expect(migration).not.toContain("create policy \"owners update answer bank entries\"");
    expect(migration).not.toContain("create policy \"owners insert answer bank revisions\"");
    expect(migration).not.toContain("create policy \"owners insert audit events\"");
  });

  it("keeps cross-tenant denial verification runnable as SQL", () => {
    expect(rlsVerification).toContain("visible_cross_tenant_answers <> 0");
    expect(rlsVerification).toContain("cross-tenant answer leaked through RLS");
    expect(rlsVerification).toContain("'tenant_crossfit_north'");
    expect(rlsVerification).toContain("cross-tenant RPC edit unexpectedly succeeded");
    expect(rlsVerification).toContain("revisions_after <> revisions_before + 1");
    expect(rlsVerification).toContain("audit_events_after <> audit_events_before + 1");
    expect(rlsVerification).toContain("has_function_privilege");
    expect(rlsVerification).toContain("anon can execute answer-bank edit RPC");
    expect(rlsVerification).toContain("public can execute answer-bank edit RPC");
    expect(rlsVerification).toContain("anon can execute answer-bank approval RPC");
    expect(rlsVerification).toContain("public can execute answer-bank approval RPC");
    expect(rlsVerification).toContain("anon can execute answer proposal RPC");
    expect(rlsVerification).toContain("public can execute answer proposal RPC");
    expect(rlsVerification).toContain("anon can execute answer retirement RPC");
    expect(rlsVerification).toContain("public can execute answer retirement RPC");
    expect(rlsVerification).toContain("approve_answer_bank_entry(");
    expect(rlsVerification).toContain("propose_answers_from_manual_source(");
    expect(rlsVerification).toContain("approval_revisions_after <> approval_revisions_before + 1");
    expect(rlsVerification).toContain("approval_audit_events_after <> approval_audit_events_before + 1");
    expect(rlsVerification).toContain("cross-tenant RPC approval unexpectedly succeeded");
    expect(rlsVerification).toContain("cross-tenant answer proposal unexpectedly succeeded");
    expect(rlsVerification).toContain("cross-tenant RPC retirement unexpectedly succeeded");
    expect(rlsVerification).toContain("cross-tenant answer proposal failure changed answer count");
    expect(rlsVerification).toContain("invalid answer proposal failure changed source fact count");
  });

  it("keeps the RLS verification script rollback-only so it is safe against hosted databases", () => {
    const statements = rlsVerification
      .split("\n")
      .map((line) => line.replace(/--.*$/, ""))
      .join("\n")
      .trim();
    expect(statements.startsWith("begin;")).toBe(true);
    expect(statements.endsWith("rollback;")).toBe(true);
    expect(statements.toLowerCase()).not.toContain("commit;");
  });
});
