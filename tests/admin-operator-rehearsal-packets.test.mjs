import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const founderAdminDomain = readFileSync("src/domain/founder-admin-readiness.ts", "utf8");
const sourcePrepare = readFileSync("scripts/prepare-admin-source-workflow-rehearsal.mjs", "utf8");
const sourceInspect = readFileSync("scripts/inspect-admin-source-workflow-rehearsal.mjs", "utf8");
const emailPrepare = readFileSync("scripts/prepare-admin-email-triage-rehearsal.mjs", "utf8");
const emailInspect = readFileSync("scripts/inspect-admin-email-triage-rehearsal.mjs", "utf8");

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

function writeSourceFactsPacket(path, overrides = {}) {
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        artifact_kind: "admin_source_facts_packet",
        status: "source_facts_packet_prepared",
        generated_at: "2026-06-25T00:00:00.000Z",
        gym_name: "Proof Gym",
        owner_email: "owner@example.com",
        source_label: "Reviewed website notes",
        preflight_path: "artifacts/admin-launch-readiness/source-preflight.json",
        preflight_sha256: "a".repeat(64),
        facts: [{ topic: "Hours", value: "Open weekdays 6am to 8pm", confidence: 0.86 }],
        public_self_serve_launch_allowed: false,
        source_runtime_write_allowed: false,
        automatic_answer_approval_allowed: false,
        task_generation_allowed: false,
        blocked_gates: [
          "public_owner_self_signup",
          "website_scraping",
          "google_profile_api_import",
          "automatic_answer_approval",
          "task_generation",
          "notification_sending",
          "phone_email_provider_activation",
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

function writeEmailSamplePacket(path, overrides = {}) {
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        artifact_kind: "admin_email_sample_packet",
        status: "email_sample_packet_prepared",
        generated_at: "2026-06-25T00:00:00.000Z",
        gym_name: "Proof Gym",
        owner_email: "owner@example.com",
        mailbox_label: "front-desk",
        preflight_path: "artifacts/admin-launch-readiness/email-preflight.json",
        preflight_sha256: "b".repeat(64),
        sample: {
          subject: "Freeze my account",
          sender_label: "member",
          body: "Can I freeze for July?",
          suggested_intent: "membership-freeze",
          suggested_next_step: "Review policy and create staff follow-up"
        },
        public_self_serve_launch_allowed: false,
        email_ingress_allowed: false,
        outbound_email_allowed: false,
        notification_sending_allowed: false,
        task_creation_allowed: false,
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

function writeSourceWorkflowRehearsal(path, overrides = {}) {
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        artifact_kind: "admin_source_workflow_rehearsal",
        status: "source_workflow_rehearsal_prepared",
        source_facts_packet_sha256: "c".repeat(64),
        manual_source_payload: {
          facts: [{ topic: "Hours", value: "Open weekdays", confidence: 0.8 }]
        },
        operator_steps: ["Open owner workspace", "Paste facts", "Stage review"],
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

function writeEmailTriageRehearsal(path, overrides = {}) {
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        artifact_kind: "admin_email_triage_rehearsal",
        status: "email_triage_rehearsal_prepared",
        email_sample_packet_sha256: "d".repeat(64),
        sample: {
          subject: "Freeze",
          sender_label: "member",
          body: "Can I freeze?",
          suggested_intent: "membership-freeze",
          suggested_next_step: "Review policy"
        },
        triage_category: "membership-freeze",
        owner_review_label: "Owner policy check",
        staff_task_draft: "Call member",
        operator_steps: ["Review sample", "Classify", "Keep inbox blocked"],
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

describe("admin operator rehearsal packets", () => {
  it("wires source workflow and email triage rehearsal commands into admin readiness", () => {
    expect(packageJson).toContain("admin:source-workflow:rehearsal");
    expect(packageJson).toContain("admin:source-workflow:inspect");
    expect(packageJson).toContain("admin:email-triage:rehearsal");
    expect(packageJson).toContain("admin:email-triage:inspect");
    expect(founderAdminDomain).toContain("npm run admin:source-workflow:rehearsal");
    expect(founderAdminDomain).toContain("npm run admin:email-triage:rehearsal");
    expect(sourcePrepare).toContain("source_runtime_write_allowed: false");
    expect(sourceInspect).toContain("Automatic answer approval must remain blocked");
    expect(emailPrepare).toContain("email_ingress_allowed: false");
    expect(emailInspect).toContain("Task creation must remain blocked");
  });

  it("prepares and inspects source workflow rehearsal without runtime writes", () => {
    const packetPath = artifactsPath("source-facts-rehearsal-parent-test.json");
    const rehearsalPath = artifactsPath("source-workflow-rehearsal-test.json");
    removeIfExists(rehearsalPath);
    writeSourceFactsPacket(packetPath);

    const prepare = run("scripts/prepare-admin-source-workflow-rehearsal.mjs", {
      OUTPOST_ADMIN_SOURCE_FACTS_PACKET_PATH: packetPath,
      OUTPOST_ADMIN_SOURCE_WORKFLOW_REHEARSAL_PATH: rehearsalPath,
      OUTPOST_ADMIN_SOURCE_WORKFLOW_LOCATION_LABEL: "Downtown front desk",
      OUTPOST_ADMIN_SOURCE_WORKFLOW_OWNER_REVIEWER: "Owner review"
    });
    expect(prepare.status).toBe(0);

    const inspect = run("scripts/inspect-admin-source-workflow-rehearsal.mjs", {
      OUTPOST_ADMIN_SOURCE_WORKFLOW_REHEARSAL_PATH: rehearsalPath
    });
    expect(inspect.status).toBe(0);

    const artifact = JSON.parse(readFileSync(rehearsalPath, "utf8"));
    expect(artifact.artifact_kind).toBe("admin_source_workflow_rehearsal");
    expect(artifact.source_runtime_write_allowed).toBe(false);
    expect(artifact.automatic_answer_approval_allowed).toBe(false);
    expect(artifact.task_generation_allowed).toBe(false);
    expect(artifact.manual_source_payload.facts).toHaveLength(1);
  });

  it("fails source workflow rehearsal when parent packet gates are tampered", () => {
    const packetPath = artifactsPath("source-facts-rehearsal-tampered-test.json");
    const rehearsalPath = artifactsPath("source-workflow-rehearsal-tampered-test.json");
    removeIfExists(rehearsalPath);
    writeSourceFactsPacket(packetPath, { blocked_gates: ["public_owner_self_signup"] });

    const result = run("scripts/prepare-admin-source-workflow-rehearsal.mjs", {
      OUTPOST_ADMIN_SOURCE_FACTS_PACKET_PATH: packetPath,
      OUTPOST_ADMIN_SOURCE_WORKFLOW_REHEARSAL_PATH: rehearsalPath,
      OUTPOST_ADMIN_SOURCE_WORKFLOW_LOCATION_LABEL: "Downtown front desk",
      OUTPOST_ADMIN_SOURCE_WORKFLOW_OWNER_REVIEWER: "Owner review"
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("Source facts packet must block website_scraping");
  });

  it("fails source workflow rehearsal on tampered booleans, path escape, missing input, secrets, and overwrite", () => {
    const packetPath = artifactsPath("source-facts-rehearsal-guards-test.json");
    const rehearsalPath = artifactsPath("source-workflow-rehearsal-guards-test.json");
    removeIfExists(rehearsalPath);

    writeSourceFactsPacket(packetPath, { source_runtime_write_allowed: true });
    const tamperedBoolean = run("scripts/prepare-admin-source-workflow-rehearsal.mjs", {
      OUTPOST_ADMIN_SOURCE_FACTS_PACKET_PATH: packetPath,
      OUTPOST_ADMIN_SOURCE_WORKFLOW_REHEARSAL_PATH: rehearsalPath,
      OUTPOST_ADMIN_SOURCE_WORKFLOW_LOCATION_LABEL: "Downtown front desk",
      OUTPOST_ADMIN_SOURCE_WORKFLOW_OWNER_REVIEWER: "Owner review"
    });
    expect(tamperedBoolean.status).not.toBe(0);
    expect(`${tamperedBoolean.stdout}${tamperedBoolean.stderr}`).toContain("Source packet must keep runtime writes blocked");

    writeSourceFactsPacket(packetPath);
    const pathEscape = run("scripts/prepare-admin-source-workflow-rehearsal.mjs", {
      OUTPOST_ADMIN_SOURCE_FACTS_PACKET_PATH: packetPath,
      OUTPOST_ADMIN_SOURCE_WORKFLOW_REHEARSAL_PATH: "../source-workflow-escape.json",
      OUTPOST_ADMIN_SOURCE_WORKFLOW_LOCATION_LABEL: "Downtown front desk",
      OUTPOST_ADMIN_SOURCE_WORKFLOW_OWNER_REVIEWER: "Owner review"
    });
    expect(pathEscape.status).not.toBe(0);
    expect(`${pathEscape.stdout}${pathEscape.stderr}`).toContain("must live under artifacts");

    const missingInput = run("scripts/prepare-admin-source-workflow-rehearsal.mjs", {
      OUTPOST_ADMIN_SOURCE_FACTS_PACKET_PATH: packetPath,
      OUTPOST_ADMIN_SOURCE_WORKFLOW_REHEARSAL_PATH: rehearsalPath,
      OUTPOST_ADMIN_SOURCE_WORKFLOW_OWNER_REVIEWER: "Owner review"
    });
    expect(missingInput.status).not.toBe(0);
    expect(`${missingInput.stdout}${missingInput.stderr}`).toContain("OUTPOST_ADMIN_SOURCE_WORKFLOW_LOCATION_LABEL required");

    const secretInput = run("scripts/prepare-admin-source-workflow-rehearsal.mjs", {
      OUTPOST_ADMIN_SOURCE_FACTS_PACKET_PATH: packetPath,
      OUTPOST_ADMIN_SOURCE_WORKFLOW_REHEARSAL_PATH: rehearsalPath,
      OUTPOST_ADMIN_SOURCE_WORKFLOW_LOCATION_LABEL: "api_key=abc12345678901234567890",
      OUTPOST_ADMIN_SOURCE_WORKFLOW_OWNER_REVIEWER: "Owner review"
    });
    expect(secretInput.status).not.toBe(0);
    expect(`${secretInput.stdout}${secretInput.stderr}`).toContain("contains secret-shaped value");

    const firstWrite = run("scripts/prepare-admin-source-workflow-rehearsal.mjs", {
      OUTPOST_ADMIN_SOURCE_FACTS_PACKET_PATH: packetPath,
      OUTPOST_ADMIN_SOURCE_WORKFLOW_REHEARSAL_PATH: rehearsalPath,
      OUTPOST_ADMIN_SOURCE_WORKFLOW_LOCATION_LABEL: "Downtown front desk",
      OUTPOST_ADMIN_SOURCE_WORKFLOW_OWNER_REVIEWER: "Owner review"
    });
    expect(firstWrite.status).toBe(0);
    const overwrite = run("scripts/prepare-admin-source-workflow-rehearsal.mjs", {
      OUTPOST_ADMIN_SOURCE_FACTS_PACKET_PATH: packetPath,
      OUTPOST_ADMIN_SOURCE_WORKFLOW_REHEARSAL_PATH: rehearsalPath,
      OUTPOST_ADMIN_SOURCE_WORKFLOW_LOCATION_LABEL: "Downtown front desk",
      OUTPOST_ADMIN_SOURCE_WORKFLOW_OWNER_REVIEWER: "Owner review"
    });
    expect(overwrite.status).not.toBe(0);
    expect(`${overwrite.stdout}${overwrite.stderr}`).toContain("already exists");
  });

  it("fails source workflow inspection for forged artifacts and path escape", () => {
    const rehearsalPath = artifactsPath("source-workflow-inspect-forged-test.json");
    writeSourceWorkflowRehearsal(rehearsalPath, { automatic_answer_approval_allowed: true });

    const forgedBoolean = run("scripts/inspect-admin-source-workflow-rehearsal.mjs", {
      OUTPOST_ADMIN_SOURCE_WORKFLOW_REHEARSAL_PATH: rehearsalPath
    });
    expect(forgedBoolean.status).not.toBe(0);
    expect(`${forgedBoolean.stdout}${forgedBoolean.stderr}`).toContain("Automatic answer approval must remain blocked");

    writeSourceWorkflowRehearsal(rehearsalPath, { blocked_gates: ["public_owner_self_signup"] });
    const forgedGates = run("scripts/inspect-admin-source-workflow-rehearsal.mjs", {
      OUTPOST_ADMIN_SOURCE_WORKFLOW_REHEARSAL_PATH: rehearsalPath
    });
    expect(forgedGates.status).not.toBe(0);
    expect(`${forgedGates.stdout}${forgedGates.stderr}`).toContain("website_scraping gate must be blocked");

    const pathEscape = run("scripts/inspect-admin-source-workflow-rehearsal.mjs", {
      OUTPOST_ADMIN_SOURCE_WORKFLOW_REHEARSAL_PATH: "../source-workflow-forged.json"
    });
    expect(pathEscape.status).not.toBe(0);
    expect(`${pathEscape.stdout}${pathEscape.stderr}`).toContain("must live under artifacts");
  });

  it("prepares and inspects email triage rehearsal without connecting inboxes", () => {
    const packetPath = artifactsPath("email-sample-rehearsal-parent-test.json");
    const rehearsalPath = artifactsPath("email-triage-rehearsal-test.json");
    removeIfExists(rehearsalPath);
    writeEmailSamplePacket(packetPath);

    const prepare = run("scripts/prepare-admin-email-triage-rehearsal.mjs", {
      OUTPOST_ADMIN_EMAIL_SAMPLE_PACKET_PATH: packetPath,
      OUTPOST_ADMIN_EMAIL_TRIAGE_REHEARSAL_PATH: rehearsalPath,
      OUTPOST_ADMIN_EMAIL_TRIAGE_CATEGORY: "membership-freeze",
      OUTPOST_ADMIN_EMAIL_TRIAGE_OWNER_REVIEW_LABEL: "Owner policy check",
      OUTPOST_ADMIN_EMAIL_TRIAGE_STAFF_TASK_DRAFT: "Call member to confirm freeze policy"
    });
    expect(prepare.status).toBe(0);

    const inspect = run("scripts/inspect-admin-email-triage-rehearsal.mjs", {
      OUTPOST_ADMIN_EMAIL_TRIAGE_REHEARSAL_PATH: rehearsalPath
    });
    expect(inspect.status).toBe(0);

    const artifact = JSON.parse(readFileSync(rehearsalPath, "utf8"));
    expect(artifact.artifact_kind).toBe("admin_email_triage_rehearsal");
    expect(artifact.email_ingress_allowed).toBe(false);
    expect(artifact.outbound_email_allowed).toBe(false);
    expect(artifact.notification_sending_allowed).toBe(false);
    expect(artifact.task_creation_allowed).toBe(false);
  });

  it("fails email triage rehearsal when parent packet gates are tampered", () => {
    const packetPath = artifactsPath("email-sample-rehearsal-tampered-test.json");
    const rehearsalPath = artifactsPath("email-triage-rehearsal-tampered-test.json");
    removeIfExists(rehearsalPath);
    writeEmailSamplePacket(packetPath, { blocked_gates: ["public_owner_self_signup", "gmail_connection"] });

    const result = run("scripts/prepare-admin-email-triage-rehearsal.mjs", {
      OUTPOST_ADMIN_EMAIL_SAMPLE_PACKET_PATH: packetPath,
      OUTPOST_ADMIN_EMAIL_TRIAGE_REHEARSAL_PATH: rehearsalPath,
      OUTPOST_ADMIN_EMAIL_TRIAGE_CATEGORY: "membership-freeze",
      OUTPOST_ADMIN_EMAIL_TRIAGE_OWNER_REVIEW_LABEL: "Owner policy check",
      OUTPOST_ADMIN_EMAIL_TRIAGE_STAFF_TASK_DRAFT: "Call member to confirm freeze policy"
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("Email sample packet must block resend_connection");
  });

  it("fails email triage rehearsal on tampered booleans, path escape, missing input, secrets, and overwrite", () => {
    const packetPath = artifactsPath("email-sample-rehearsal-guards-test.json");
    const rehearsalPath = artifactsPath("email-triage-rehearsal-guards-test.json");
    removeIfExists(rehearsalPath);

    writeEmailSamplePacket(packetPath, { email_ingress_allowed: true });
    const tamperedBoolean = run("scripts/prepare-admin-email-triage-rehearsal.mjs", {
      OUTPOST_ADMIN_EMAIL_SAMPLE_PACKET_PATH: packetPath,
      OUTPOST_ADMIN_EMAIL_TRIAGE_REHEARSAL_PATH: rehearsalPath,
      OUTPOST_ADMIN_EMAIL_TRIAGE_CATEGORY: "membership-freeze",
      OUTPOST_ADMIN_EMAIL_TRIAGE_OWNER_REVIEW_LABEL: "Owner policy check",
      OUTPOST_ADMIN_EMAIL_TRIAGE_STAFF_TASK_DRAFT: "Call member to confirm freeze policy"
    });
    expect(tamperedBoolean.status).not.toBe(0);
    expect(`${tamperedBoolean.stdout}${tamperedBoolean.stderr}`).toContain("Email packet must keep email ingress blocked");

    writeEmailSamplePacket(packetPath);
    const pathEscape = run("scripts/prepare-admin-email-triage-rehearsal.mjs", {
      OUTPOST_ADMIN_EMAIL_SAMPLE_PACKET_PATH: packetPath,
      OUTPOST_ADMIN_EMAIL_TRIAGE_REHEARSAL_PATH: "../email-triage-escape.json",
      OUTPOST_ADMIN_EMAIL_TRIAGE_CATEGORY: "membership-freeze",
      OUTPOST_ADMIN_EMAIL_TRIAGE_OWNER_REVIEW_LABEL: "Owner policy check",
      OUTPOST_ADMIN_EMAIL_TRIAGE_STAFF_TASK_DRAFT: "Call member to confirm freeze policy"
    });
    expect(pathEscape.status).not.toBe(0);
    expect(`${pathEscape.stdout}${pathEscape.stderr}`).toContain("must live under artifacts");

    const missingInput = run("scripts/prepare-admin-email-triage-rehearsal.mjs", {
      OUTPOST_ADMIN_EMAIL_SAMPLE_PACKET_PATH: packetPath,
      OUTPOST_ADMIN_EMAIL_TRIAGE_REHEARSAL_PATH: rehearsalPath,
      OUTPOST_ADMIN_EMAIL_TRIAGE_CATEGORY: "membership-freeze",
      OUTPOST_ADMIN_EMAIL_TRIAGE_STAFF_TASK_DRAFT: "Call member to confirm freeze policy"
    });
    expect(missingInput.status).not.toBe(0);
    expect(`${missingInput.stdout}${missingInput.stderr}`).toContain("OUTPOST_ADMIN_EMAIL_TRIAGE_OWNER_REVIEW_LABEL required");

    const secretInput = run("scripts/prepare-admin-email-triage-rehearsal.mjs", {
      OUTPOST_ADMIN_EMAIL_SAMPLE_PACKET_PATH: packetPath,
      OUTPOST_ADMIN_EMAIL_TRIAGE_REHEARSAL_PATH: rehearsalPath,
      OUTPOST_ADMIN_EMAIL_TRIAGE_CATEGORY: "membership-freeze",
      OUTPOST_ADMIN_EMAIL_TRIAGE_OWNER_REVIEW_LABEL: "Owner policy check",
      OUTPOST_ADMIN_EMAIL_TRIAGE_STAFF_TASK_DRAFT: "Bearer abcdefghijklmnopqrstuvwxyz"
    });
    expect(secretInput.status).not.toBe(0);
    expect(`${secretInput.stdout}${secretInput.stderr}`).toContain("contains secret-shaped value");

    const firstWrite = run("scripts/prepare-admin-email-triage-rehearsal.mjs", {
      OUTPOST_ADMIN_EMAIL_SAMPLE_PACKET_PATH: packetPath,
      OUTPOST_ADMIN_EMAIL_TRIAGE_REHEARSAL_PATH: rehearsalPath,
      OUTPOST_ADMIN_EMAIL_TRIAGE_CATEGORY: "membership-freeze",
      OUTPOST_ADMIN_EMAIL_TRIAGE_OWNER_REVIEW_LABEL: "Owner policy check",
      OUTPOST_ADMIN_EMAIL_TRIAGE_STAFF_TASK_DRAFT: "Call member to confirm freeze policy"
    });
    expect(firstWrite.status).toBe(0);
    const overwrite = run("scripts/prepare-admin-email-triage-rehearsal.mjs", {
      OUTPOST_ADMIN_EMAIL_SAMPLE_PACKET_PATH: packetPath,
      OUTPOST_ADMIN_EMAIL_TRIAGE_REHEARSAL_PATH: rehearsalPath,
      OUTPOST_ADMIN_EMAIL_TRIAGE_CATEGORY: "membership-freeze",
      OUTPOST_ADMIN_EMAIL_TRIAGE_OWNER_REVIEW_LABEL: "Owner policy check",
      OUTPOST_ADMIN_EMAIL_TRIAGE_STAFF_TASK_DRAFT: "Call member to confirm freeze policy"
    });
    expect(overwrite.status).not.toBe(0);
    expect(`${overwrite.stdout}${overwrite.stderr}`).toContain("already exists");
  });

  it("fails email triage inspection for forged artifacts and path escape", () => {
    const rehearsalPath = artifactsPath("email-triage-inspect-forged-test.json");
    writeEmailTriageRehearsal(rehearsalPath, { email_ingress_allowed: true });

    const forgedBoolean = run("scripts/inspect-admin-email-triage-rehearsal.mjs", {
      OUTPOST_ADMIN_EMAIL_TRIAGE_REHEARSAL_PATH: rehearsalPath
    });
    expect(forgedBoolean.status).not.toBe(0);
    expect(`${forgedBoolean.stdout}${forgedBoolean.stderr}`).toContain("Email ingress must remain blocked");

    writeEmailTriageRehearsal(rehearsalPath, { blocked_gates: ["public_owner_self_signup"] });
    const forgedGates = run("scripts/inspect-admin-email-triage-rehearsal.mjs", {
      OUTPOST_ADMIN_EMAIL_TRIAGE_REHEARSAL_PATH: rehearsalPath
    });
    expect(forgedGates.status).not.toBe(0);
    expect(`${forgedGates.stdout}${forgedGates.stderr}`).toContain("gmail_connection gate must be blocked");

    const pathEscape = run("scripts/inspect-admin-email-triage-rehearsal.mjs", {
      OUTPOST_ADMIN_EMAIL_TRIAGE_REHEARSAL_PATH: "../email-triage-forged.json"
    });
    expect(pathEscape.status).not.toBe(0);
    expect(`${pathEscape.stdout}${pathEscape.stderr}`).toContain("must live under artifacts");
  });
});
