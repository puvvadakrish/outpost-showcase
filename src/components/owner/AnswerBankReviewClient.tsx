"use client";

import { useActionState, useMemo } from "react";
import type {
  EditDraftAnswerActionState,
  PersistenceMode,
} from "@/application/owner-setup/action-result";
import { ApprovalStatusPill } from "@/components/ApprovalStatusPill";
import type { AnswerBankEntry } from "@/domain/answer-bank";
import {
  answerBankReadiness,
  answerReviewQueue,
  answerReviewQueueSummary,
  answerReviewRuntimeCopy,
  answerReviewSourceLabel
} from "@/domain/answer-bank";
import { displayLabel } from "@/domain/formatting";

interface AnswerBankReviewClientProps {
  entries: AnswerBankEntry[];
  onApproveAnswer: (
    previousState: EditDraftAnswerActionState,
    formData: FormData
  ) => Promise<EditDraftAnswerActionState>;
  onCreateTaskFromAnswer: (
    previousState: EditDraftAnswerActionState,
    formData: FormData
  ) => Promise<EditDraftAnswerActionState>;
  onEditDraftAnswer: (
    previousState: EditDraftAnswerActionState,
    formData: FormData
  ) => Promise<EditDraftAnswerActionState>;
  onRetireAnswer: (
    previousState: EditDraftAnswerActionState,
    formData: FormData
  ) => Promise<EditDraftAnswerActionState>;
  persistenceMessage: string;
  persistenceMode: PersistenceMode;
  tenantId: string;
}

type AnswerFormAction = (formData: FormData) => void;

function readableDate(value?: string) {
  return value ? value.slice(0, 10) : "Not set";
}

function canApprove(entry: AnswerBankEntry) {
  return ["draft", "conflict"].includes(entry.approvalStatus);
}

function canEdit(entry: AnswerBankEntry) {
  return ["draft", "conflict"].includes(entry.approvalStatus);
}

function canCreateTask(entry: AnswerBankEntry) {
  return (
    ["draft", "conflict", "routed"].includes(entry.approvalStatus) &&
    entry.runtimeBehavior !== "answer_live" &&
    !entry.openTaskId
  );
}

function canRetire(entry: AnswerBankEntry) {
  return ["draft", "conflict"].includes(entry.approvalStatus);
}

function editButtonLabel(entry: AnswerBankEntry, isPending: boolean) {
  if (isPending) {
    return "Saving";
  }

  return entry.approvalStatus === "conflict" ? "Save as draft" : "Save edited draft";
}

function approveButtonLabel(isPending: boolean) {
  return isPending ? "Approving" : "Approve answer";
}

function taskButtonLabel(entry: AnswerBankEntry, isPending: boolean) {
  if (entry.openTaskId) {
    return "Staff task ready";
  }

  return isPending ? "Creating" : "Create staff task";
}

function retireButtonLabel(isPending: boolean) {
  return isPending ? "Retiring" : "Retire proposal";
}

interface AnswerReviewActionsProps {
  approveFormAction: AnswerFormAction;
  backendEnabled: boolean;
  editFormAction: AnswerFormAction;
  entry: AnswerBankEntry;
  isApprovePending: boolean;
  isEditPending: boolean;
  isRetirePending: boolean;
  isTaskPending: boolean;
  retireFormAction: AnswerFormAction;
  taskFormAction: AnswerFormAction;
  tenantId: string;
}

