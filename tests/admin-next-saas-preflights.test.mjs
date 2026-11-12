import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const packageJson = readFileSync("package.json", "utf8");
const sourcePreflightScript = readFileSync(
  "scripts/prepare-admin-source-import-preflight.mjs",
  "utf8",
);
const sourceInspectScript = readFileSync(
  "scripts/inspect-admin-source-import-preflight.mjs",
  "utf8",
);
const emailPreflightScript = readFileSync(
  "scripts/prepare-admin-email-channel-preflight.mjs",
  "utf8",
);
const emailInspectScript = readFileSync(
  "scripts/inspect-admin-email-channel-preflight.mjs",
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

function runInspector(script, artifactPath, envName) {
  return spawnSync("node", [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      [envName]: artifactPath,
    },
  });
}

describe("admin next SaaS preflights", () => {
  it("adds source import preflight scripts without enabling live import", () => {
    expect(packageJson).toContain("admin:source-import:preflight");
    expect(packageJson).toContain("admin:source-import:inspect");
    expect(sourcePreflightScript).toContain("admin_source_import_preflight");
    expect(sourcePreflightScript).toContain(
      "public_self_serve_launch_allowed: false",
    );
    expect(sourcePreflightScript).toContain("source_import_allowed: false");
    expect(sourcePreflightScript).toContain("public_scraping_allowed: false");
    expect(sourcePreflightScript).toContain("google_profile_api_import");
    expect(sourcePreflightScript).toContain("automatic_answer_approval");
    expect(sourcePreflightScript).toContain("public_owner_self_signup");
    expect(sourceInspectScript).toContain(
      "Public self-serve must remain blocked",
    );
    expect(sourceInspectScript).toContain(
      "Public owner self-signup gate must be blocked",
    );
    expect(sourceInspectScript).toContain("Source import must remain blocked");
    expect(sourceInspectScript).toContain(
      "Website scraping gate must be blocked",
    );
    expect(sourceInspectScript).toContain(
      "Automatic answer approval gate must be blocked",
    );
    expect(sourceInspectScript).toContain(
      "Task generation gate must be blocked",
    );
    expect(sourceInspectScript).toContain(
      "Notification sending gate must be blocked",
    );
    expect(sourceInspectScript).toContain("Billing gate must be blocked");
    expect(sourceInspectScript).not.toContain("service_role");
    expect(sourcePreflightScript).not.toContain("SUPABASE_SERVICE_ROLE");
  });

  it("adds email channel preflight scripts without connecting providers", () => {
    expect(packageJson).toContain("admin:email-channel:preflight");
    expect(packageJson).toContain("admin:email-channel:inspect");
    expect(emailPreflightScript).toContain("admin_email_channel_preflight");
    expect(emailPreflightScript).toContain(
      "public_self_serve_launch_allowed: false",
    );
    expect(emailPreflightScript).toContain("email_ingress_allowed: false");
    expect(emailPreflightScript).toContain("outbound_email_allowed: false");
    expect(emailPreflightScript).toContain(
      "notification_sending_allowed: false",
    );
    expect(emailPreflightScript).toContain("gmail_connection");
    expect(emailPreflightScript).toContain("public_owner_self_signup");
    expect(emailPreflightScript).toContain("resend_connection");
    expect(emailInspectScript).toContain(
      "Public self-serve must remain blocked",
    );
    expect(emailInspectScript).toContain(
      "Public owner self-signup gate must be blocked",
    );
    expect(emailInspectScript).toContain("Email ingress must remain blocked");
    expect(emailInspectScript).toContain(
      "Outbound delivery gate must be blocked",
    );
    expect(emailInspectScript).toContain(
      "SMTP connection gate must be blocked",
    );
    expect(emailInspectScript).toContain(
      "Provider webhook gate must be blocked",
    );
    expect(emailInspectScript).toContain(
      "Notification sending gate must be blocked",
    );
    expect(emailInspectScript).toContain("Billing gate must be blocked");
    expect(emailInspectScript).not.toContain("service_role");
    expect(emailPreflightScript).not.toContain("SUPABASE_SERVICE_ROLE");
  });

  it("fails inspection when source import blocked gates are tampered", () => {
    const artifactDir = join(process.cwd(), "artifacts/admin-launch-readiness");
    mkdirSync(artifactDir, { recursive: true });
    const artifactPath = join(
      artifactDir,
      "tampered-source-preflight-test.json",
    );
    writeFileSync(
      artifactPath,
      `${JSON.stringify({
        artifact_kind: "admin_source_import_preflight",
        status: "source_import_preflight_prepared",
        public_self_serve_launch_allowed: false,
        source_import_allowed: false,
        public_scraping_allowed: false,
        live_provider_enablement_allowed: false,
        candidate_sources: {
          website_url: "https://example.com",
          google_profile_url: null,
        },
        blocked_gates: [
          "website_scraping",
          "public_owner_self_signup",
          "google_profile_api_import",
          "phone_email_provider_activation",
          "pos_access_control_member_ledger_writes",
        ],
      })}\n`,
    );
    const result = runInspector(
      "scripts/inspect-admin-source-import-preflight.mjs",
      artifactPath,
      "OUTPOST_ADMIN_SOURCE_IMPORT_PREFLIGHT_PATH",
    );
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "Automatic answer approval gate must be blocked",
    );
  });

  it("fails inspection when email channel blocked gates are tampered", () => {
    const artifactDir = join(process.cwd(), "artifacts/admin-launch-readiness");
    mkdirSync(artifactDir, { recursive: true });
    const artifactPath = join(
      artifactDir,
      "tampered-email-preflight-test.json",
    );
    writeFileSync(
      artifactPath,
      `${JSON.stringify({
        artifact_kind: "admin_email_channel_preflight",
        status: "email_channel_preflight_prepared",
        public_self_serve_launch_allowed: false,
        email_ingress_allowed: false,
        outbound_email_allowed: false,
        notification_sending_allowed: false,
        live_provider_enablement_allowed: false,
        mailbox_label: "front-desk",
        blocked_gates: [
          "gmail_connection",
          "public_owner_self_signup",
          "resend_connection",
          "email_ingress",
          "outbound_email_delivery",
          "pos_access_control_member_ledger_writes",
        ],
      })}\n`,
    );
    const result = runInspector(
      "scripts/inspect-admin-email-channel-preflight.mjs",
      artifactPath,
      "OUTPOST_ADMIN_EMAIL_CHANNEL_PREFLIGHT_PATH",
    );
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain(
      "SMTP connection gate must be blocked",
    );
  });

  it("surfaces the preflights in the admin portal as read-only commands", () => {
    expect(founderAdminDomain).toContain("founderAdminNextSaasPreflights");
    expect(founderAdminDomain).toContain(
      "OUTPOST_ADMIN_SOURCE_IMPORT_PREFLIGHT_PATH",
    );
    expect(founderAdminDomain).toContain(
      "OUTPOST_ADMIN_EMAIL_CHANNEL_PREFLIGHT_PATH",
    );
    expect(founderAdminDomain).toContain(
      "No live-provider or billing promotion is approved",
    );
    expect(founderAdminComponent).toContain("Next SaaS preflights");
    expect(founderAdminComponent).toContain("source ingestion.");
    expect(founderAdminComponent).toContain("email, or notifications.");
  });
});
