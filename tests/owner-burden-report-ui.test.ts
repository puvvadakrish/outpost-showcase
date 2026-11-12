import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workspace = readFileSync("src/components/owner/OwnerSetupWorkspaceClient.tsx", "utf8");
const burdenReportPanel = readFileSync("src/components/owner/OwnerBurdenReportPanel.tsx", "utf8");
const burdenReportDomain = readFileSync("src/domain/burden-report.ts", "utf8");
const globals = readFileSync("src/app/globals.css", "utf8");

describe("owner burden report UI", () => {
  it("renders a local-only burden report in the owner workspace", () => {
    expect(workspace).toContain("OwnerBurdenReportPanel");
    expect(workspace).toContain("ownerBurdenReport");
    expect(workspace).toContain("<OwnerBurdenReportPanel report={burdenReport} />");
    expect(burdenReportPanel).toContain('aria-label="Local burden reduction report"');
    expect(burdenReportPanel).toContain("Burden reduction");
    expect(burdenReportPanel).toContain("Burden report local proof completion");
    expect(burdenReportPanel).toContain("owner-burden-gates");
    expect(burdenReportPanel).toContain('aria-label="Burden by request channel"');
    expect(burdenReportPanel).toContain("report.channelRows.map");
    expect(burdenReportPanel).toContain("Current task demand by channel");
    expect(burdenReportPanel).toContain('aria-label="Common request pressure"');
    expect(burdenReportPanel).toContain("report.commonRequestRows.map");
    expect(burdenReportPanel).toContain("Common task intent pressure");
    expect(burdenReportPanel).toContain("No task intents captured yet.");
    expect(burdenReportPanel).toContain('aria-label="Human intake contribution"');
    expect(burdenReportPanel).toContain("report.staffIntakeRows.map");
    expect(burdenReportPanel).toContain("Submitted work by staff actor");
    expect(burdenReportPanel).toContain("No human intake events captured yet.");
    expect(burdenReportPanel).toContain('aria-label="Location workload pressure"');
    expect(burdenReportPanel).toContain("report.locationRows.map");
    expect(burdenReportPanel).toContain("Current task demand by location");
    expect(burdenReportPanel).toContain('aria-label="Workflow-stage pressure"');
    expect(burdenReportPanel).toContain("report.workflowRows.map");
    expect(burdenReportPanel).toContain("Current task demand by stage");
    expect(burdenReportPanel).toContain('aria-label="Task age pressure"');
    expect(burdenReportPanel).toContain("report.ageRows.map");
    expect(burdenReportPanel).toContain("Current task demand by age");
  });

  it("renders a read-only staff queue snapshot in the owner workspace", () => {
    expect(workspace).toContain("taskQueueStateSummary(tasks)");
    expect(workspace).toContain("taskWorkflowStageSummaries(tasks)");
    expect(workspace).toContain("taskActivityTrailSummaries(tasks, taskEvents)");
    expect(workspace).toContain("taskStatusSummaries(tasks)");
    expect(workspace).toContain("taskChannelSummaries(tasks)");
    expect(workspace).toContain("taskLocationSummaries(tasks, locations)");
    expect(workspace).toContain("taskAssigneeSummaries(");
    expect(workspace).toContain("taskAgeSummaries(tasks)");
    expect(workspace).toContain("taskLastTouchSummaries(tasks)");
    expect(workspace).toContain("taskAttentionSummaries(tasks)");
    expect(workspace).toContain("taskConfidenceSummaries(tasks)");
    expect(workspace).toContain("taskFollowUpModeSummaries(tasks)");
    expect(workspace).toContain("taskIntentSummaries(tasks)");
    expect(workspace).toContain("taskNextStepSummaries(tasks)");
    expect(workspace).toContain("taskProofCompletionSummaries(tasks, taskEvents)");
    expect(workspace).toContain("taskRequesterContactSummaries(tasks)");
    expect(workspace).toContain('aria-label="Staff queue snapshot"');
    expect(workspace).toContain("Open work stays visible before channels go live");
    expect(workspace).toContain("taskQueueSummary.openCount");
    expect(workspace).toContain("taskQueueSummary.terminalCount");
    expect(workspace).toContain("taskStatusSummaryRows.map");
    expect(workspace).toContain('aria-label="Staff task status mix"');
    expect(workspace).toContain("taskWorkflowStageSummaryRows.map");
    expect(workspace).toContain('aria-label="Staff task workflow-stage mix"');
    expect(workspace).toContain("taskActivityTrailSummaryRows.map");
    expect(workspace).toContain('aria-label="Staff task activity trail mix"');
    expect(workspace).toContain("taskChannelSummaryRows.map");
    expect(workspace).toContain('aria-label="Staff task channel mix"');
    expect(workspace).toContain("taskLocationSummaryRows.map");
    expect(workspace).toContain('aria-label="Staff task location mix"');
    expect(workspace).toContain("taskAssigneeSummaryRows.map");
    expect(workspace).toContain('aria-label="Staff task assignee mix"');
    expect(workspace).toContain("taskAgeSummaryRows.map");
    expect(workspace).toContain('aria-label="Staff task age mix"');
    expect(workspace).toContain("taskLastTouchSummaryRows.map");
    expect(workspace).toContain('aria-label="Staff task last-touch mix"');
    expect(workspace).toContain("taskAttentionSummaryRows.map");
    expect(workspace).toContain('aria-label="Staff task attention mix"');
    expect(workspace).toContain("taskConfidenceSummaryRows.map");
    expect(workspace).toContain('aria-label="Staff task confidence mix"');
    expect(workspace).toContain("taskProofCompletionSummaryRows.map");
    expect(workspace).toContain('aria-label="Staff task proof completion mix"');
    expect(workspace).toContain("taskIntentSummaryRows.map");
    expect(workspace).toContain('aria-label="Staff task intent mix"');
    expect(workspace).toContain("title={summary.fullLabel}");
    expect(workspace).toContain("taskNextStepSummaryRows.map");
    expect(workspace).toContain('aria-label="Staff task next-step mix"');
    expect(workspace).toContain("taskRequesterContactSummaryRows.map");
    expect(workspace).toContain('aria-label="Staff requester contact mix"');
    expect(workspace).toContain("taskFollowUpModeSummaryRows.map");
    expect(workspace).toContain('aria-label="Staff follow-up mode mix"');
    expect(workspace).toContain("taskMemberSystemBoundarySummaryRows.map");
    expect(workspace).toContain('aria-label="Staff member-system boundary mix"');
    expect(workspace).toContain("taskOwnerPolicyDependencySummaryRows.map");
    expect(workspace).toContain('aria-label="Staff owner-policy dependency mix"');
    expect(workspace).toContain("taskStaffActionLaneSummaryRows.map");
    expect(workspace).toContain('aria-label="Staff action-lane mix"');
    expect(workspace).toContain("taskMemberSystemHoldQueue(tasks)");
    expect(workspace).toContain("memberSystemHoldQueueRows.map");
    expect(workspace).toContain('aria-label="Member-system hold queue"');
    expect(workspace).toContain("taskOwnerPolicyReviewQueue(tasks)");
    expect(workspace).toContain("ownerPolicyReviewQueueRows.map");
    expect(workspace).toContain('aria-label="Owner policy review queue"');
    expect(workspace).toContain("taskStaffReplyReadyQueue(tasks)");
    expect(workspace).toContain("staffReplyReadyQueueRows.map");
    expect(workspace).toContain('aria-label="Staff reply-ready queue"');
    expect(workspace).toContain('role="region"');
    expect(workspace).toContain("Phone/email providers, outbound delivery, billing, POS, access");
    expect(globals).toContain(".owner-staff-queue-snapshot");
    expect(globals).toContain(".owner-staff-queue-metrics");
    expect(globals).toContain(".owner-staff-status-mix");
    expect(globals).toContain(".owner-staff-workflow-stage-mix");
    expect(globals).toContain(
      ".owner-staff-workflow-stage-mix .task-workflow-stage-unassigned_intake"
    );
    expect(globals).toContain(".owner-staff-activity-trail-mix");
    expect(globals).toContain(".owner-staff-activity-trail-mix .task-activity-trail-no_trail");
    expect(globals).toContain(".owner-staff-channel-mix");
    expect(globals).toContain(".owner-staff-location-mix");
    expect(globals).toContain(".owner-staff-assignee-mix");
    expect(globals).toContain(".owner-staff-age-mix");
    expect(globals).toContain(".owner-staff-age-mix .task-age-stale");
    expect(globals).toContain(".owner-staff-last-touch-mix");
    expect(globals).toContain(".owner-staff-last-touch-mix .task-last-touch-stalled");
    expect(globals).toContain(".owner-staff-attention-mix");
    expect(globals).toContain(".owner-staff-attention-mix .task-attention-attention");
    expect(globals).toContain(".owner-staff-attention-mix .task-attention-clear");
    expect(globals).toContain(".owner-staff-confidence-mix");
    expect(globals).toContain(".owner-staff-confidence-mix .task-confidence-low");
    expect(globals).toContain(".owner-staff-confidence-mix .task-confidence-medium");
    expect(globals).toContain(".owner-staff-confidence-mix .task-confidence-high");
    expect(globals).toContain(".owner-staff-proof-completion-mix");
    expect(globals).toContain(
      ".owner-staff-proof-completion-mix .task-proof-completion-pending"
    );
    expect(globals).toContain(
      ".owner-staff-proof-completion-mix .task-proof-completion-complete"
    );
    expect(globals).toContain(".owner-staff-intent-mix");
    expect(globals).toContain(".owner-staff-intent-mix div");
    expect(globals).toContain(".owner-staff-next-step-mix");
    expect(globals).toContain(".owner-staff-next-step-mix div");
    expect(globals).toContain(".owner-staff-requester-contact-mix");
    expect(globals).toContain(".owner-staff-follow-up-mode-mix");
    expect(globals).toContain(
      ".owner-staff-follow-up-mode-mix .task-follow-up-mode-phone_follow_up"
    );
    expect(globals).toContain(".owner-staff-member-system-boundary-mix");
    expect(globals).toContain(
      ".owner-staff-member-system-boundary-mix .task-member-system-boundary-member_system_blocked"
    );
    expect(globals).toContain(".owner-staff-owner-policy-dependency-mix");
    expect(globals).toContain(
      ".owner-staff-owner-policy-dependency-mix .task-owner-policy-dependency-owner_policy_needed"
    );
    expect(globals).toContain(".owner-staff-action-lane-mix");
    expect(globals).toContain(
      ".owner-staff-action-lane-mix .task-staff-action-lane-member_system_hold"
    );
    expect(globals).toContain(".owner-policy-review-queue");
    expect(globals).toContain(".owner-policy-review-queue-item");
    expect(globals).toContain(".task-action-queue");
    expect(globals).toContain(".task-action-queue-item-staff-reply-ready");
    expect(globals).toContain(".task-action-queue-item-member-system-hold");
    expect(globals).toContain(
      ".owner-staff-requester-contact-mix .task-requester-contact-email"
    );
    expect(globals).toContain(
      ".owner-staff-requester-contact-mix .task-requester-contact-phone"
    );
  });

  it("keeps the report derived from existing state and blocked readiness gates", () => {
    expect(burdenReportDomain).toContain("Derived from existing local source, answer, task, and readiness rows.");
    expect(burdenReportDomain).toContain("No hosted proof, SLA, provider ingress, notifications, billing, POS, or member-ledger behavior is claimed.");
    expect(burdenReportDomain).toContain("Hosted Neon proof and live phone/email providers remain intentionally closed.");
    expect(burdenReportDomain).not.toContain("rpc(");
    expect(burdenReportDomain).not.toContain("insert");
    expect(burdenReportDomain).not.toContain("update");
  });

  it("adds responsive report styling without nested cards or horizontal mobile layout", () => {
    expect(globals).toContain(".owner-burden-report");
    expect(globals).toContain(".owner-burden-metrics");
    expect(globals).toContain(".owner-burden-row");
    expect(globals).toContain(".owner-burden-channel-workload");
    expect(globals).toContain(".owner-burden-channel-rows");
    expect(globals).toContain(".owner-burden-common-requests");
    expect(globals).toContain(".owner-burden-common-request-row");
    expect(globals).toContain(".owner-burden-pressure");
    expect(globals).toContain(".owner-burden-pressure-row");
    expect(globals).toContain(".owner-burden-staff-intake");
    expect(globals).toContain(".owner-burden-staff-intake-row");
    expect(globals).toMatch(/\.owner-burden-hero,[\s\S]*\.owner-burden-metrics,[\s\S]*\.owner-burden-row,[\s\S]*grid-template-columns: 1fr;/u);
  });
});
