import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const founderAdminDomain = readFileSync("src/domain/founder-admin-readiness.ts", "utf8");
const prepareScript = readFileSync("scripts/prepare-admin-launch-evidence-bundle.mjs", "utf8");
const inspectScript = readFileSync("scripts/inspect-admin-launch-evidence-bundle.mjs", "utf8");

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

function sha(path) {
  return createHash("sha256").update(readFileSync(path, "utf8")).digest("hex");
}

function sourceApplyParent(overrides = {}) {
  return {
    artifact_kind: "admin_source_apply_rehearsal",
    status: "source_apply_rehearsal_prepared",
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

function sourceCompletion(parentPath, overrides = {}) {
  return {
    artifact_kind: "admin_source_apply_completion",
    status: "source_apply_completion_recorded",
    gym_name: "Proof Gym",
    owner_email: "owner@example.com",
    source_label: "Reviewed source",
    location_label: "Front desk",
    source_apply_rehearsal_path: parentPath,
    source_apply_rehearsal_sha256: sha(parentPath),
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
    blocked_gates: sourceApplyParent().blocked_gates,
    ...overrides
  };
}

function emailCompletion(parentPath, overrides = {}) {
  return {
    artifact_kind: "admin_email_task_completion",
    status: "email_task_completion_recorded",
    gym_name: "Proof Gym",
    owner_email: "owner@example.com",
    mailbox_label: "front-desk",
    triage_category: "membership-freeze",
    email_task_rehearsal_path: parentPath,
    email_task_rehearsal_sha256: sha(parentPath),
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
    blocked_gates: emailTaskParent().blocked_gates,
    ...overrides
  };
}

function writeValidCompletionArtifacts(prefix, sourceOverrides = {}, emailOverrides = {}) {
  const sourceParentPath = artifactPath(`${prefix}-source-parent.json`);
  const emailParentPath = artifactPath(`${prefix}-email-parent.json`);
  const sourceCompletionPath = artifactPath(`${prefix}-source-completion.json`);
  const emailCompletionPath = artifactPath(`${prefix}-email-completion.json`);
  writeJsonArtifact(sourceParentPath, sourceApplyParent());
  writeJsonArtifact(emailParentPath, emailTaskParent());
  writeJsonArtifact(sourceCompletionPath, sourceCompletion(sourceParentPath, sourceOverrides));
  writeJsonArtifact(emailCompletionPath, emailCompletion(emailParentPath, emailOverrides));
  return { sourceCompletionPath, emailCompletionPath };
}

describe("admin launch evidence bundle", () => {
  it("wires launch evidence bundle scripts and admin command copy", () => {
    expect(packageJson).toContain("admin:launch-evidence:bundle");
    expect(packageJson).toContain("admin:launch-evidence:inspect");
    expect(founderAdminDomain).toContain("Prepare launch evidence bundle");
    expect(founderAdminDomain).toContain("Inspect launch evidence bundle");
    expect(prepareScript).toContain("admin_launch_evidence_bundle");
    expect(inspectScript).toContain("Customer-observed handoff must not be claimed");
    expect(prepareScript).not.toMatch(/sendEmail|sendInvite|bootstrap_owner_tenant|provider_webhooks_write/iu);
  });

  it("prepares and inspects a launch evidence bundle from source and email completions", () => {
    const { sourceCompletionPath, emailCompletionPath } = writeValidCompletionArtifacts("launch-evidence-happy");
    const bundlePath = artifactPath("launch-evidence-happy-bundle.json");
    removeIfExists(bundlePath);

    const prepare = run("scripts/prepare-admin-launch-evidence-bundle.mjs", {
      OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_PATH: sourceCompletionPath,
      OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_PATH: emailCompletionPath,
      OUTPOST_ADMIN_LAUNCH_EVIDENCE_BUNDLE_PATH: bundlePath
    });
    expect(prepare.status).toBe(0);

    const inspect = run("scripts/inspect-admin-launch-evidence-bundle.mjs", {
      OUTPOST_ADMIN_LAUNCH_EVIDENCE_BUNDLE_PATH: bundlePath
    });
    expect(inspect.status).toBe(0);

    const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
    expect(bundle.artifact_kind).toBe("admin_launch_evidence_bundle");
    expect(bundle.source_apply_completion_sha256).toBe(sha(sourceCompletionPath));
    expect(bundle.email_task_completion_sha256).toBe(sha(emailCompletionPath));
    expect(bundle.operator_evidence_ready).toBe(true);
    expect(bundle.customer_observed_handoff_claimed).toBe(false);
    expect(bundle.public_self_serve_launch_allowed).toBe(false);
  });

  it("fails closed for child completion gate tampering and missing artifacts", () => {
    const { sourceCompletionPath, emailCompletionPath } = writeValidCompletionArtifacts(
      "launch-evidence-tamper",
      { customer_observed_handoff_claimed: true }
    );
    const bundlePath = artifactPath("launch-evidence-tamper-bundle.json");
    removeIfExists(bundlePath);

    const tamperedChild = run("scripts/prepare-admin-launch-evidence-bundle.mjs", {
      OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_PATH: sourceCompletionPath,
      OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_PATH: emailCompletionPath,
      OUTPOST_ADMIN_LAUNCH_EVIDENCE_BUNDLE_PATH: bundlePath
    });
    expect(tamperedChild.status).not.toBe(0);

    const missingChild = run("scripts/prepare-admin-launch-evidence-bundle.mjs", {
      OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_PATH: "artifacts/admin-launch-readiness/missing-source-completion.json",
      OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_PATH: emailCompletionPath,
      OUTPOST_ADMIN_LAUNCH_EVIDENCE_BUNDLE_PATH: bundlePath
    });
    expect(missingChild.status).not.toBe(0);
  });

  it("rejects source and email completions for different launch subjects", () => {
    const { sourceCompletionPath, emailCompletionPath } = writeValidCompletionArtifacts(
      "launch-evidence-subject-mismatch",
      {},
      { gym_name: "Other Gym" }
    );
    const bundlePath = artifactPath("launch-evidence-subject-mismatch-bundle.json");
    removeIfExists(bundlePath);

    const prepare = run("scripts/prepare-admin-launch-evidence-bundle.mjs", {
      OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_PATH: sourceCompletionPath,
      OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_PATH: emailCompletionPath,
      OUTPOST_ADMIN_LAUNCH_EVIDENCE_BUNDLE_PATH: bundlePath
    });
    expect(prepare.status).not.toBe(0);
  });

  it("inspect re-verifies completion rehearsal parent hashes", () => {
    const { sourceCompletionPath, emailCompletionPath } = writeValidCompletionArtifacts("launch-evidence-grandparent");
    const bundlePath = artifactPath("launch-evidence-grandparent-bundle.json");
    removeIfExists(bundlePath);

    const prepare = run("scripts/prepare-admin-launch-evidence-bundle.mjs", {
      OUTPOST_ADMIN_SOURCE_APPLY_COMPLETION_PATH: sourceCompletionPath,
      OUTPOST_ADMIN_EMAIL_TASK_COMPLETION_PATH: emailCompletionPath,
      OUTPOST_ADMIN_LAUNCH_EVIDENCE_BUNDLE_PATH: bundlePath
    });
    expect(prepare.status).toBe(0);

    const sourceCompletionArtifact = JSON.parse(readFileSync(sourceCompletionPath, "utf8"));
    writeJsonArtifact(sourceCompletionArtifact.source_apply_rehearsal_path, sourceApplyParent({ status: "tampered" }));

    const inspect = run("scripts/inspect-admin-launch-evidence-bundle.mjs", {
      OUTPOST_ADMIN_LAUNCH_EVIDENCE_BUNDLE_PATH: bundlePath
    });
    expect(inspect.status).not.toBe(0);
  });

  it("rejects forged bundles with mismatched child hashes or opened gates", () => {
    const { sourceCompletionPath, emailCompletionPath } = writeValidCompletionArtifacts("launch-evidence-forged");
    const mismatchPath = artifactPath("launch-evidence-forged-mismatch-bundle.json");
    const openedGatePath = artifactPath("launch-evidence-forged-opened-gate-bundle.json");

    writeJsonArtifact(mismatchPath, {
      artifact_kind: "admin_launch_evidence_bundle",
      status: "admin_launch_evidence_bundle_prepared",
      evidence_basis: "operator_observed_source_apply_and_email_task_completion_records",
      source_apply_completion_path: sourceCompletionPath,
      source_apply_completion_sha256: "a".repeat(64),
      email_task_completion_path: emailCompletionPath,
      email_task_completion_sha256: sha(emailCompletionPath),
      operator_evidence_ready: true,
      public_self_serve_launch_allowed: false,
      customer_observed_handoff_claimed: false,
      source_import_automation_allowed: false,
      automatic_answer_approval_allowed: false,
      automatic_task_generation_allowed: false,
      email_ingress_allowed: false,
      outbound_email_allowed: false,
      notification_sending_allowed: false,
      live_provider_enablement_allowed: false,
      billing_pos_member_writes_allowed: false,
      ready_gates: [
        "Operator-observed source apply completion",
        "Operator-observed email task completion",
        "Parent artifact SHA chain"
      ],
      blocked_gates: [
        "Public self-serve launch",
        "Customer-observed handoff claim",
        "Inbound email, outbound delivery, and notifications",
        "Billing, POS, access control, and member-ledger writes"
      ],
      command_sequence: ["npm run admin:launch-evidence:inspect"]
    });
    writeJsonArtifact(openedGatePath, {
      ...JSON.parse(readFileSync(mismatchPath, "utf8")),
      source_apply_completion_sha256: sha(sourceCompletionPath),
      customer_observed_handoff_claimed: true
    });

    const mismatch = run("scripts/inspect-admin-launch-evidence-bundle.mjs", {
      OUTPOST_ADMIN_LAUNCH_EVIDENCE_BUNDLE_PATH: mismatchPath
    });
    const openedGate = run("scripts/inspect-admin-launch-evidence-bundle.mjs", {
      OUTPOST_ADMIN_LAUNCH_EVIDENCE_BUNDLE_PATH: openedGatePath
    });
    expect(mismatch.status).not.toBe(0);
    expect(openedGate.status).not.toBe(0);
  });

  it("inspect rejects bundles whose hash-matched child completion is unsafe", () => {
    const sourceParentPath = artifactPath("launch-evidence-unsafe-child-source-parent.json");
    const emailParentPath = artifactPath("launch-evidence-unsafe-child-email-parent.json");
    const sourceCompletionPath = artifactPath("launch-evidence-unsafe-child-source-completion.json");
    const emailCompletionPath = artifactPath("launch-evidence-unsafe-child-email-completion.json");
    const bundlePath = artifactPath("launch-evidence-unsafe-child-bundle.json");
    writeJsonArtifact(sourceParentPath, sourceApplyParent());
    writeJsonArtifact(emailParentPath, emailTaskParent());
    writeJsonArtifact(sourceCompletionPath, sourceCompletion(sourceParentPath, {
      artifact_runtime_write_allowed: true,
      blocked_gates: sourceApplyParent().blocked_gates.filter((gate) => gate !== "website_scraping")
    }));
    writeJsonArtifact(emailCompletionPath, emailCompletion(emailParentPath));
    writeJsonArtifact(bundlePath, {
      artifact_kind: "admin_launch_evidence_bundle",
      status: "admin_launch_evidence_bundle_prepared",
      evidence_basis: "operator_observed_source_apply_and_email_task_completion_records",
      source_apply_completion_path: sourceCompletionPath,
      source_apply_completion_sha256: sha(sourceCompletionPath),
      email_task_completion_path: emailCompletionPath,
      email_task_completion_sha256: sha(emailCompletionPath),
      operator_evidence_ready: true,
      public_self_serve_launch_allowed: false,
      customer_observed_handoff_claimed: false,
      source_import_automation_allowed: false,
      automatic_answer_approval_allowed: false,
      automatic_task_generation_allowed: false,
      email_ingress_allowed: false,
      outbound_email_allowed: false,
      notification_sending_allowed: false,
      live_provider_enablement_allowed: false,
      billing_pos_member_writes_allowed: false,
      ready_gates: [
        "Operator-observed source apply completion",
        "Operator-observed email task completion",
        "Parent artifact SHA chain"
      ],
      blocked_gates: [
        "Public self-serve launch",
        "Customer-observed handoff claim",
        "Inbound email, outbound delivery, and notifications",
        "Billing, POS, access control, and member-ledger writes"
      ],
      command_sequence: ["npm run admin:launch-evidence:inspect"]
    });

    const inspect = run("scripts/inspect-admin-launch-evidence-bundle.mjs", {
      OUTPOST_ADMIN_LAUNCH_EVIDENCE_BUNDLE_PATH: bundlePath
    });
    expect(inspect.status).not.toBe(0);
  });
});
