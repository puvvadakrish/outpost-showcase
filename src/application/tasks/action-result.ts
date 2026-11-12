import type { Id } from "@/domain/models";
import type { Task, TaskEvent } from "@/domain/tasks";

export interface StaffTaskActionState {
  ok: boolean;
  message: string;
  task?: Task;
  taskEvent?: TaskEvent;
  taskId?: Id;
}