function AnswerReviewActions({
  approveFormAction,
  backendEnabled,
  editFormAction,
  entry,
  isApprovePending,
  isEditPending,
  isRetirePending,
  isTaskPending,
  retireFormAction,
  taskFormAction,
  tenantId
}: AnswerReviewActionsProps) {
  return (
    <div className="approval-actions">
      <form
        action={editFormAction}
        className="answer-edit-form"
        onSubmit={(event) => {
          if (!backendEnabled || !canEdit(entry)) {
            event.preventDefault();
          }
        }}
      >
        <input name="tenantId" type="hidden" value={tenantId} />
        <input name="entryId" type="hidden" value={entry.id} />
        <input name="topic" type="hidden" value={entry.topic} />
        <input name="question" type="hidden" value={entry.question} />
        <textarea
          aria-label={`Edit proposed answer for ${entry.topic}`}
          className="inline-textarea"
          defaultValue={entry.answer}
          disabled={!backendEnabled || !canEdit(entry)}
          name="answer"
        />
        <button
          className="mini-button"
          disabled={!backendEnabled || isEditPending || !canEdit(entry)}
          type="submit"
        >
          {editButtonLabel(entry, isEditPending)}
        </button>
      </form>
      <form
        action={approveFormAction}
        onSubmit={(event) => {
          if (!backendEnabled || !canApprove(entry)) {
            event.preventDefault();
          }
        }}
      >
        <input name="tenantId" type="hidden" value={tenantId} />
        <input name="entryId" type="hidden" value={entry.id} />
        <button
          className="mini-button quiet"
          disabled={!backendEnabled || isApprovePending || !canApprove(entry)}
          type="submit"
        >
          {approveButtonLabel(isApprovePending)}
        </button>
      </form>
      <form
        action={taskFormAction}
        onSubmit={(event) => {
          if (!backendEnabled || !canCreateTask(entry)) {
            event.preventDefault();
          }
        }}
      >
        <input name="tenantId" type="hidden" value={tenantId} />
        <input name="entryId" type="hidden" value={entry.id} />
        <button
          className="mini-button quiet"
          disabled={!backendEnabled || isTaskPending || !canCreateTask(entry)}
          type="submit"
        >
          {taskButtonLabel(entry, isTaskPending)}
        </button>
      </form>
      <form
        action={retireFormAction}
        onSubmit={(event) => {
          if (!backendEnabled || !canRetire(entry)) {
            event.preventDefault();
          }
        }}
      >
        <input name="tenantId" type="hidden" value={tenantId} />
        <input name="entryId" type="hidden" value={entry.id} />
        <button
          className="mini-button danger"
          disabled={!backendEnabled || isRetirePending || !canRetire(entry)}
          type="submit"
        >
          {retireButtonLabel(isRetirePending)}
        </button>
      </form>
    </div>
  );
}

interface AnswerInventoryActionProps {
  backendEnabled: boolean;
  entry: AnswerBankEntry;
  isTaskPending: boolean;
  taskFormAction: AnswerFormAction;
  tenantId: string;
}

function AnswerInventoryAction({
  backendEnabled,
  entry,
  isTaskPending,
  taskFormAction,
  tenantId
}: AnswerInventoryActionProps) {
  if (entry.approvalStatus === "draft" || entry.approvalStatus === "conflict") {
    return (
      <a className="inventory-action-link" href="#answers">
        Review in queue above
      </a>
    );
  }

  if (canCreateTask(entry)) {
    return (
      <form
        action={taskFormAction}
        onSubmit={(event) => {
          if (!backendEnabled || !canCreateTask(entry)) {
            event.preventDefault();
          }
        }}
      >
        <input name="tenantId" type="hidden" value={tenantId} />
        <input name="entryId" type="hidden" value={entry.id} />
        <button
          className="mini-button quiet"
          disabled={!backendEnabled || isTaskPending}
          type="submit"
        >
          {taskButtonLabel(entry, isTaskPending)}
        </button>
      </form>
    );
  }

  return <span className="muted inventory-action-muted">No owner action</span>;
}

