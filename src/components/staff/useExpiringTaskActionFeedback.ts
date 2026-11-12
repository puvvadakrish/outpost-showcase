"use client";

import { useEffect, useState } from "react";
import type { Id } from "@/domain/models";
import { taskActionTargetsSelection } from "@/domain/task-action-feedback";

interface TargetedTaskActionFeedback {
  message: string;
  taskId?: Id;
}

export const taskActionFeedbackDurationMs = 5_000;

export function useExpiringTaskActionFeedback<Feedback extends TargetedTaskActionFeedback>(
  feedback: Feedback,
  selectedTaskId: Id | undefined
): boolean {
  const [expiredFeedback, setExpiredFeedback] = useState<Feedback>();

  useEffect(() => {
    if (!feedback.message || !feedback.taskId) {
      return;
    }

    const timeoutId = window.setTimeout(
      () => setExpiredFeedback(feedback),
      taskActionFeedbackDurationMs
    );
    return () => window.clearTimeout(timeoutId);
  }, [feedback]);

  return (
    feedback !== expiredFeedback &&
    taskActionTargetsSelection(feedback.taskId, selectedTaskId)
  );
}
