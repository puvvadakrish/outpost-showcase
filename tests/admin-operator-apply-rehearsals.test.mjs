import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const sourcePrepare = readFileSync("scripts/prepare-admin-source-apply-rehearsal.mjs", "utf8");
const sourceInspect = readFileSync("scripts/inspect-admin-source-apply-rehearsal.mjs", "utf8");
const emailPrepare = readFileSync("scripts/prepare-admin-email-task-rehearsal.mjs", "utf8");
const emailInspect = readFileSync("scripts/inspect-admin-email-task-rehearsal.mjs", "utf8");

function run(script, env) {
  return spawnSync("node", [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...env }
  });
}

function artifactsPath(name) {
  const dir = join(process.cwd(), "artifacts/admin-launch-readiness");
  mkdirSync(dir, { recursive: true });
  return join(dir, name);
}

function removeIfExists(path) {
  if (existsSync(path)) rmSync(path);
}

function writeSourceWorkflow(path, overrides = {}) {
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        artifact_kind: "admin_source_workflow_rehearsal",
        status: "source_workflow_rehearsal_prepared",
        gym_name: "Proof Gym",
        owner_email: "owner@example.com",
        source_label: "Reviewed source",
        location_label: "Front desk",
        source_facts_packet_sha256: "a".repeat(64),
        manual_source_payload: {
          title: "Reviewed facts",
          facts: [{ topic: "Hours", value: "Open weekdays", confidence: 0.9 }]
        },
        operator_steps: ["Open owner", "Paste facts", "Stage review"],
        public_self_serve_launch_allowed: false,
        source_runtime_write_allowed: false,
        automatic_answer_approval_allowed: false,
        task_generation_allowed: false,
        email_or_notification_allowed: false,
        live_provider_enablement_allowed: false,
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
      },
      null,
      2
    )}\n`
  );
}

function writeEmailTriage(path, overrides = {}) {
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        artifact_kind: "admin_email_triage_rehearsal",
        status: "email_triage_rehearsal_prepared",
        gym_name: "Proof Gym",
        owner_email: "owner@example.com",
        mailbox_label: "front-desk",
        email_sample_packet_sha256: "b".repeat(64),
        sample: {
          subject: "Freeze",
          sender_label: "member",
          body: "Can I freeze?",
          suggested_intent: "membership-freeze",
          suggested_next_step: "Review policy"
        },
        triage_category: "membership-freeze",
        owner_review_label: "Owner policy check",
        staff_task_draft: "Call member to confirm freeze policy",
        operator_steps: ["Review sample", "Classify", "Keep providers blocked"],
        public_self_serve_launch_allowed: false,
        email_ingress_allowed: false,
        outbound_email_allowed: false,
        notification_sending_allowed: false,
        task_creation_allowed: false,
        live_provider_enablement_allowed: false,
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
      },
      null,
      2
    )}\n`
  );
}

