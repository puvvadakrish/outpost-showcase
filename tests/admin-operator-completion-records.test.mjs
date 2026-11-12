import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const founderAdminDomain = readFileSync("src/domain/founder-admin-readiness.ts", "utf8");
const sourceRecord = readFileSync("scripts/record-admin-source-apply-completion.mjs", "utf8");
const sourceInspect = readFileSync("scripts/inspect-admin-source-apply-completion.mjs", "utf8");
const emailRecord = readFileSync("scripts/record-admin-email-task-completion.mjs", "utf8");
const emailInspect = readFileSync("scripts/inspect-admin-email-task-completion.mjs", "utf8");

function run(script, env) {
  return spawnSync("node", [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...env }
  });
}

function artifactPath(name) {
  mkdirSync("artifacts/admin-launch-readiness", { recursive: true });
  return `artifacts/admin-launch-readiness/${name}`;
}

function removeIfExists(path) {
  if (existsSync(path)) rmSync(path);
}

function writeJsonArtifact(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function sourceApplyParent(overrides = {}) {
  return {
    artifact_kind: "admin_source_apply_rehearsal",
    status: "source_apply_rehearsal_prepared",
    gym_name: "Proof Gym",
    owner_email: "owner@example.com",
    source_label: "Reviewed source",
    location_label: "Front desk",
    source_workflow_rehearsal_sha256: "a".repeat(64),
    manual_source_payload: {
      title: "Reviewed facts",
      facts: [{ topic: "Hours", value: "Open weekdays", confidence: 0.9 }]
    },
    browser_steps: ["Open owner", "Paste facts", "Stage review"],
    artifact_runtime_write_allowed: false,
    existing_owner_manual_intake_allowed: true,
    automatic_answer_approval_allowed: false,
    automatic_task_generation_allowed: false,
    email_or_notification_allowed: false,
    live_provider_enablement_allowed: false,
    public_self_serve_launch_allowed: false,
    blocked_gates: [
      "public_owner_self_signup",
      "website_scraping",
      "google_profile_api_import",
      "automatic_answer_approval",
      "task_generation",
      "notification_sending",
      "phone_email_provider_activation",
      "billing",
      "pos_access_control_member_ledger_writes",
      "email_ingress",
      "outbound_email_delivery",
      "provider_webhooks"
    ],
    ...overrides
  };
}

function emailTaskParent(overrides = {}) {
  return {
    artifact_kind: "admin_email_task_rehearsal",
    status: "email_task_rehearsal_prepared",
    gym_name: "Proof Gym",
    owner_email: "owner@example.com",
    mailbox_label: "front-desk",
    email_triage_rehearsal_sha256: "b".repeat(64),
    triage_category: "membership-freeze",
    manual_task_payload: {
      title: "membership-freeze",
      body: "Call member to confirm freeze policy"
    },
    browser_steps: ["Review owner policy", "Create manual staff task", "Keep providers blocked"],
    artifact_runtime_write_allowed: false,
    existing_manual_task_entry_allowed: true,
    automatic_task_creation_allowed: false,
    email_ingress_allowed: false,
    outbound_email_allowed: false,
    notification_sending_allowed: false,
    live_provider_enablement_allowed: false,
    public_self_serve_launch_allowed: false,
    blocked_gates: [
      "public_owner_self_signup",
      "gmail_connection",
      "resend_connection",
      "smtp_connection",
      "provider_webhooks",
      "email_ingress",
      "outbound_email_delivery",
      "notification_sending",
      "task_generation",
      "billing",
      "pos_access_control_member_ledger_writes"
    ],
    ...overrides
  };
}

const sourceCompletionEnv = {
  OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_OPERATOR: "Operator completion",
  OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_OWNER_WORKSPACE_OBSERVED: "yes",
  OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_MANUAL_SOURCE_SAVED: "yes",
  OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_ANSWER_REVIEW_STAGED: "yes",
  OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_AUTOMATIC_APPROVAL_NOT_OBSERVED: "yes",
  OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_LIVE_PROVIDER_COPY_BLOCKED: "yes"
};

const emailCompletionEnv = {
  OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_OPERATOR: "Operator completion",
  OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_OWNER_REVIEW_OBSERVED: "yes",
  OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_MANUAL_TASK_DECISION_OBSERVED: "yes",
  OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_EMAIL_INGRESS_NOT_OBSERVED: "yes",
  OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_OUTBOUND_DELIVERY_NOT_OBSERVED: "yes",
  OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_NOTIFICATION_NOT_OBSERVED: "yes",
  OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_LIVE_PROVIDER_COPY_BLOCKED: "yes"
};

describe("admin operator completion records", () => {
  it("wires source and email completion records without opening live gates", () => {
    expect(packageJson).toContain("admin:source-apply:record");
    expect(packageJson).toContain("admin:source-apply:record-inspect");
    expect(packageJson).toContain("admin:email-task:record");
    expect(packageJson).toContain("admin:email-task:record-inspect");
    expect(founderAdminDomain).toContain("Record observed source completion");
    expect(founderAdminDomain).toContain("Inspect observed source completion");
    expect(founderAdminDomain).toContain("Record observed email task completion");
    expect(founderAdminDomain).toContain("Inspect observed email task completion");
    expect(sourceRecord).toContain('source_import_automation_allowed: false');
    expect(sourceInspect).toContain("Customer-observed handoff must not be claimed");
    expect(emailRecord).toContain("email_ingress_allowed: false");
    expect(emailInspect).toContain("Outbound delivery must be observed absent");
  });

  it("records and inspects source apply completion from a prepared rehearsal", () => {
    const parentPath = artifactPath("source-apply-parent-completion-test.json");
    const completionPath = artifactPath("source-apply-completion-test.json");
    removeIfExists(completionPath);
    writeJsonArtifact(parentPath, sourceApplyParent());

    const record = run("scripts/record-admin-source-apply-completion.mjs", {
      OUTPOST_ADMIN_SOURCE_APPLY_REHEARSAL_PATH: parentPath,
      OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_PATH: completionPath,
      ...sourceCompletionEnv
    });
    expect(record.status).toBe(0);

    const inspect = run("scripts/inspect-admin-source-apply-completion.mjs", {
      OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_PATH: completionPath
    });
    expect(inspect.status).toBe(0);

    const artifact = JSON.parse(readFileSync(completionPath, "utf8"));
    expect(artifact.artifact_kind).toBe("admin_source_apply_completion");
    expect(artifact.source_apply_rehearsal_sha256).toBe(
      createHash("sha256").update(readFileSync(parentPath, "utf8")).digest("hex")
    );
    expect(artifact.observed.manual_source_saved).toBe(true);
    expect(artifact.customer_observed_handoff_claimed).toBe(false);
    expect(artifact.live_provider_enablement_allowed).toBe(false);
  });

  it("records and inspects email task completion from a prepared rehearsal", () => {
    const parentPath = artifactPath("email-task-parent-completion-test.json");
    const completionPath = artifactPath("email-task-completion-test.json");
    removeIfExists(completionPath);
    writeJsonArtifact(parentPath, emailTaskParent());

    const record = run("scripts/record-admin-email-task-completion.mjs", {
      OUTPOST_ADMIN_EMAIL_TASK_REHEARSAL_PATH: parentPath,
      OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_PATH: completionPath,
      ...emailCompletionEnv
    });
    expect(record.status).toBe(0);

    const inspect = run("scripts/inspect-admin-email-task-completion.mjs", {
      OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_PATH: completionPath
    });
    expect(inspect.status).toBe(0);

    const artifact = JSON.parse(readFileSync(completionPath, "utf8"));
    expect(artifact.artifact_kind).toBe("admin_email_task_completion");
    expect(artifact.email_task_rehearsal_sha256).toBe(
      createHash("sha256").update(readFileSync(parentPath, "utf8")).digest("hex")
    );
    expect(artifact.observed.email_ingress_not_observed).toBe(true);
    expect(artifact.notification_sending_allowed).toBe(false);
    expect(artifact.live_provider_enablement_allowed).toBe(false);
  });

  it("rejects tampered parents, missing observations, path escapes, secrets, and overwrites", () => {
    const parentPath = artifactPath("source-apply-parent-tamper-test.json");
    const completionPath = artifactPath("source-apply-completion-tamper-test.json");
    removeIfExists(completionPath);

    writeJsonArtifact(parentPath, sourceApplyParent({ automatic_answer_approval_allowed: true }));
    const tampered = run("scripts/record-admin-source-apply-completion.mjs", {
      OUTPOST_ADMIN_SOURCE_APPLY_REHEARSAL_PATH: parentPath,
      OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_PATH: completionPath,
      ...sourceCompletionEnv
    });
    expect(tampered.status).not.toBe(0);

    writeJsonArtifact(parentPath, sourceApplyParent());
    const missingObservation = run("scripts/record-admin-source-apply-completion.mjs", {
      OUTPOST_ADMIN_SOURCE_APPLY_REHEARSAL_PATH: parentPath,
      OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_PATH: completionPath,
      ...sourceCompletionEnv,
      OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_MANUAL_SOURCE_SAVED: "no"
    });
    expect(missingObservation.status).not.toBe(0);

    const pathEscape = run("scripts/record-admin-source-apply-completion.mjs", {
      OUTPOST_ADMIN_SOURCE_APPLY_REHEARSAL_PATH: "../source-apply-parent.json",
      OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_PATH: completionPath,
      ...sourceCompletionEnv
    });
    expect(pathEscape.status).not.toBe(0);

    const secretInput = run("scripts/record-admin-source-apply-completion.mjs", {
      OUTPOST_ADMIN_SOURCE_APPLY_REHEARSAL_PATH: parentPath,
      OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_PATH: completionPath,
      ...sourceCompletionEnv,
      OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_NOTES: "token: abcdefghijklmnop"
    });
    expect(secretInput.status).not.toBe(0);

    const record = run("scripts/record-admin-source-apply-completion.mjs", {
      OUTPOST_ADMIN_SOURCE_APPLY_REHEARSAL_PATH: parentPath,
      OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_PATH: completionPath,
      ...sourceCompletionEnv
    });
    expect(record.status).toBe(0);

    const overwrite = run("scripts/record-admin-source-apply-completion.mjs", {
      OUTPOST_ADMIN_SOURCE_APPLY_REHEARSAL_PATH: parentPath,
      OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_PATH: completionPath,
      ...sourceCompletionEnv
    });
    expect(overwrite.status).not.toBe(0);
  });

  it("rejects forged completion artifacts that imply opened gates", () => {
    const sourceParentPath = artifactPath("source-apply-completion-forged-parent-test.json");
    const emailParentPath = artifactPath("email-task-completion-forged-parent-test.json");
    const sourceCompletionPath = artifactPath("source-apply-completion-forged-test.json");
    const emailCompletionPath = artifactPath("email-task-completion-forged-test.json");
    writeJsonArtifact(sourceParentPath, sourceApplyParent());
    writeJsonArtifact(emailParentPath, emailTaskParent());
    writeJsonArtifact(sourceCompletionPath, {
      artifact_kind: "admin_source_apply_completion",
      status: "source_apply_completion_recorded",
      source_apply_rehearsal_path: sourceParentPath,
      source_apply_rehearsal_sha256: createHash("sha256").update(readFileSync(sourceParentPath, "utf8")).digest("hex"),
      observed: {
        owner_workspace_observed: true,
        manual_source_saved: true,
        answer_review_staged: true,
        automatic_approval_not_observed: true,
        live_provider_copy_blocked: true
      },
      existing_owner_manual_intake_allowed: true,
      artifact_runtime_write_allowed: false,
      source_import_automation_allowed: false,
      automatic_answer_approval_allowed: true,
      automatic_task_generation_allowed: false,
      email_or_notification_allowed: false,
      live_provider_enablement_allowed: false,
      public_self_serve_launch_allowed: false,
      customer_observed_handoff_claimed: false,
      billing_pos_member_writes_allowed: false,
      blocked_gates: sourceApplyParent().blocked_gates
    });
    writeJsonArtifact(emailCompletionPath, {
      artifact_kind: "admin_email_task_completion",
      status: "email_task_completion_recorded",
      email_task_rehearsal_path: emailParentPath,
      email_task_rehearsal_sha256: createHash("sha256").update(readFileSync(emailParentPath, "utf8")).digest("hex"),
      observed: {
        owner_review_observed: true,
        manual_task_decision_observed: true,
        email_ingress_not_observed: true,
        outbound_delivery_not_observed: true,
        notification_not_observed: false,
        live_provider_copy_blocked: true
      },
      existing_manual_task_entry_allowed: true,
      artifact_runtime_write_allowed: false,
      automatic_task_creation_allowed: false,
      email_ingress_allowed: false,
      outbound_email_allowed: false,
      notification_sending_allowed: false,
      live_provider_enablement_allowed: false,
      public_self_serve_launch_allowed: false,
      customer_observed_handoff_claimed: false,
      billing_pos_member_writes_allowed: false,
      blocked_gates: emailTaskParent().blocked_gates
    });

    const sourceInspectResult = run("scripts/inspect-admin-source-apply-completion.mjs", {
      OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_PATH: sourceCompletionPath
    });
    const emailInspectResult = run("scripts/inspect-admin-email-task-completion.mjs", {
      OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_PATH: emailCompletionPath
    });
    expect(sourceInspectResult.status).not.toBe(0);
    expect(emailInspectResult.status).not.toBe(0);
  });

  it("rejects completion artifacts whose recorded parent SHA does not match the parent", () => {
    const sourceParentPath = artifactPath("source-apply-completion-mismatch-parent-test.json");
    const sourceCompletionPath = artifactPath("source-apply-completion-mismatch-test.json");
    const emailParentPath = artifactPath("email-task-completion-mismatch-parent-test.json");
    const emailCompletionPath = artifactPath("email-task-completion-mismatch-test.json");
    writeJsonArtifact(sourceParentPath, sourceApplyParent());
    writeJsonArtifact(emailParentPath, emailTaskParent());
    writeJsonArtifact(sourceCompletionPath, {
      artifact_kind: "admin_source_apply_completion",
      status: "source_apply_completion_recorded",
      source_apply_rehearsal_path: sourceParentPath,
      source_apply_rehearsal_sha256: "e".repeat(64),
      observed: {
        owner_workspace_observed: true,
        manual_source_saved: true,
        answer_review_staged: true,
        automatic_approval_not_observed: true,
        live_provider_copy_blocked: true
      },
      existing_owner_manual_intake_allowed: true,
      artifact_runtime_write_allowed: false,
      source_import_automation_allowed: false,
      automatic_answer_approval_allowed: false,
      automatic_task_generation_allowed: false,
      email_or_notification_allowed: false,
      live_provider_enablement_allowed: false,
      public_self_serve_launch_allowed: false,
      customer_observed_handoff_claimed: false,
      billing_pos_member_writes_allowed: false,
      blocked_gates: sourceApplyParent().blocked_gates
    });
    writeJsonArtifact(emailCompletionPath, {
      artifact_kind: "admin_email_task_completion",
      status: "email_task_completion_recorded",
      email_task_rehearsal_path: emailParentPath,
      email_task_rehearsal_sha256: "f".repeat(64),
      observed: {
        owner_review_observed: true,
        manual_task_decision_observed: true,
        email_ingress_not_observed: true,
        outbound_delivery_not_observed: true,
        notification_not_observed: true,
        live_provider_copy_blocked: true
      },
      existing_manual_task_entry_allowed: true,
      artifact_runtime_write_allowed: false,
      automatic_task_creation_allowed: false,
      email_ingress_allowed: false,
      outbound_email_allowed: false,
      notification_sending_allowed: false,
      live_provider_enablement_allowed: false,
      public_self_serve_launch_allowed: false,
      customer_observed_handoff_claimed: false,
      billing_pos_member_writes_allowed: false,
      blocked_gates: emailTaskParent().blocked_gates
    });

    const sourceInspectResult = run("scripts/inspect-admin-source-apply-completion.mjs", {
      OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_PATH: sourceCompletionPath
    });
    const emailInspectResult = run("scripts/inspect-admin-email-task-completion.mjs", {
      OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_PATH: emailCompletionPath
    });
    expect(sourceInspectResult.status).not.toBe(0);
    expect(emailInspectResult.status).not.toBe(0);
  });
});
