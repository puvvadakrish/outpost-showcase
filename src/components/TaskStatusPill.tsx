import { taskStatusLabel, type TaskStatus } from "@/domain/models";
import { displayLabel } from "@/domain/formatting";

interface TaskStatusPillProps {
  status: TaskStatus;
}

export function TaskStatusPill({ status }: TaskStatusPillProps) {
  return (
    <span className={`status-pill task-status-${status}`}>
      {displayLabel(taskStatusLabel(status))}
    </span>
  );
}