describe("admin operator apply rehearsals", () => {
  it("wires apply rehearsal commands and keeps automatic paths blocked", () => {
    expect(packageJson).toContain("admin:source-apply:rehearsal");
    expect(packageJson).toContain("admin:source-apply:inspect");
    expect(packageJson).toContain("admin:email-task:rehearsal");
    expect(packageJson).toContain("admin:email-task:inspect");
    expect(sourcePrepare).toContain("artifact_runtime_write_allowed: false");
    expect(sourceInspect).toContain("Automatic task generation must remain blocked");
    expect(emailPrepare).toContain("automatic_task_creation_allowed: false");
    expect(emailInspect).toContain("Email ingress must remain blocked");
  });

  it("prepares and inspects a source apply rehearsal from a source workflow rehearsal", () => {
    const workflowPath = artifactsPath("source-workflow-apply-parent-test.json");
    const applyPath = artifactsPath("source-apply-rehearsal-test.json");
    removeIfExists(applyPath);
    writeSourceWorkflow(workflowPath);

    const prepare = run("scripts/prepare-admin-source-apply-rehearsal.mjs", {
      OUTPOST_ADMIN_SOURCE_WORKFLOW_REHEARSAL_PATH: workflowPath,
      OUTPOST_ADMIN_SOURCE_APPLY_REHEARSAL_PATH: applyPath,
      OUTPOST_ADMIN_SOURCE_APPLY_OWNER_WORKSPACE_URL: "https://preview.example.test/owner",
      OUTPOST_ADMIN_SOURCE_APPLY_OPERATOR_LABEL: "Operator rehearsal"
    });
    expect(prepare.status).toBe(0);

    const inspect = run("scripts/inspect-admin-source-apply-rehearsal.mjs", {
      OUTPOST_ADMIN_SOURCE_APPLY_REHEARSAL_PATH: applyPath
    });
    expect(inspect.status).toBe(0);

    const artifact = JSON.parse(readFileSync(applyPath, "utf8"));
    expect(artifact.artifact_kind).toBe("admin_source_apply_rehearsal");
    expect(artifact.artifact_runtime_write_allowed).toBe(false);
    expect(artifact.existing_owner_manual_intake_allowed).toBe(true);
    expect(artifact.automatic_task_generation_allowed).toBe(false);
  });

  it("fails source apply rehearsal for tampered parent, path escape, secrets, overwrite, and forged artifact", () => {
    const workflowPath = artifactsPath("source-workflow-apply-guards-test.json");
    const applyPath = artifactsPath("source-apply-rehearsal-guards-test.json");
    removeIfExists(applyPath);
    writeSourceWorkflow(workflowPath, { automatic_answer_approval_allowed: true });

    const tamperedParent = run("scripts/prepare-admin-source-apply-rehearsal.mjs", {
      OUTPOST_ADMIN_SOURCE_WORKFLOW_REHEARSAL_PATH: workflowPath,
      OUTPOST_ADMIN_SOURCE_APPLY_REHEARSAL_PATH: applyPath,
      OUTPOST_ADMIN_SOURCE_APPLY_OWNER_WORKSPACE_URL: "https://preview.example.test/owner",
      OUTPOST_ADMIN_SOURCE_APPLY_OPERATOR_LABEL: "Operator rehearsal"
    });
    expect(tamperedParent.status).not.toBe(0);
    expect(`${tamperedParent.stdout}${tamperedParent.stderr}`).toContain("automatic answer approval blocked");

    writeSourceWorkflow(workflowPath);
    const pathEscape = run("scripts/prepare-admin-source-apply-rehearsal.mjs", {
      OUTPOST_ADMIN_SOURCE_WORKFLOW_REHEARSAL_PATH: workflowPath,
      OUTPOST_ADMIN_SOURCE_APPLY_REHEARSAL_PATH: "../source-apply-escape.json",
      OUTPOST_ADMIN_SOURCE_APPLY_OWNER_WORKSPACE_URL: "https://preview.example.test/owner",
      OUTPOST_ADMIN_SOURCE_APPLY_OPERATOR_LABEL: "Operator rehearsal"
    });
    expect(pathEscape.status).not.toBe(0);
    expect(`${pathEscape.stdout}${pathEscape.stderr}`).toContain("must live under artifacts");

    const secretInput = run("scripts/prepare-admin-source-apply-rehearsal.mjs", {
      OUTPOST_ADMIN_SOURCE_WORKFLOW_REHEARSAL_PATH: workflowPath,
      OUTPOST_ADMIN_SOURCE_APPLY_REHEARSAL_PATH: applyPath,
      OUTPOST_ADMIN_SOURCE_APPLY_OWNER_WORKSPACE_URL: "https://preview.example.test/owner",
      OUTPOST_ADMIN_SOURCE_APPLY_OPERATOR_LABEL: "api_key=abc12345678901234567890"
    });
    expect(secretInput.status).not.toBe(0);
    expect(`${secretInput.stdout}${secretInput.stderr}`).toContain("contains secret-shaped value");

    const firstWrite = run("scripts/prepare-admin-source-apply-rehearsal.mjs", {
      OUTPOST_ADMIN_SOURCE_WORKFLOW_REHEARSAL_PATH: workflowPath,
      OUTPOST_ADMIN_SOURCE_APPLY_REHEARSAL_PATH: applyPath,
      OUTPOST_ADMIN_SOURCE_APPLY_OWNER_WORKSPACE_URL: "https://preview.example.test/owner",
      OUTPOST_ADMIN_SOURCE_APPLY_OPERATOR_LABEL: "Operator rehearsal"
    });
    expect(firstWrite.status).toBe(0);
    const overwrite = run("scripts/prepare-admin-source-apply-rehearsal.mjs", {
      OUTPOST_ADMIN_SOURCE_WORKFLOW_REHEARSAL_PATH: workflowPath,
      OUTPOST_ADMIN_SOURCE_APPLY_REHEARSAL_PATH: applyPath,
      OUTPOST_ADMIN_SOURCE_APPLY_OWNER_WORKSPACE_URL: "https://preview.example.test/owner",
      OUTPOST_ADMIN_SOURCE_APPLY_OPERATOR_LABEL: "Operator rehearsal"
    });
    expect(overwrite.status).not.toBe(0);
    expect(`${overwrite.stdout}${overwrite.stderr}`).toContain("already exists");

    const forged = JSON.parse(readFileSync(applyPath, "utf8"));
    forged.automatic_task_generation_allowed = true;
    writeFileSync(applyPath, `${JSON.stringify(forged, null, 2)}\n`);
    const forgedInspect = run("scripts/inspect-admin-source-apply-rehearsal.mjs", {
      OUTPOST_ADMIN_SOURCE_APPLY_REHEARSAL_PATH: applyPath
    });
    expect(forgedInspect.status).not.toBe(0);
    expect(`${forgedInspect.stdout}${forgedInspect.stderr}`).toContain("Automatic task generation must remain blocked");
  });

  it("prepares and inspects an email task rehearsal from an email triage rehearsal", () => {
    const triagePath = artifactsPath("email-triage-task-parent-test.json");
    const taskPath = artifactsPath("email-task-rehearsal-test.json");
    removeIfExists(taskPath);
    writeEmailTriage(triagePath);

    const prepare = run("scripts/prepare-admin-email-task-rehearsal.mjs", {
      OUTPOST_ADMIN_EMAIL_TRIAGE_REHEARSAL_PATH: triagePath,
      OUTPOST_ADMIN_EMAIL_TASK_REHEARSAL_PATH: taskPath,
      OUTPOST_ADMIN_EMAIL_TASK_STAFF_WORKSPACE_URL: "https://preview.example.test/staff/tasks",
      OUTPOST_ADMIN_EMAIL_TASK_OPERATOR_LABEL: "Operator rehearsal"
    });
    expect(prepare.status).toBe(0);

    const inspect = run("scripts/inspect-admin-email-task-rehearsal.mjs", {
      OUTPOST_ADMIN_EMAIL_TASK_REHEARSAL_PATH: taskPath
    });
    expect(inspect.status).toBe(0);

    const artifact = JSON.parse(readFileSync(taskPath, "utf8"));
    expect(artifact.artifact_kind).toBe("admin_email_task_rehearsal");
    expect(artifact.artifact_runtime_write_allowed).toBe(false);
    expect(artifact.existing_manual_task_entry_allowed).toBe(true);
    expect(artifact.email_ingress_allowed).toBe(false);
  });

  it("fails email task rehearsal for tampered parent, path escape, secrets, overwrite, and forged artifact", () => {
    const triagePath = artifactsPath("email-triage-task-guards-test.json");
    const taskPath = artifactsPath("email-task-rehearsal-guards-test.json");
    removeIfExists(taskPath);
    writeEmailTriage(triagePath, { email_ingress_allowed: true });

    const tamperedParent = run("scripts/prepare-admin-email-task-rehearsal.mjs", {
      OUTPOST_ADMIN_EMAIL_TRIAGE_REHEARSAL_PATH: triagePath,
      OUTPOST_ADMIN_EMAIL_TASK_REHEARSAL_PATH: taskPath,
      OUTPOST_ADMIN_EMAIL_TASK_STAFF_WORKSPACE_URL: "https://preview.example.test/staff/tasks",
      OUTPOST_ADMIN_EMAIL_TASK_OPERATOR_LABEL: "Operator rehearsal"
    });
    expect(tamperedParent.status).not.toBe(0);
    expect(`${tamperedParent.stdout}${tamperedParent.stderr}`).toContain("email ingress blocked");

    writeEmailTriage(triagePath, { triage_category: "" });
    const missingParentPayload = run("scripts/prepare-admin-email-task-rehearsal.mjs", {
      OUTPOST_ADMIN_EMAIL_TRIAGE_REHEARSAL_PATH: triagePath,
      OUTPOST_ADMIN_EMAIL_TASK_REHEARSAL_PATH: taskPath,
      OUTPOST_ADMIN_EMAIL_TASK_STAFF_WORKSPACE_URL: "https://preview.example.test/staff/tasks",
      OUTPOST_ADMIN_EMAIL_TASK_OPERATOR_LABEL: "Operator rehearsal"
    });
    expect(missingParentPayload.status).not.toBe(0);
    expect(`${missingParentPayload.stdout}${missingParentPayload.stderr}`).toContain("must include triage category");

    writeEmailTriage(triagePath);
    const pathEscape = run("scripts/prepare-admin-email-task-rehearsal.mjs", {
      OUTPOST_ADMIN_EMAIL_TRIAGE_REHEARSAL_PATH: triagePath,
      OUTPOST_ADMIN_EMAIL_TASK_REHEARSAL_PATH: "../email-task-escape.json",
      OUTPOST_ADMIN_EMAIL_TASK_STAFF_WORKSPACE_URL: "https://preview.example.test/staff/tasks",
      OUTPOST_ADMIN_EMAIL_TASK_OPERATOR_LABEL: "Operator rehearsal"
    });
    expect(pathEscape.status).not.toBe(0);
    expect(`${pathEscape.stdout}${pathEscape.stderr}`).toContain("must live under artifacts");

    const secretInput = run("scripts/prepare-admin-email-task-rehearsal.mjs", {
      OUTPOST_ADMIN_EMAIL_TRIAGE_REHEARSAL_PATH: triagePath,
      OUTPOST_ADMIN_EMAIL_TASK_REHEARSAL_PATH: taskPath,
      OUTPOST_ADMIN_EMAIL_TASK_STAFF_WORKSPACE_URL: "https://preview.example.test/staff/tasks",
      OUTPOST_ADMIN_EMAIL_TASK_OPERATOR_LABEL: "Bearer abcdefghijklmnopqrstuvwxyz"
    });
    expect(secretInput.status).not.toBe(0);
    expect(`${secretInput.stdout}${secretInput.stderr}`).toContain("contains secret-shaped value");

    const firstWrite = run("scripts/prepare-admin-email-task-rehearsal.mjs", {
      OUTPOST_ADMIN_EMAIL_TRIAGE_REHEARSAL_PATH: triagePath,
      OUTPOST_ADMIN_EMAIL_TASK_REHEARSAL_PATH: taskPath,
      OUTPOST_ADMIN_EMAIL_TASK_STAFF_WORKSPACE_URL: "https://preview.example.test/staff/tasks",
      OUTPOST_ADMIN_EMAIL_TASK_OPERATOR_LABEL: "Operator rehearsal"
    });
    expect(firstWrite.status).toBe(0);
    const overwrite = run("scripts/prepare-admin-email-task-rehearsal.mjs", {
      OUTPOST_ADMIN_EMAIL_TRIAGE_REHEARSAL_PATH: triagePath,
      OUTPOST_ADMIN_EMAIL_TASK_REHEARSAL_PATH: taskPath,
      OUTPOST_ADMIN_EMAIL_TASK_STAFF_WORKSPACE_URL: "https://preview.example.test/staff/tasks",
      OUTPOST_ADMIN_EMAIL_TASK_OPERATOR_LABEL: "Operator rehearsal"
    });
    expect(overwrite.status).not.toBe(0);
    expect(`${overwrite.stdout}${overwrite.stderr}`).toContain("already exists");

    const forged = JSON.parse(readFileSync(taskPath, "utf8"));
    forged.email_ingress_allowed = true;
    writeFileSync(taskPath, `${JSON.stringify(forged, null, 2)}\n`);
    const forgedInspect = run("scripts/inspect-admin-email-task-rehearsal.mjs", {
      OUTPOST_ADMIN_EMAIL_TASK_REHEARSAL_PATH: taskPath
    });
    expect(forgedInspect.status).not.toBe(0);
    expect(`${forgedInspect.stdout}${forgedInspect.stderr}`).toContain("Email ingress must remain blocked");
  });
});
