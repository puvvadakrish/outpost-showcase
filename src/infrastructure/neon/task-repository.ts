import "server-only";

import type {
  AddTaskNoteTransactionResult,
  AssignTaskTransactionResult,
  CreateTaskFromAnswerTransactionResult,
  TaskRepository,
  TransactionalAddTaskNoteInput,
  TransactionalAssignTaskInput,
  TransactionalCreateManualTaskInput,
  TransactionalCreateTaskFromAnswerInput,
  TransactionalUpdateTaskStatusInput,
  CreateManualTaskTransactionResult,
  UpdateTaskStatusTransactionResult
} from "@/application/tasks/ports";
import type { Task, TaskEvent } from "@/domain/tasks";
import type { User } from "@/domain/tenancy";
import type { OutpostNeonClient } from "@/server/neon/server-client";

interface TaskRow {
  id: string;
  tenant_id: string;
  location_id: string;
  channel: Task["channel"];
  requester_name: string;
  requester_contact: string;
  intent: string;
  summary: string;
  confidence: number;
  suggested_next_step: string;
  assignee_user_id: string | null;
  status: Task["status"];
  created_at: string;
  updated_at: string;
}

interface TaskEventRow {
  id: string;
  tenant_id: string;
  location_id: string;
  task_id: string;
  actor_user_id: string | null;
  event_type: TaskEvent["eventType"];
  from_status: TaskEvent["fromStatus"] | null;
  to_status: TaskEvent["toStatus"] | null;
  note: string | null;
  created_at: string;
}

interface TenantMemberUserRow {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    locationId: row.location_id,
    channel: row.channel,
    requesterName: row.requester_name,
    requesterContact: row.requester_contact,
    intent: row.intent,
    summary: row.summary,
    confidence: Number(row.confidence),
    suggestedNextStep: row.suggested_next_step,
    assigneeUserId: row.assignee_user_id ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapTaskEvent(row: TaskEventRow): TaskEvent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    locationId: row.location_id,
    taskId: row.task_id,
    actorUserId: row.actor_user_id ?? undefined,
    eventType: row.event_type,
    fromStatus: row.from_status ?? undefined,
    toStatus: row.to_status ?? undefined,
    note: row.note ?? undefined,
    createdAt: row.created_at
  };
}

function mapTenantMemberUser(row: TenantMemberUserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.created_at
  };
}

export class NeonTaskRepository implements TaskRepository {
  constructor(private readonly neon: OutpostNeonClient) {}

  async addTaskNoteTransaction(input: TransactionalAddTaskNoteInput): Promise<AddTaskNoteTransactionResult> {
    // The RPC derives actor identity from auth.uid(); do not forward client-provided actor ids.
    const { data, error } = await this.neon.rpc("add_task_note", {
      p_tenant_id: input.tenantId,
      p_location_id: input.locationId,
      p_task_id: input.taskId,
      p_note: input.note
    });

    if (error) {
      throw new Error(`Unable to add task note: ${error.message}`);
    }

    return { taskEvent: mapTaskEvent(data as unknown as TaskEventRow) };
  }

  async assignTaskTransaction(input: TransactionalAssignTaskInput): Promise<AssignTaskTransactionResult> {
    // The RPC derives actor identity from auth.uid(); do not forward client-provided actor ids.
    const { data, error } = await this.neon.rpc("assign_task", {
      p_tenant_id: input.tenantId,
      p_location_id: input.locationId,
      p_task_id: input.taskId,
      p_assignee_user_id: input.assigneeUserId ?? "",
      p_note: input.note
    });

    if (error) {
      throw new Error(`Unable to assign task: ${error.message}`);
    }

    return { task: mapTask(data as unknown as TaskRow) };
  }

  async createManualTaskTransaction(
    input: TransactionalCreateManualTaskInput
  ): Promise<CreateManualTaskTransactionResult> {
    // The RPC derives actor identity from auth.uid(); do not forward client-provided actor ids.
    const { data, error } = await this.neon.rpc("create_manual_task", {
      p_tenant_id: input.tenantId,
      p_location_id: input.locationId,
      p_channel: input.channel,
      p_claim_for_actor: input.claimForActor,
      p_requester_name: input.requesterName,
      p_requester_contact: input.requesterContact,
      p_intent: input.intent,
      p_summary: input.summary,
      p_suggested_next_step: input.suggestedNextStep,
      p_confidence: input.confidence
    });

    if (error) {
      throw new Error(`Unable to create manual task: ${error.message}`);
    }

    return { task: mapTask(data as unknown as TaskRow) };
  }

  async createTaskFromAnswerTransaction(
    input: TransactionalCreateTaskFromAnswerInput
  ): Promise<CreateTaskFromAnswerTransactionResult> {
    // The RPC derives actor identity, location, task text, and provenance from auth.uid() and the answer row.
    const { data, error } = await this.neon.rpc("create_task_from_answer_bank_entry", {
      p_tenant_id: input.tenantId,
      p_answer_bank_entry_id: input.answerBankEntryId
    });

    if (error) {
      throw new Error(`Unable to create task from answer: ${error.message}`);
    }

    return { task: mapTask(data as unknown as TaskRow) };
  }

  async listEventsForTenant(tenantId: string) {
    const { data, error } = await this.neon
      .from("task_events")
      .select("id, tenant_id, location_id, task_id, actor_user_id, event_type, from_status, to_status, note, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Unable to load task events: ${error.message}`);
    }

    return ((data ?? []) as unknown as TaskEventRow[]).map(mapTaskEvent);
  }

  async listAssignableUsersForTenant(tenantId: string) {
    const { data, error } = await this.neon.rpc("list_active_tenant_members", {
      p_tenant_id: tenantId
    });

    if (error) {
      throw new Error(`Unable to load assignable task users: ${error.message}`);
    }

    return ((data ?? []) as unknown as TenantMemberUserRow[]).map(mapTenantMemberUser);
  }

  async listForTenant(tenantId: string) {
    const { data, error } = await this.neon
      .from("tasks")
      .select("id, tenant_id, location_id, channel, requester_name, requester_contact, intent, summary, confidence, suggested_next_step, assignee_user_id, status, created_at, updated_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Unable to load tasks: ${error.message}`);
    }

    return ((data ?? []) as unknown as TaskRow[]).map(mapTask);
  }

  async updateTaskStatusTransaction(
    input: TransactionalUpdateTaskStatusInput
  ): Promise<UpdateTaskStatusTransactionResult> {
    // The RPC derives actor identity from auth.uid(); do not forward client-provided actor ids.
    const { data, error } = await this.neon.rpc("update_task_status", {
      p_tenant_id: input.tenantId,
      p_location_id: input.locationId,
      p_task_id: input.taskId,
      p_to_status: input.toStatus
    });

    if (error) {
      throw new Error(`Unable to update task status: ${error.message}`);
    }

    return { task: mapTask(data as unknown as TaskRow) };
  }
}
