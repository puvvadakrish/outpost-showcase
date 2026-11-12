import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { HandoffRuleApplicationService } from "@/application/handoff-rules/service";
import { InMemoryHandoffRuleRepository } from "@/application/handoff-rules/in-memory-repository";
import { auditEvents, handoffRules } from "@/domain/seed";
import { NeonHandoffRuleRepository } from "@/infrastructure/neon/handoff-rule-repository";

vi.mock("server-only", () => ({}));

const migration = readdirSync("neon/migrations")
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(`neon/migrations/${file}`, "utf8"))
  .join("\n");
const rlsVerification = readFileSync("db/rls-answer-bank-verification.sql", "utf8");

describe("handoff-rule backend persistence", () => {
  it("creates an always-draft handoff rule with an initial revision and audit event", async () => {
    const repository = new InMemoryHandoffRuleRepository({
      rules: handoffRules.map((rule) => ({ ...rule })),
      revisions: [],
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } }))
    });
    const service = new HandoffRuleApplicationService(repository);

    const created = await service.createHandoffRuleDraft({
      tenantId: " tenant_acme_fitness ",
      locationId: " loc_acme_main ",
      creationKey: " local-rule-1 ",
      actorUserId: "user_owner_acme",
      trigger: "topic",
      topic: " membership freeze ",
      action: "create_task",
      destination: " front desk queue ",
      activeWindow: " staffed hours ",
      priority: 40
    });
    const snapshot = repository.snapshot();
    const revision = snapshot.revisions.at(-1);

    expect(created).toMatchObject({
      tenantId: "tenant_acme_fitness",
      locationId: "loc_acme_main",
      trigger: "topic",
      topic: "membership freeze",
      action: "create_task",
      destination: "front desk queue",
      activeWindow: "staffed hours",
      priority: 40,
      status: "draft"
    });
    expect(revision).toMatchObject({
      tenantId: "tenant_acme_fitness",
      locationId: "loc_acme_main",
      handoffRuleId: created.id,
      actorUserId: "user_owner_acme",
      previousTrigger: "topic",
      nextTrigger: "topic",
      previousTopic: "membership freeze",
      nextTopic: "membership freeze",
      previousStatus: "draft",
      nextStatus: "draft",
      previousPriority: 40,
      nextPriority: 40
    });
    expect(snapshot.auditEvents.at(-1)).toMatchObject({
      tenantId: "tenant_acme_fitness",
      actorUserId: "user_owner_acme",
      subjectType: "handoff_rule",
      subjectId: created.id,
      action: "handoff_rule.created",
      metadata: {
        creation_key: "local-rule-1",
        location_id: "loc_acme_main",
        status: "draft",
        revision_id: revision?.id
      }
    });
  });

  it("replays a creation key without duplicating the row, revision, or audit", async () => {
    const repository = new InMemoryHandoffRuleRepository({
      rules: handoffRules.map((rule) => ({ ...rule })),
      revisions: [],
      auditEvents: []
    });
    const service = new HandoffRuleApplicationService(repository);
    const command = {
      tenantId: "tenant_acme_fitness",
      creationKey: "same-rule-request",
      actorUserId: "user_owner_acme",
      trigger: "topic" as const,
      topic: "freeze",
      action: "create_task" as const,
      destination: "front desk queue",
      activeWindow: "always",
      priority: 40
    };

    const first = await service.createHandoffRuleDraft(command);
    const second = await service.createHandoffRuleDraft(command);
    const snapshot = repository.snapshot();

    expect(second.id).toBe(first.id);
    expect(snapshot.rules.filter((rule) => rule.id === first.id)).toHaveLength(1);
    expect(snapshot.revisions).toHaveLength(1);
    expect(snapshot.auditEvents).toHaveLength(1);
  });

  it("rejects creation-key reuse for different handoff-rule work", async () => {
    const repository = new InMemoryHandoffRuleRepository({ rules: [], revisions: [], auditEvents: [] });
    const service = new HandoffRuleApplicationService(repository);
    const command = {
      tenantId: "tenant_acme_fitness",
      creationKey: "same-rule-request",
      actorUserId: "user_owner_acme",
      trigger: "topic" as const,
      topic: "freeze",
      action: "create_task" as const,
      destination: "front desk queue",
      activeWindow: "always",
      priority: 40
    };

    await service.createHandoffRuleDraft(command);
    await expect(
      service.createHandoffRuleDraft({ ...command, topic: "billing question" })
    ).rejects.toThrow("Handoff rule creation key conflicts with different work.");
  });

  it.each([
    {
      injectFailure: (repository: InMemoryHandoffRuleRepository) =>
        repository.requestFailureAfterRuleCreation(),
      message: "Injected failure after handoff rule creation."
    },
    {
      injectFailure: (repository: InMemoryHandoffRuleRepository) =>
        repository.requestFailureAfterInitialRevisionCreation(),
      message: "Injected failure after initial handoff rule revision creation."
    }
  ])("rolls back draft creation when a transaction stage fails", async ({ injectFailure, message }) => {
    const repository = new InMemoryHandoffRuleRepository({
      rules: handoffRules.map((rule) => ({ ...rule })),
      revisions: [],
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } }))
    });
    const before = repository.snapshot();
    const service = new HandoffRuleApplicationService(repository);

    injectFailure(repository);

    await expect(
      service.createHandoffRuleDraft({
        tenantId: "tenant_acme_fitness",
        creationKey: "local-rule-2",
        actorUserId: "user_owner_acme",
        trigger: "topic",
        topic: "membership freeze",
        action: "create_task",
        destination: "front desk queue",
        activeWindow: "always",
        priority: 40
      })
    ).rejects.toThrow(message);

    expect(repository.snapshot()).toEqual(before);
  });

  it("rejects invalid handoff-rule drafts without mutating state", async () => {
    const repository = new InMemoryHandoffRuleRepository({
      rules: handoffRules.map((rule) => ({ ...rule })),
      revisions: [],
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } }))
    });
    const before = repository.snapshot();
    const service = new HandoffRuleApplicationService(repository);

    await expect(
      service.createHandoffRuleDraft({
        tenantId: " ",
        creationKey: "local-rule-3",
        actorUserId: "user_owner_acme",
        trigger: "topic",
        topic: "membership freeze",
        action: "create_task",
        destination: "front desk queue",
        activeWindow: "always",
        priority: 40
      })
    ).rejects.toThrow("Tenant identifier is required.");
    await expect(
      service.createHandoffRuleDraft({
        tenantId: "tenant_acme_fitness",
        creationKey: "local-rule-4",
        actorUserId: "user_owner_acme",
        trigger: "topic",
        topic: " ",
        action: "create_task",
        destination: "front desk queue",
        activeWindow: "always",
        priority: 40
      })
    ).rejects.toThrow("Handoff rule topic is required.");

    expect(repository.snapshot()).toEqual(before);
  });

  it("maps normalized draft creation to the Neon RPC without submitting status or IDs", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: "rule_generated",
        tenant_id: "tenant_acme_fitness",
        location_id: null,
        trigger: "topic",
        topic: "membership freeze",
        action: "create_task",
        destination: "front desk queue",
        active_window: "always",
        priority: 40,
        status: "draft",
        updated_at: "2026-07-13T12:00:00.000Z"
      },
      error: null
    });
    const repository = new NeonHandoffRuleRepository({ rpc } as never);

    const result = await repository.createHandoffRuleDraftTransaction({
      tenantId: "tenant_acme_fitness",
      locationId: undefined,
      creationKey: "local-rule-5",
      actorUserId: "user_owner_acme",
      trigger: "topic",
      topic: "membership freeze",
      action: "create_task",
      destination: "front desk queue",
      activeWindow: "always",
      priority: 40,
      note: "Owner created a draft."
    });

    expect(rpc).toHaveBeenCalledWith("create_handoff_rule_draft", {
      p_tenant_id: "tenant_acme_fitness",
      p_location_id: null,
      p_creation_key: "local-rule-5",
      p_trigger: "topic",
      p_topic: "membership freeze",
      p_action: "create_task",
      p_destination: "front desk queue",
      p_active_window: "always",
      p_priority: 40,
      p_note: "Owner created a draft."
    });
    expect(rpc.mock.calls[0]?.[1]).not.toHaveProperty("p_status");
    expect(rpc.mock.calls[0]?.[1]).not.toHaveProperty("p_handoff_rule_id");
    expect(rpc.mock.calls[0]?.[1]).not.toHaveProperty("p_actor_user_id");
    expect(result.rule).toMatchObject({ id: "rule_generated", status: "draft" });
  });

  it("updates an existing handoff rule through an atomic repository boundary", async () => {
    const repository = new InMemoryHandoffRuleRepository({
      rules: handoffRules.map((rule) => ({ ...rule })),
      revisions: [],
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } }))
    });
    const service = new HandoffRuleApplicationService(repository);

    const updated = await service.updateHandoffRule({
      tenantId: "tenant_acme_fitness",
      ruleId: "rule_low_confidence",
      actorUserId: "user_owner_acme",
      trigger: "low_confidence",
      topic: "unapproved or uncertain fact",
      action: "create_task",
      destination: "front desk queue",
      activeWindow: "always",
      priority: 25,
      status: "active"
    });
    const snapshot = repository.snapshot();

    expect(updated).toMatchObject({
      id: "rule_low_confidence",
      topic: "unapproved or uncertain fact",
      priority: 25,
      status: "active"
    });
    expect(snapshot.revisions).toContainEqual(
      expect.objectContaining({
        handoffRuleId: "rule_low_confidence",
        previousTopic: "unapproved or low-confidence fact",
        nextTopic: "unapproved or uncertain fact",
        previousAction: "create_task",
        nextAction: "create_task",
        previousDestination: "front desk queue",
        nextDestination: "front desk queue",
        previousActiveWindow: "always",
        nextActiveWindow: "always",
        previousStatus: "active",
        nextStatus: "active",
        previousPriority: 20,
        nextPriority: 25
      })
    );
    expect(snapshot.auditEvents).toContainEqual(
      expect.objectContaining({
        subjectType: "handoff_rule",
        subjectId: "rule_low_confidence",
        action: "handoff_rule.updated",
        metadata: expect.objectContaining({
          previous_topic: "unapproved or low-confidence fact",
          next_topic: "unapproved or uncertain fact",
          previous_destination: "front desk queue",
          next_destination: "front desk queue",
          previous_active_window: "always",
          next_active_window: "always"
        })
      })
    );
  });

  it("rolls back handoff rule, revision, and audit state when the transaction fails mid-write", async () => {
    const repository = new InMemoryHandoffRuleRepository({
      rules: handoffRules.map((rule) => ({ ...rule })),
      revisions: [],
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } }))
    });
    const before = repository.snapshot();
    const service = new HandoffRuleApplicationService(repository);

    repository.requestFailureAfterRuleUpdate();

    await expect(
      service.updateHandoffRule({
        tenantId: "tenant_acme_fitness",
        ruleId: "rule_low_confidence",
        actorUserId: "user_owner_acme",
        trigger: "low_confidence",
        topic: "This update should roll back",
        action: "create_task",
        destination: "front desk queue",
        activeWindow: "always",
        priority: 25,
        status: "active"
      })
    ).rejects.toThrow("Injected failure after handoff rule update.");

    expect(repository.snapshot()).toEqual(before);
  });

  it("rejects missing or invalid handoff updates without mutating state", async () => {
    const repository = new InMemoryHandoffRuleRepository({
      rules: handoffRules.map((rule) => ({ ...rule })),
      revisions: [],
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } }))
    });
    const before = repository.snapshot();
    const service = new HandoffRuleApplicationService(repository);

    await expect(
      service.updateHandoffRule({
        tenantId: "tenant_acme_fitness",
        ruleId: "missing_rule",
        actorUserId: "user_owner_acme",
        trigger: "topic",
        topic: "missing",
        action: "create_task",
        destination: "front desk queue",
        activeWindow: "always",
        priority: 50,
        status: "draft"
      })
    ).rejects.toThrow("Handoff rule not found.");
    await expect(
      service.updateHandoffRule({
        tenantId: "tenant_acme_fitness",
        ruleId: "rule_low_confidence",
        actorUserId: "user_owner_acme",
        trigger: "low_confidence",
        topic: "",
        action: "create_task",
        destination: "front desk queue",
        activeWindow: "always",
        priority: 25,
        status: "active"
      })
    ).rejects.toThrow("Handoff rule topic is required.");
    await expect(
      service.updateHandoffRule({
        tenantId: "tenant_acme_fitness",
        ruleId: "rule_low_confidence",
        actorUserId: "user_owner_acme",
        trigger: "low_confidence",
        topic: "unapproved fact",
        action: "create_task",
        destination: "front desk queue",
        activeWindow: "always",
        priority: 0,
        status: "active"
      })
    ).rejects.toThrow("Handoff rule priority must be a whole number from 1 to 1000.");
    await expect(
      service.updateHandoffRule({
        tenantId: "tenant_acme_fitness",
        ruleId: "rule_low_confidence",
        actorUserId: "user_owner_acme",
        trigger: "not_a_trigger" as never,
        topic: "unapproved fact",
        action: "create_task",
        destination: "front desk queue",
        activeWindow: "always",
        priority: 25,
        status: "active"
      })
    ).rejects.toThrow("Handoff rule trigger is invalid.");

    expect(repository.snapshot()).toEqual(before);
  });

  it("defines the handoff-rule update RPC as a multi-table write boundary", () => {
    expect(migration).toContain("create table handoff_rule_revisions");
    expect(migration).toContain("create or replace function update_handoff_rule");
    expect(migration).toContain("language plpgsql");
    expect(migration).toContain("security definer");
    expect(migration).toContain("for update");
    expect(migration).toContain("insert into handoff_rule_revisions");
    expect(migration).toContain("insert into audit_events");
    expect(migration).toContain("'handoff_rule.updated'");
    expect(migration).toContain("previous_topic");
    expect(migration).toContain("next_topic");
    expect(migration).toContain("previous_destination");
    expect(migration).toContain("next_destination");
    expect(migration).toContain("previous_active_window");
    expect(migration).toContain("next_active_window");
    expect(migration).toContain("if v_actor_user_id is null then");
    expect(migration).toContain("grant execute on function update_handoff_rule");
    expect(migration).toContain("gen_random_uuid()::text");
    expect(migration).not.toContain("grant update on handoff_rules");
    expect(migration).not.toContain("grant insert on handoff_rule_revisions");
    expect(migration).toContain(
      "revoke execute on function update_handoff_rule(text, text, text, text, text, text, text, integer, text, text)"
    );
  });

  it("extends rollback-only RLS verification for handoff-rule persistence and cross-tenant denial", () => {
    expect(rlsVerification).toContain("visible_own_handoff_rules <> 3");
    expect(rlsVerification).toContain("cross-tenant handoff rule leaked through RLS");
    expect(rlsVerification).toContain("anon can execute handoff-rule update RPC");
    expect(rlsVerification).toContain("public can execute handoff-rule update RPC");
    expect(rlsVerification).toContain("update_handoff_rule(");
    expect(rlsVerification).toContain("handoff_revisions_after <> handoff_revisions_before + 1");
    expect(rlsVerification).toContain("handoff_audit_events_after <> handoff_audit_events_before + 1");
    expect(rlsVerification).toContain("cross-tenant RPC handoff-rule update unexpectedly succeeded");
  });
});