export function AnswerBankReviewClient({
  entries,
  onApproveAnswer,
  onCreateTaskFromAnswer,
  onEditDraftAnswer,
  onRetireAnswer,
  persistenceMessage,
  persistenceMode,
  tenantId
}: AnswerBankReviewClientProps) {
  const [editActionState, editFormAction, isEditPending] = useActionState(onEditDraftAnswer, {
    ok: false,
    message: ""
  });
  const [approveActionState, approveFormAction, isApprovePending] = useActionState(onApproveAnswer, {
    ok: false,
    message: ""
  });
  const [taskActionState, taskFormAction, isTaskPending] = useActionState(onCreateTaskFromAnswer, {
    ok: false,
    message: ""
  });
  const [retireActionState, retireFormAction, isRetirePending] = useActionState(onRetireAnswer, {
    ok: false,
    message: ""
  });
  const readiness = useMemo(() => answerBankReadiness(entries), [entries]);
  const reviewQueue = useMemo(() => answerReviewQueue(entries), [entries]);
  const reviewSummary = useMemo(() => answerReviewQueueSummary(entries), [entries]);
  const backendEnabled = persistenceMode === "backend";
  const persistenceLabel =
    persistenceMode === "backend"
      ? "Backend persistence"
      : persistenceMode === "tenant_access_required"
        ? "Tenant access required"
      : persistenceMode === "sign_in_required"
        ? "Sign in required"
        : persistenceMode === "backend_unavailable"
          ? "Backend unavailable"
          : "Setup required";

  return (
    <section className="panel answer-bank-panel" id="answers">
      <div className="panel-header">
        <div>
          <h2>Answer-bank review</h2>
          <p>
            Backend-backed draft edits, conflict resolution, owner approval, and retirement. Routing,
            providers, and live answering remain blocked beyond this review workflow.
          </p>
        </div>
        <div className="panel-header-actions">
          <span className="channel-pill">{readiness.needsReview} review items</span>
          {persistenceMode === "sign_in_required" ? (
            <a className="channel-pill channel-pill-link" href="/owner/sign-in">
              {persistenceLabel}
            </a>
          ) : (
            <span className="channel-pill">{persistenceLabel}</span>
          )}
        </div>
      </div>
      <p className={backendEnabled ? "form-status success" : "form-status"}>{persistenceMessage}</p>
      {editActionState.message ? (
        <p
          className={editActionState.ok ? "form-status success" : "form-status error"}
          role="status"
        >
          {editActionState.message}
        </p>
      ) : null}
      {approveActionState.message ? (
        <p
          className={approveActionState.ok ? "form-status success" : "form-status error"}
          role="status"
        >
          {approveActionState.message}
        </p>
      ) : null}
      {taskActionState.message ? (
        <p
          className={taskActionState.ok ? "form-status success" : "form-status error"}
          role="status"
        >
          {taskActionState.message}
        </p>
      ) : null}
      {retireActionState.message ? (
        <p
          className={retireActionState.ok ? "form-status success" : "form-status error"}
          role="status"
        >
          {retireActionState.message}
        </p>
      ) : null}
      <div className="answer-review-overview" aria-label="Answer review summary" role="group">
        <div>
          <span className="rail-title">Next owner step</span>
          <strong>{reviewSummary.nextAction}</strong>
        </div>
        <div>
          <span className="rail-title">Needs review</span>
          <strong>{reviewSummary.needsReview}</strong>
        </div>
        <div>
          <span className="rail-title">Conflicts</span>
          <strong>{reviewSummary.conflict}</strong>
        </div>
        <div>
          <span className="rail-title">Approved</span>
          <strong>{reviewSummary.approved}</strong>
        </div>
      </div>
      <div className="answer-review-workflow">
        <div className="answer-review-workflow-header">
          <div>
            <h3>Staged proposals from source facts</h3>
            <p>
              Review conflicts first, edit the proposed answer if needed, then approve only answers
              that are safe for future live use.
            </p>
          </div>
          <a className="channel-pill channel-pill-link" href="#manual-source-intake">
            Add source facts
          </a>
        </div>
        {reviewQueue.length > 0 ? (
          <div className="answer-review-queue">
            {reviewQueue.map((entry) => (
              <article
                className={`answer-review-card answer-review-card-${entry.approvalStatus}`}
                key={entry.id}
              >
                <div className="answer-review-card-main">
                  <div className="answer-review-card-header">
                    <div>
                      <span className="rail-title">Review item</span>
                      <h4>{displayLabel(entry.topic)}</h4>
                    </div>
                    <ApprovalStatusPill status={entry.approvalStatus} />
                  </div>
                  <p className="answer-review-question">{entry.question}</p>
                  <div className="answer-review-proposed-answer">
                    <span className="rail-title">Proposed answer</span>
                    <p>{entry.answer}</p>
                  </div>
                </div>
                <div className="answer-review-card-context">
                  <div>
                    <span className="rail-title">Source</span>
                    <strong>{displayLabel(answerReviewSourceLabel(entry))}</strong>
                  </div>
                  <div>
                    <span className="rail-title">Boundary</span>
                    <p>{answerReviewRuntimeCopy(entry)}</p>
                  </div>
                  <div>
                    <span className="rail-title">Review note</span>
                    <p>{entry.reviewNote}</p>
                  </div>
                  {entry.openTaskId ? (
                    <a className="task-link" href="/staff/tasks">
                      Staff task {displayLabel(entry.openTaskStatus ?? "new")} since{" "}
                      {readableDate(entry.openTaskCreatedAt)}
                    </a>
                  ) : null}
                </div>
                <AnswerReviewActions
                  approveFormAction={approveFormAction}
                  backendEnabled={backendEnabled}
                  editFormAction={editFormAction}
                  entry={entry}
                  isApprovePending={isApprovePending}
                  isEditPending={isEditPending}
                  isRetirePending={isRetirePending}
                  isTaskPending={isTaskPending}
                  retireFormAction={retireFormAction}
                  taskFormAction={taskFormAction}
                  tenantId={tenantId}
                />
              </article>
            ))}
          </div>
        ) : (
          <div className="operational-empty-state answer-review-empty">
            <strong>No staged answer proposals need owner review.</strong>
            <p>Approved answers remain visible below. Add source facts when you need more proposals.</p>
            <a className="mini-button quiet" href="#manual-source-intake">
              Add source facts
            </a>
          </div>
        )}
      </div>
      <table className="table answer-bank-table">
        <thead>
          <tr>
            <th>Topic</th>
            <th>Question</th>
            <th>Status</th>
            <th>Runtime boundary</th>
            <th>Source and audit</th>
            <th>Owner action</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td>
                <strong>{displayLabel(entry.topic)}</strong>
              </td>
              <td>
                {entry.question}
              </td>
              <td>
                <ApprovalStatusPill status={entry.approvalStatus} />
                <p className="table-detail">{entry.reviewNote}</p>
              </td>
              <td>
                <strong>{displayLabel(entry.runtimeBehavior)}</strong>
                <p className="table-detail">{entry.answer}</p>
              </td>
              <td>
                <span>{displayLabel(answerReviewSourceLabel(entry))}</span>
                {entry.approvedByUserId ? (
                  <small className="muted">Approved by {entry.approvedByUserId}</small>
                ) : null}
                {entry.approvedAt ? (
                  <small className="muted">Approved {readableDate(entry.approvedAt)}</small>
                ) : null}
                {entry.retiredAt ? (
                  <small className="muted">Retired {readableDate(entry.retiredAt)}</small>
                ) : null}
                {entry.openTaskId ? (
                  <a className="table-detail task-link" href="/staff/tasks">
                    Task {displayLabel(entry.openTaskStatus ?? "new")} since {readableDate(entry.openTaskCreatedAt)}
                  </a>
                ) : null}
              </td>
              <td>
                <AnswerInventoryAction
                  backendEnabled={backendEnabled}
                  entry={entry}
                  isTaskPending={isTaskPending}
                  taskFormAction={taskFormAction}
                  tenantId={tenantId}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="answer-card-list" aria-label="Answer bank">
        {entries.map((entry) => (
          <article className="answer-card" key={entry.id}>
            <div className="answer-card-header">
              <div>
                <span className="rail-title">Topic</span>
                <strong>{displayLabel(entry.topic)}</strong>
              </div>
              <ApprovalStatusPill status={entry.approvalStatus} />
            </div>
            <div className="answer-card-body">
              <span className="rail-title">Question</span>
              <p>{entry.question}</p>
            </div>
            <div className="answer-card-answer">
              <span className="rail-title">Owner boundary</span>
              <p>{entry.answer}</p>
            </div>
            <div className="answer-card-body">
              <span className="rail-title">Review note</span>
              <p>{entry.reviewNote}</p>
            </div>
            <div className="answer-card-footer">
              <span>{displayLabel(answerReviewSourceLabel(entry))}</span>
              <span>{displayLabel(entry.runtimeBehavior)}</span>
              {entry.openTaskId ? (
                <a href="/staff/tasks">Task {displayLabel(entry.openTaskStatus ?? "new")}</a>
              ) : null}
              <span>Updated {readableDate(entry.updatedAt)}</span>
            </div>
            <AnswerInventoryAction
              backendEnabled={backendEnabled}
              entry={entry}
              isTaskPending={isTaskPending}
              taskFormAction={taskFormAction}
              tenantId={tenantId}
            />
          </article>
        ))}
      </div>
    </section>
  );
}
