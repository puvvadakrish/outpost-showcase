import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const sourcePrepare = readFileSync(
  "scripts/prepare-admin-source-facts-packet.mjs",
  "utf8",
);
const sourceInspect = readFileSync(
  "scripts/inspect-admin-source-facts-packet.mjs",
  "utf8",
);
const emailPrepare = readFileSync(
  "scripts/prepare-admin-email-sample-packet.mjs",
  "utf8",
);
const emailInspect = readFileSync(
  "scripts/inspect-admin-email-sample-packet.mjs",
  "utf8",
);
const founderAdminDomain = readFileSync(
  "src/domain/founder-admin-readiness.ts",
  "utf8",
);
const founderAdminComponent = readFileSync(
  "src/components/founder-admin/FounderAdminReadinessConsole.tsx",
  "utf8",
);

function run(script, env) {
  return spawnSync("node", [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function artifactsPath(name) {
  const dir = join(process.cwd(), "artifacts/admin-launch-readiness");
  mkdirSync(dir, { recursive: true });
  return join(dir, name);
}

describe("admin operator-assisted intake packets", () => {
  it("wires source facts packet scripts without runtime source writes", () => {
    expect(packageJson).toContain("admin:source-facts:packet");
    expect(packageJson).toContain("admin:source-facts:inspect");
    expect(sourcePrepare).toContain("admin_source_facts_packet");
    expect(sourcePrepare).toContain("source_runtime_write_allowed: false");
    expect(sourcePrepare).toContain("automatic_answer_approval_allowed: false");
    expect(sourcePrepare).toContain("task_generation_allowed: false");
    expect(sourceInspect).toContain("Source runtime write must remain blocked");
    expect(sourceInspect).toContain("automatic_answer_approval");
    expect(sourceInspect).toContain("pos_access_control_member_ledger_writes");
    expect(founderAdminDomain).toContain("npm run admin:source-facts:packet");
    expect(founderAdminComponent).toContain("source ingestion.");
  });

  it("wires email sample packet scripts without inbox or outbound writes", () => {
    expect(packageJson).toContain("admin:email-sample:packet");
    expect(packageJson).toContain("admin:email-sample:inspect");
    expect(emailPrepare).toContain("admin_email_sample_packet");
    expect(emailPrepare).toContain("email_ingress_allowed: false");
    expect(emailPrepare).toContain("outbound_email_allowed: false");
    expect(emailPrepare).toContain("notification_sending_allowed: false");
    expect(emailPrepare).toContain("task_creation_allowed: false");
    expect(emailInspect).toContain("Email ingress must remain blocked");
    expect(emailInspect).toContain("Task creation must remain blocked");
    expect(emailInspect).toContain("provider_webhooks");
    expect(founderAdminDomain).toContain("npm run admin:email-sample:packet");
    expect(founderAdminComponent).toContain("email, or notifications.");
  });

  it("fails source facts inspection when runtime write gates are tampered", () => {
    const packetPath = artifactsPath("tampered-source-facts-packet-test.json");
    writeFileSync(
      packetPath,
      `${JSON.stringify({
        artifact_kind: "admin_source_facts_packet",
        status: "source_facts_packet_prepared",
        preflight_sha256: "a".repeat(64),
        facts: [{ topic: "Hours", value: "Open weekdays", confidence: 0.8 }],
        public_self_serve_launch_allowed: false,
        source_runtime_write_allowed: false,
        automatic_answer_approval_allowed: false,
        task_generation_allowed: false,
        blocked_gates: [
          "public_owner_self_signup",
          "website_scraping",
          "google_profile_api_import",
        ],
      })}\n`,
    );
    const result = run("scripts/inspect-admin-source-facts-packet.mjs", {
      OUTPOST_ADMIN_SOURCE_FACTS_PACKET_PATH: packetPath,
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "automatic_answer_approval gate must be blocked",
    );
  });

  it("fails source facts packet prep when parent preflight gates are tampered", () => {
    const preflightPath = artifactsPath(
      "tampered-source-parent-preflight-test.json",
    );
    const packetPath = artifactsPath("tampered-source-parent-output-test.json");
    writeFileSync(
      preflightPath,
      `${JSON.stringify({
        artifact_kind: "admin_source_import_preflight",
        status: "source_import_preflight_prepared",
        gym_name: "Proof Gym",
        owner_email: "owner@example.com",
        public_self_serve_launch_allowed: false,
        source_import_allowed: false,
        public_scraping_allowed: false,
        live_provider_enablement_allowed: false,
        blocked_gates: ["public_owner_self_signup", "website_scraping"],
      })}\n`,
    );
    const result = run("scripts/prepare-admin-source-facts-packet.mjs", {
      OUTPOST_ADMIN_SOURCE_IMPORT_PREFLIGHT_PATH: preflightPath,
      OUTPOST_ADMIN_SOURCE_FACTS_PACKET_PATH: packetPath,
      OUTPOST_ADMIN_SOURCE_FACTS_LABEL: "Reviewed facts",
      OUTPOST_ADMIN_SOURCE_FACTS_JSON:
        '[{"topic":"Hours","value":"Open weekdays","confidence":0.8}]',
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "Source import preflight must block google_profile_api_import",
    );
  });

  it("fails email sample inspection when provider gates are tampered", () => {
    const packetPath = artifactsPath("tampered-email-sample-packet-test.json");
    writeFileSync(
      packetPath,
      `${JSON.stringify({
        artifact_kind: "admin_email_sample_packet",
        status: "email_sample_packet_prepared",
        preflight_sha256: "b".repeat(64),
        sample: {
          subject: "Freeze question",
          sender_label: "member",
          body: "Can I freeze next month?",
          suggested_intent: "membership-freeze",
          suggested_next_step: "Create staff review task",
        },
        public_self_serve_launch_allowed: false,
        email_ingress_allowed: false,
        outbound_email_allowed: false,
        notification_sending_allowed: false,
        task_creation_allowed: false,
        blocked_gates: [
          "public_owner_self_signup",
          "gmail_connection",
          "email_ingress",
        ],
      })}\n`,
    );
    const result = run("scripts/inspect-admin-email-sample-packet.mjs", {
      OUTPOST_ADMIN_EMAIL_SAMPLE_PACKET_PATH: packetPath,
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "resend_connection gate must be blocked",
    );
  });

  it("fails email sample packet prep when parent preflight gates are tampered", () => {
    const preflightPath = artifactsPath(
      "tampered-email-parent-preflight-test.json",
    );
    const packetPath = artifactsPath("tampered-email-parent-output-test.json");
    writeFileSync(
      preflightPath,
      `${JSON.stringify({
        artifact_kind: "admin_email_channel_preflight",
        status: "email_channel_preflight_prepared",
        gym_name: "Proof Gym",
        owner_email: "owner@example.com",
        mailbox_label: "front-desk",
        public_self_serve_launch_allowed: false,
        email_ingress_allowed: false,
        outbound_email_allowed: false,
        notification_sending_allowed: false,
        live_provider_enablement_allowed: false,
        blocked_gates: ["public_owner_self_signup", "gmail_connection"],
      })}\n`,
    );
    const result = run("scripts/prepare-admin-email-sample-packet.mjs", {
      OUTPOST_ADMIN_EMAIL_CHANNEL_PREFLIGHT_PATH: preflightPath,
      OUTPOST_ADMIN_EMAIL_SAMPLE_PACKET_PATH: packetPath,
      OUTPOST_ADMIN_EMAIL_SAMPLE_SUBJECT: "Freeze question",
      OUTPOST_ADMIN_EMAIL_SAMPLE_SENDER_LABEL: "member",
      OUTPOST_ADMIN_EMAIL_SAMPLE_BODY: "Can I freeze next month?",
      OUTPOST_ADMIN_EMAIL_SAMPLE_INTENT: "membership-freeze",
      OUTPOST_ADMIN_EMAIL_SAMPLE_NEXT_STEP: "Create manual review task",
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "Email channel preflight must block resend_connection",
    );
  });
});
