import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { InMemoryTaskRepository } from "@/application/tasks/in-memory-repository";
import { TaskApplicationService } from "@/application/tasks/service";
import { auditEvents, taskEvents, tasks, usageEvents } from "@/domain/seed";

const migration = readdirSync("neon/migrations")
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(`neon/migrations/${file}`, "utf8"))
  .join("\n");
const rlsVerification = readFileSync("db/rls-answer-bank-verification.sql", "utf8");
const neonTaskRepository = readFileSync("src/infrastructure/neon/task-repository.ts", "utf8");

describe("task backend persistence", () => {
  it("creates a manual task through an atomic repository boundary", async () => {
    const repository = new InMemoryTaskRepository({
      tasks: tasks.map((task) => ({ ...task })),
      taskEvents: taskEvents.map((event) => ({ ...event })),
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      usageEvents: usageEvents.map((event) => ({ ...event }))
    });
    const service = new TaskApplicationService(repository);

    const created = await service.createManualTask({
      tenantId: "tenant_acme_fitness",
      locationId: "loc_acme_main",
      actorUserId: "user_staff_acme",
      channel: "email",
      claimForActor: true,
      requesterName: "Jordan Lee",
      requesterContact: "jordan@example.com",
      intent: "Tour follow-up",
      summary: "Jordan asked the desk for a weekday tour and pricing overview.",
      suggestedNextStep: "Call Jordan back and offer two tour windows this week.",
      confidence: 0.9
    });
    const snapshot = repository.snapshot();

    expect(created).toMatchObject({
      tenantId: "tenant_acme_fitness",
      locationId: "loc_acme_main",
      channel: "email",
      assigneeUserId: "user_staff_acme",
      requesterName: "Jordan Lee",
      status: "new"
    });
    expect(snapshot.taskEvents).toContainEqual(
      expect.objectContaining({
        taskId: created.id,
        eventType: "created",
        toStatus: "new",
        actorUserId: "user_staff_acme",
        note: "Manual task created through Outpost staff workboard."
      })
    );
    expect(snapshot.taskEvents).toContainEqual(
      expect.objectContaining({
        actorUserId: "user_staff_acme",
        eventType: "assigned",
        note: "Task claimed during human-entered intake.",
        taskId: created.id
      })
    );
    expect(snapshot.usageEvents).toContainEqual(
      expect.objectContaining({
        tenantId: "tenant_acme_fitness",
        locationId: "loc_acme_main",
        meter: "task_created",
        quantity: 1,
        sourceType: "task",
        sourceId: created.id
      })
    );
    expect(snapshot.auditEvents).toContainEqual(
      expect.objectContaining({
        subjectType: "task",
        subjectId: created.id,
        action: "task.created",
        metadata: expect.objectContaining({
          location_id: "loc_acme_main",
          channel: "email",
          status: "new"
        })
      })
    );
    expect(snapshot.auditEvents).toContainEqual(
      expect.objectContaining({
        action: "task.assigned",
        actorUserId: "user_staff_acme",
        subjectId: created.id
      })
    );
  });

  it("rolls back manual task, task event, usage, and audit state when creation fails mid-write", async () => {
    const repository = new InMemoryTaskRepository({
      tasks: tasks.map((task) => ({ ...task })),
      taskEvents: taskEvents.map((event) => ({ ...event })),
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      usageEvents: usageEvents.map((event) => ({ ...event }))
    });
    const before = repository.snapshot();
    const service = new TaskApplicationService(repository);

    repository.requestFailureAfterTaskInsert();

    await expect(
      service.createManualTask({
        tenantId: "tenant_acme_fitness",
        locationId: "loc_acme_main",
        actorUserId: "user_staff_acme",
        channel: "manual",
        claimForActor: false,
        requesterName: "Jordan Lee",
        requesterContact: "jordan@example.com",
        intent: "Tour follow-up",
        summary: "Jordan asked the desk for a weekday tour and pricing overview.",
        suggestedNextStep: "Call Jordan back and offer two tour windows this week.",
        confidence: 0.9
      })
    ).rejects.toThrow("Injected failure after task insert.");

    expect(repository.snapshot()).toEqual(before);
  });

  it("creates a staff task from an answer review through an atomic repository boundary", async () => {
    const repository = new InMemoryTaskRepository({
      tasks: tasks.map((task) => ({ ...task })),
      taskEvents: taskEvents.map((event) => ({ ...event })),
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      usageEvents: usageEvents.map((event) => ({ ...event }))
    });
    const service = new TaskApplicationService(repository);

    const created = await service.createTaskFromAnswer({
      tenantId: " tenant_acme_fitness ",
      answerBankEntryId: " answer_review_pricing ",
      actorUserId: "user_owner_acme"
    });
    const snapshot = repository.snapshot();

    expect(created).toMatchObject({
      tenantId: "tenant_acme_fitness",
      locationId: "loc_acme_main",
      channel: "manual",
      requesterName: "Owner review",
      requesterContact: "answer_review_pricing",
      status: "new"
    });
    expect(snapshot.taskEvents).toContainEqual(
      expect.objectContaining({
        taskId: created.id,
        eventType: "created",
        toStatus: "new",
        actorUserId: "user_owner_acme",
        note: "Task created from owner answer-bank review item answer_review_pricing."
      })
    );
    expect(snapshot.usageEvents).toContainEqual(
      expect.objectContaining({
        tenantId: "tenant_acme_fitness",
        locationId: "loc_acme_main",
        meter: "task_created",
        quantity: 1,
        sourceType: "task",
        sourceId: created.id
      })
    );
    expect(snapshot.auditEvents).toContainEqual(
      expect.objectContaining({
        subjectType: "task",
        subjectId: created.id,
        action: "task.created_from_answer",
        metadata: expect.objectContaining({
          location_id: "loc_acme_main",
          answer_bank_entry_id: "answer_review_pricing"
        })
      })
    );
  });

  it("rolls back answer-derived task, task event, usage, and audit state when creation fails mid-write", async () => {
    const repository = new InMemoryTaskRepository({
      tasks: tasks.map((task) => ({ ...task })),
      taskEvents: taskEvents.map((event) => ({ ...event })),
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      usageEvents: usageEvents.map((event) => ({ ...event }))
    });
    const before = repository.snapshot();
    const service = new TaskApplicationService(repository);

    repository.requestFailureAfterTaskInsert();

    await expect(
      service.createTaskFromAnswer({
        tenantId: "tenant_acme_fitness",
        answerBankEntryId: "answer_review_pricing",
        actorUserId: "user_owner_acme"
      })
    ).rejects.toThrow("Injected failure after task insert.");

    expect(repository.snapshot()).toEqual(before);
  });

  it("returns an existing unresolved answer-derived task without duplicate writes", async () => {
    const repository = new InMemoryTaskRepository({
      tasks: tasks.map((task) => ({ ...task })),
      taskEvents: taskEvents.map((event) => ({ ...event })),
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      usageEvents: usageEvents.map((event) => ({ ...event }))
    });
    const service = new TaskApplicationService(repository);

    const created = await service.createTaskFromAnswer({
      tenantId: "tenant_acme_fitness",
      answerBankEntryId: "answer_review_pricing",
      actorUserId: "user_owner_acme"
    });
    const beforeDuplicate = repository.snapshot();

    const duplicate = await service.createTaskFromAnswer({
      tenantId: "tenant_acme_fitness",
      answerBankEntryId: "answer_review_pricing",
      actorUserId: "user_owner_acme"
    });

    expect(duplicate.id).toBe(created.id);
    expect(repository.snapshot()).toEqual(beforeDuplicate);
  });

  it("allows a new answer-derived task after the prior task is terminal", async () => {
    const repository = new InMemoryTaskRepository({
      tasks: tasks.map((task) => ({ ...task })),
      taskEvents: taskEvents.map((event) => ({ ...event })),
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      usageEvents: usageEvents.map((event) => ({ ...event }))
    });
    const service = new TaskApplicationService(repository);

    const first = await service.createTaskFromAnswer({
      tenantId: "tenant_acme_fitness",
      answerBankEntryId: "answer_review_pricing",
      actorUserId: "user_owner_acme"
    });

    await service.updateTaskStatus({
      tenantId: "tenant_acme_fitness",
      locationId: first.locationId,
      taskId: first.id,
      actorUserId: "user_owner_acme",
      toStatus: "done"
    });

    const beforeSecond = repository.snapshot();
    const second = await service.createTaskFromAnswer({
      tenantId: "tenant_acme_fitness",
      answerBankEntryId: "answer_review_pricing",
      actorUserId: "user_owner_acme"
    });
    const afterSecond = repository.snapshot();

    expect(second.id).not.toBe(first.id);
    expect(afterSecond.tasks).toHaveLength(beforeSecond.tasks.length + 1);
    expect(afterSecond.taskEvents).toHaveLength(beforeSecond.taskEvents.length + 1);
    expect(afterSecond.usageEvents).toHaveLength(beforeSecond.usageEvents.length + 1);
    expect(afterSecond.auditEvents).toHaveLength(beforeSecond.auditEvents.length + 1);
  });

  it("rejects invalid manual task input without mutating state", async () => {
    const repository = new InMemoryTaskRepository({
      tasks: tasks.map((task) => ({ ...task })),
      taskEvents: taskEvents.map((event) => ({ ...event })),
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      usageEvents: usageEvents.map((event) => ({ ...event }))
    });
    const before = repository.snapshot();
    const service = new TaskApplicationService(repository);

    await expect(
      service.createManualTask({
        tenantId: "tenant_acme_fitness",
        locationId: "loc_acme_main",
        actorUserId: "user_staff_acme",
        channel: "social" as "manual",
        claimForActor: false,
        requesterName: "Jordan Lee",
        requesterContact: "jordan@example.com",
        intent: "Tour follow-up",
        summary: "Jordan asked the desk for a weekday tour and pricing overview.",
        suggestedNextStep: "Call Jordan back and offer two tour windows this week.",
        confidence: 0.9
      })
    ).rejects.toThrow("Task channel is invalid.");

    await expect(
      service.createManualTask({
        tenantId: "tenant_acme_fitness",
        locationId: "loc_acme_main",
        actorUserId: "user_staff_acme",
        channel: "manual",
        claimForActor: false,
        requesterName: "",
        requesterContact: "jordan@example.com",
        intent: "Tour follow-up",
        summary: "Jordan asked the desk for a weekday tour and pricing overview.",
        suggestedNextStep: "Call Jordan back and offer two tour windows this week.",
        confidence: 0.9
      })
    ).rejects.toThrow("Requester name is required.");
    await expect(
      service.createManualTask({
        tenantId: "tenant_acme_fitness",
        locationId: "loc_acme_main",
        actorUserId: "user_staff_acme",
        channel: "manual",
        claimForActor: false,
        requesterName: "Jordan Lee",
        requesterContact: "jordan@example.com",
        intent: "Tour follow-up",
        summary: "Jordan asked the desk for a weekday tour and pricing overview.",
        suggestedNextStep: "Call Jordan back and offer two tour windows this week.",
        confidence: 1.4
      })
    ).rejects.toThrow("Task confidence must be between 0 and 1.");
    await expect(
      service.createTaskFromAnswer({
        tenantId: "tenant_acme_fitness",
        answerBankEntryId: " ",
        actorUserId: "user_owner_acme"
      })
    ).rejects.toThrow("Answer identifier is required.");

    expect(repository.snapshot()).toEqual(before);
  });

  it("adds a tenant-authorized channel-aware manual task RPC without changing provenance", () => {
    expect(migration).toContain("v_channel := p_channel::task_channel");
    expect(migration).toContain("v_created := create_manual_task(");
    expect(migration).toContain("set channel = v_channel");
    expect(migration).toContain("set metadata = jsonb_set(metadata, '{channel}'");
    expect(migration).toContain(
      "grant execute on function create_manual_task(text, text, text, text, text, text, text, numeric, text)"
    );
    expect(migration).toContain("from public, anonymous");
    const manualTaskRpc = neonTaskRepository.slice(
      neonTaskRepository.indexOf('this.neon.rpc("create_manual_task"'),
      neonTaskRepository.indexOf('if (error)', neonTaskRepository.indexOf('this.neon.rpc("create_manual_task"'))
    );
    const noteRpc = neonTaskRepository.slice(
      neonTaskRepository.indexOf('this.neon.rpc("add_task_note"'),
      neonTaskRepository.indexOf('if (error)', neonTaskRepository.indexOf('this.neon.rpc("add_task_note"'))
    );
    expect(manualTaskRpc).toContain("p_channel: input.channel");
    expect(noteRpc).not.toContain("p_channel");
    expect(migration).toContain("p_claim_for_actor boolean");
    expect(migration).toContain("select current_app_user_id() into v_actor_user_id");
    expect(migration).toContain("v_created := assign_task(");
    expect(migration).toContain("'Task claimed during human-entered intake.'");
    expect(migration).toContain(
      "grant execute on function create_manual_task(text, text, text, text, text, text, text, numeric, text, boolean)"
    );
    expect(manualTaskRpc).toContain("p_claim_for_actor: input.claimForActor");
  });

  it("updates an existing task status through an atomic repository boundary", async () => {
    const repository = new InMemoryTaskRepository({
      tasks: tasks.map((task) => ({ ...task })),
      taskEvents: taskEvents.map((event) => ({ ...event })),
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      usageEvents: usageEvents.map((event) => ({ ...event }))
    });
    const service = new TaskApplicationService(repository);

    const updated = await service.updateTaskStatus({
      tenantId: "tenant_acme_fitness",
      locationId: "loc_acme_main",
      taskId: "task_new_tour",
      actorUserId: "user_staff_acme",
      toStatus: "in_progress"
    });
    const snapshot = repository.snapshot();

    expect(updated).toMatchObject({
      id: "task_new_tour",
      status: "in_progress"
    });
    expect(snapshot.taskEvents).toContainEqual(
      expect.objectContaining({
        taskId: "task_new_tour",
        eventType: "status_changed",
        fromStatus: "new",
        toStatus: "in_progress",
        actorUserId: "user_staff_acme",
        note: "Status changed through backend-backed staff task persistence."
      })
    );
    expect(snapshot.auditEvents).toContainEqual(
      expect.objectContaining({
        subjectType: "task",
        subjectId: "task_new_tour",
        action: "task.status_changed",
        metadata: expect.objectContaining({
          location_id: "loc_acme_main",
          previous_status: "new",
          next_status: "in_progress"
        })
      })
    );
  });

  it("rolls back task, task event, and audit state when the transaction fails mid-write", async () => {
    const repository = new InMemoryTaskRepository({
      tasks: tasks.map((task) => ({ ...task })),
      taskEvents: taskEvents.map((event) => ({ ...event })),
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      usageEvents: usageEvents.map((event) => ({ ...event }))
    });
    const before = repository.snapshot();
    const service = new TaskApplicationService(repository);

    repository.requestFailureAfterTaskUpdate();

    await expect(
      service.updateTaskStatus({
        tenantId: "tenant_acme_fitness",
        locationId: "loc_acme_main",
        taskId: "task_new_tour",
        actorUserId: "user_staff_acme",
        toStatus: "in_progress"
      })
    ).rejects.toThrow("Injected failure after task update.");

    expect(repository.snapshot()).toEqual(before);
  });

  it("reopens terminal work atomically while preserving assignment", async () => {
    const repository = new InMemoryTaskRepository({
      tasks: tasks.map((task) => ({ ...task })),
      taskEvents: taskEvents.map((event) => ({ ...event })),
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      usageEvents: usageEvents.map((event) => ({ ...event }))
    });
    const terminal = tasks.find((task) => task.status === "done")!;
    const service = new TaskApplicationService(repository);

    const updated = await service.updateTaskStatus({
      tenantId: terminal.tenantId,
      locationId: terminal.locationId,
      taskId: terminal.id,
      actorUserId: "user_staff_acme",
      toStatus: "new"
    });
    const snapshot = repository.snapshot();

    expect(updated).toMatchObject({ id: terminal.id, status: "new" });
    expect(updated.assigneeUserId).toBe(terminal.assigneeUserId);
    expect(snapshot.taskEvents).toContainEqual(expect.objectContaining({ taskId: terminal.id, eventType: "reopened" }));
    expect(snapshot.auditEvents).toContainEqual(expect.objectContaining({ subjectId: terminal.id, action: "task.reopened" }));
  });

  it("rejects missing, invalid, or terminal task status updates without mutating state", async () => {
    const repository = new InMemoryTaskRepository({
      tasks: tasks.map((task) => ({ ...task })),
      taskEvents: taskEvents.map((event) => ({ ...event })),
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      usageEvents: usageEvents.map((event) => ({ ...event }))
    });
    const before = repository.snapshot();
    const service = new TaskApplicationService(repository);

    await expect(
      service.updateTaskStatus({
        tenantId: "tenant_acme_fitness",
        locationId: "loc_acme_main",
        taskId: "missing_task",
        actorUserId: "user_staff_acme",
        toStatus: "in_progress"
      })
    ).rejects.toThrow("Task not found.");
    await expect(
      service.updateTaskStatus({
        tenantId: "tenant_acme_fitness",
        locationId: "loc_acme_main",
        taskId: "task_new_tour",
        actorUserId: "user_staff_acme",
        toStatus: "not_a_status" as never
      })
    ).rejects.toThrow("Task status is invalid.");
    await expect(
      service.updateTaskStatus({
        tenantId: "tenant_acme_fitness",
        locationId: "loc_acme_main",
        taskId: "task_done_hours",
        actorUserId: "user_staff_acme",
        toStatus: "in_progress"
      })
    ).rejects.toThrow("Task status transition is not allowed.");

    expect(repository.snapshot()).toEqual(before);
  });

  it("assigns an existing task through an atomic repository boundary", async () => {
    const repository = new InMemoryTaskRepository({
      tasks: tasks.map((task) => ({ ...task })),
      taskEvents: taskEvents.map((event) => ({ ...event })),
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      usageEvents: usageEvents.map((event) => ({ ...event }))
    });
    const service = new TaskApplicationService(repository);

    const updated = await service.assignTask({
      tenantId: "tenant_acme_fitness",
      locationId: "loc_acme_main",
      taskId: "task_new_tour",
      actorUserId: "user_staff_acme",
      assigneeUserId: "user_owner_acme"
    });
    const snapshot = repository.snapshot();

    expect(updated).toMatchObject({
      id: "task_new_tour",
      assigneeUserId: "user_owner_acme"
    });
    expect(snapshot.taskEvents).toContainEqual(
      expect.objectContaining({
        taskId: "task_new_tour",
        eventType: "assigned",
        actorUserId: "user_staff_acme",
        note: "Task assignment changed through Outpost staff workboard."
      })
    );
    expect(snapshot.auditEvents).toContainEqual(
      expect.objectContaining({
        subjectType: "task",
        subjectId: "task_new_tour",
        action: "task.assigned",
        metadata: expect.objectContaining({
          location_id: "loc_acme_main",
          previous_assignee_user_id: "user_staff_acme",
          next_assignee_user_id: "user_owner_acme"
        })
      })
    );
  });

  it("rolls back task, task event, and audit state when assignment fails mid-write", async () => {
    const repository = new InMemoryTaskRepository({
      tasks: tasks.map((task) => ({ ...task })),
      taskEvents: taskEvents.map((event) => ({ ...event })),
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      usageEvents: usageEvents.map((event) => ({ ...event }))
    });
    const before = repository.snapshot();
    const service = new TaskApplicationService(repository);

    repository.requestFailureAfterTaskAssignmentUpdate();

    await expect(
      service.assignTask({
        tenantId: "tenant_acme_fitness",
        locationId: "loc_acme_main",
        taskId: "task_new_tour",
        actorUserId: "user_staff_acme",
        assigneeUserId: "user_owner_acme"
      })
    ).rejects.toThrow("Injected failure after task assignment update.");

    expect(repository.snapshot()).toEqual(before);
  });

  it("adds a task note through an atomic repository boundary", async () => {
    const repository = new InMemoryTaskRepository({
      tasks: tasks.map((task) => ({ ...task })),
      taskEvents: taskEvents.map((event) => ({ ...event })),
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      usageEvents: usageEvents.map((event) => ({ ...event }))
    });
    const service = new TaskApplicationService(repository);

    const event = await service.addTaskNote({
      tenantId: "tenant_acme_fitness",
      locationId: "loc_acme_main",
      taskId: "task_new_tour",
      actorUserId: "user_staff_acme",
      note: "Left voicemail and will retry after 4 PM."
    });
    const snapshot = repository.snapshot();

    expect(event).toMatchObject({
      taskId: "task_new_tour",
      eventType: "note_added",
      actorUserId: "user_staff_acme",
      note: "Left voicemail and will retry after 4 PM."
    });
    expect(snapshot.auditEvents).toContainEqual(
      expect.objectContaining({
        subjectType: "task",
        subjectId: "task_new_tour",
        action: "task.note_added",
        metadata: expect.objectContaining({
          location_id: "loc_acme_main",
          task_event_id: event.id
        })
      })
    );
  });

  it("rolls back task, task event, and audit state when note persistence fails mid-write", async () => {
    const repository = new InMemoryTaskRepository({
      tasks: tasks.map((task) => ({ ...task })),
      taskEvents: taskEvents.map((event) => ({ ...event })),
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      usageEvents: usageEvents.map((event) => ({ ...event }))
    });
    const before = repository.snapshot();
    const service = new TaskApplicationService(repository);

    repository.requestFailureAfterTaskNoteUpdate();

    await expect(
      service.addTaskNote({
        tenantId: "tenant_acme_fitness",
        locationId: "loc_acme_main",
        taskId: "task_new_tour",
        actorUserId: "user_staff_acme",
        note: "This should roll back."
      })
    ).rejects.toThrow("Injected failure after task note update.");

    expect(repository.snapshot()).toEqual(before);
  });

  it("rejects missing task note input without mutating state", async () => {
    const repository = new InMemoryTaskRepository({
      tasks: tasks.map((task) => ({ ...task })),
      taskEvents: taskEvents.map((event) => ({ ...event })),
      auditEvents: auditEvents.map((event) => ({ ...event, metadata: { ...event.metadata } })),
      usageEvents: usageEvents.map((event) => ({ ...event }))
    });
    const before = repository.snapshot();
    const service = new TaskApplicationService(repository);

    await expect(
      service.addTaskNote({
        tenantId: "tenant_acme_fitness",
        locationId: "loc_acme_main",
        taskId: "task_new_tour",
        actorUserId: "user_staff_acme",
        note: " "
      })
    ).rejects.toThrow("Task note is required.");
    await expect(
      service.assignTask({
        tenantId: "tenant_acme_fitness",
        locationId: "loc_acme_main",
        taskId: "",
        actorUserId: "user_staff_acme",
        assigneeUserId: "user_owner_acme"
      })
    ).rejects.toThrow("Task identifier is required.");

    expect(repository.snapshot()).toEqual(before);
  });

  it("defines the task status RPC as a multi-table write boundary", () => {
    expect(migration).toContain("create or replace function update_task_status");
    expect(migration).toContain("create or replace function create_manual_task");
    expect(migration).toContain("create or replace function create_task_from_answer_bank_entry");
    expect(migration).toContain("create or replace function assign_task");
    expect(migration).toContain("create or replace function add_task_note");
    expect(migration).toContain("create or replace function list_active_tenant_members");
    expect(migration).toContain("language plpgsql");
    expect(migration).toContain("security definer");
    expect(migration).toContain("for update");
    expect(migration).toContain("insert into tasks");
    expect(migration).toContain("insert into task_events");
    expect(migration).toContain("insert into usage_events");
    expect(migration).toContain("insert into audit_events");
    expect(migration).toContain("'task.created'");
    expect(migration).toContain("'task.created_from_answer'");
    expect(migration).toContain("'task_created'");
    expect(migration).toContain("'task.status_changed'");
    expect(migration).toContain("'task.reopened'");
    expect(migration).toContain("'reopened'");
    expect(migration).toContain("'task.assigned'");
    expect(migration).toContain("'task.note_added'");
    expect(migration).toContain("previous_status");
    expect(migration).toContain("next_status");
    expect(migration).toContain("previous_assignee_user_id");
    expect(migration).toContain("next_assignee_user_id");
    expect(migration).toContain("task_event_id");
    expect(migration).toContain("usage_event_id");
    expect(migration).toContain("is_active_tenant_member");
    expect(migration).toContain("if v_actor_user_id is null then");
    expect(migration).toContain("grant execute on function create_manual_task");
    expect(migration).toContain("grant execute on function create_task_from_answer_bank_entry");
    expect(migration).toContain("grant execute on function update_task_status");
    expect(migration).toContain("grant execute on function assign_task");
    expect(migration).toContain("grant execute on function add_task_note");
    expect(migration).toContain("grant execute on function list_active_tenant_members");
    expect(migration).toContain("revoke all on tasks, task_events, usage_events from anonymous, authenticated");
    expect(migration).toContain("revoke all on tasks, task_events from anonymous, authenticated");
    expect(migration).toContain("grant select on tasks, task_events, usage_events to authenticated");
    expect(migration).toContain("grant select on tasks, task_events to authenticated");
    expect(migration).toContain("gen_random_uuid()::text");
    expect(migration).not.toContain("grant update on tasks");
    expect(migration).not.toContain("grant insert on tasks");
    expect(migration).not.toContain("grant insert on task_events");
    expect(migration).not.toContain("grant insert on usage_events");
    expect(migration).toContain(
      "revoke execute on function create_manual_task(text, text, text, text, text, text, text, numeric)"
    );
    expect(migration).toContain(
      "revoke execute on function create_task_from_answer_bank_entry(text, text)"
    );
    expect(migration).toContain(
      "revoke execute on function update_task_status(text, text, text, text)"
    );
    expect(migration).toContain(
      "revoke execute on function assign_task(text, text, text, text, text)"
    );
    expect(migration).toContain(
      "revoke execute on function add_task_note(text, text, text, text)"
    );
    expect(migration).toContain(
      "revoke execute on function list_active_tenant_members(text)"
    );
  });

  it("extends rollback-only RLS verification for task persistence and cross-tenant denial", () => {
    expect(rlsVerification).toContain("visible_own_tasks <> 2");
    expect(rlsVerification).toContain("cross-tenant task leaked through RLS");
    expect(rlsVerification).toContain("visible_own_task_events <> 1");
    expect(rlsVerification).toContain("cross-tenant task event leaked through RLS");
    expect(rlsVerification).toContain("anon can execute task status update RPC");
    expect(rlsVerification).toContain("anon can execute manual task creation RPC");
    expect(rlsVerification).toContain("anon can execute answer task creation RPC");
    expect(rlsVerification).toContain("anon can execute task assignment RPC");
    expect(rlsVerification).toContain("anon can execute task note RPC");
    expect(rlsVerification).toContain("anon can execute active tenant member list RPC");
    expect(rlsVerification).toContain("public can execute task status update RPC");
    expect(rlsVerification).toContain("public can execute manual task creation RPC");
    expect(rlsVerification).toContain("public can execute answer task creation RPC");
    expect(rlsVerification).toContain("public can execute task assignment RPC");
    expect(rlsVerification).toContain("public can execute task note RPC");
    expect(rlsVerification).toContain("public can execute active tenant member list RPC");
    expect(rlsVerification).toContain("create_manual_task(");
    expect(rlsVerification).toContain("create_task_from_answer_bank_entry(");
    expect(rlsVerification).toContain("update_task_status(");
    expect(rlsVerification).toContain("assign_task(");
    expect(rlsVerification).toContain("add_task_note(");
    expect(rlsVerification).toContain("list_active_tenant_members(");
    expect(rlsVerification).toContain("manual task creation RPC did not return a manual new task");
    expect(rlsVerification).toContain("answer task creation RPC did not return a manual new task");
    expect(rlsVerification).toContain("answer-derived audit event did not record answer provenance");
    expect(rlsVerification).toContain("answer task creation RPC did not return existing open task");
    expect(rlsVerification).toContain("duplicate answer task request changed task count");
    expect(rlsVerification).toContain("answer task creation RPC reused terminal task");
    expect(rlsVerification).toContain("expected terminal answer task to allow one new task");
    expect(rlsVerification).toContain("staff task status RPC did not return updated status");
    expect(rlsVerification).toContain("staff owner-only location RPC unexpectedly succeeded");
    expect(rlsVerification).toContain("illegal task status transition unexpectedly succeeded");
    expect(rlsVerification).toContain("direct task table insert unexpectedly succeeded");
    expect(rlsVerification).toContain("direct task table update unexpectedly succeeded");
    expect(rlsVerification).toContain("direct task event table insert unexpectedly succeeded");
    expect(rlsVerification).toContain("direct audit event table insert unexpectedly succeeded");
    expect(rlsVerification).toContain("direct usage event table insert unexpectedly succeeded");
    expect(rlsVerification).toContain("anon manual task creation unexpectedly succeeded");
    expect(rlsVerification).toContain("anon task status update unexpectedly succeeded");
    expect(rlsVerification).toContain("manual_task_events_after <> manual_task_events_before + 1");
    expect(rlsVerification).toContain("manual_task_usage_events_after <> manual_task_usage_events_before + 1");
    expect(rlsVerification).toContain("manual_task_audit_events_after <> manual_task_audit_events_before + 1");
    expect(rlsVerification).toContain("task assignment RPC did not return assigned task");
    expect(rlsVerification).toContain("task note RPC did not return note event");
    expect(rlsVerification).toContain("expected exactly two active assignable tenant members");
    expect(rlsVerification).toContain("assignment_task_events_after <> assignment_task_events_before + 1");
    expect(rlsVerification).toContain("note_task_events_after <> note_task_events_before + 1");
    expect(rlsVerification).toContain("cross-tenant manual task failure changed task count");
    expect(rlsVerification).toContain("invalid assignee task assignment unexpectedly succeeded");
    expect(rlsVerification).toContain("invalid assignee assignment failure changed task count");
    expect(rlsVerification).toContain("invalid-location manual task creation unexpectedly succeeded");
    expect(rlsVerification).toContain("invalid-location manual task failure changed audit event count");
    expect(rlsVerification).toContain("task_events_after <> task_events_before + 1");
    expect(rlsVerification).toContain("task_audit_events_after <> task_audit_events_before + 1");
    expect(rlsVerification).toContain("cross-tenant RPC manual task creation unexpectedly succeeded");
    expect(rlsVerification).toContain("cross-tenant RPC answer task creation unexpectedly succeeded");
    expect(rlsVerification).toContain("approved answer task creation unexpectedly succeeded");
    expect(rlsVerification).toContain("cross-tenant answer task failure changed task count");
    expect(rlsVerification).toContain("approved answer task failure changed audit event count");
    expect(rlsVerification).toContain("cross-tenant RPC task status update unexpectedly succeeded");
    expect(rlsVerification).toContain("cross-tenant RPC task assignment unexpectedly succeeded");
    expect(rlsVerification).toContain("cross-tenant RPC task note unexpectedly succeeded");
    expect(rlsVerification).toContain("cross-tenant active tenant member list unexpectedly succeeded");
  });
});
