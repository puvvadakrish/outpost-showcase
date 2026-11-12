import type { AnswerApprovalStatus } from "@/domain/models";
import { displayLabel } from "@/domain/formatting";

interface ApprovalStatusPillProps {
  status: AnswerApprovalStatus;
}

export function ApprovalStatusPill({ status }: ApprovalStatusPillProps) {
  const label =
    status === "approved"
      ? "Approved to answer"
      : status === "routed"
        ? "Staff will follow up"
        : displayLabel(status);

  return <span className={`status-pill approval-${status}`}>{label}</span>;
}
