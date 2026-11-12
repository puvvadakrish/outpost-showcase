#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_SESSION_RECORD_PATH =
  "artifacts/admin-launch-readiness/admin-customer-observed-session-record.json";
const DEFAULT_RUNWAY_PATH =
  "artifacts/admin-launch-readiness/admin-demo-onboarding-runway.json";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNoSecretShapedValue(value, label) {
  const text = String(value);
  const secretValue =
    /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/u.test(text) ||
    /\bpostgres(?:ql)?:\/\/[^:\s/@]+:[^@\s]+@/iu.test(text) ||
    /\bnapi_[A-Za-z0-9]{20,}\b/u.test(text) ||
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?\b/u.test(
      text,
    ) ||
    text.includes("__Secure-neon-auth") ||
    text.includes("outpost_neon_auth_session") ||
    /(?:password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)["']?\s*[:=]/iu.test(
      text,
    );
  invariant(!secretValue, `${label} contains secret-shaped value.`);
}

function assertNoSecretShapedKeys(value, label) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      assertNoSecretShapedKeys(entry, `${label}[${index}]`),
    );
    return;
  }

  if (!value || typeof value !== "object") return;

  for (const [key, entry] of Object.entries(value)) {
    invariant(
      !/(password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)/iu.test(
        key,
      ),
      `${label} contains secret-shaped key ${key}.`,
    );
    assertNoSecretShapedKeys(entry, `${label}.${key}`);
  }
}

function normalizeArtifactPath(rawPath, label, { mustExist }) {
  const value = String(rawPath ?? "").trim();
  invariant(value, `${label} required.`);
  assertNoSecretShapedValue(value, label);
  invariant(!isAbsolute(value), `${label} must be relative.`);
  invariant(value.endsWith(".json"), `${label} must end with .json.`);

  const root = resolve(process.cwd(), "artifacts");
  const resolved = resolve(process.cwd(), value);
  const fromRoot = relative(root, resolved);
  invariant(
    fromRoot && !fromRoot.startsWith("..") && !isAbsolute(fromRoot),
    `${label} must stay inside artifacts/.`,
  );
  invariant(
    value === relative(process.cwd(), resolved).split(sep).join("/"),
    `${label} must be normalized relative path.`,
  );
  if (mustExist) invariant(existsSync(resolved), `${label} not found.`);

  return { relativePath: value, resolved };
}

function runCommand(command, label, env = {}) {
  const result = spawnSync(command[0], command.slice(1), {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  assertNoSecretShapedValue(output, label);
  if (result.status !== 0) throw new Error(`${label} failed.\n${output}`);
  return result.stdout;
}

function readJsonArtifact(path, label) {
  const raw = readFileSync(path, "utf8");
  assertNoSecretShapedValue(raw, label);
  const artifact = JSON.parse(raw);
  assertNoSecretShapedKeys(artifact, label);
  return {
    artifact,
    sha256: createHash("sha256").update(raw).digest("hex"),
  };
}

function assertFalse(artifact, key, message) {
  invariant(artifact[key] === false, message);
}

function assertCustomerSessionRecord(record) {
  invariant(
    record.artifact_kind === "admin_customer_observed_session_record",
    "Customer session record kind mismatch.",
  );
  invariant(
    record.status === "admin_customer_observed_session_recorded",
    "Customer session record status mismatch.",
  );
  invariant(
    record.customer_observed_session_recorded === true,
    "Customer session must be recorded.",
  );
  invariant(
    record.customer_observed_handoff_claimed === true,
    "Customer-observed handoff claim must be explicit.",
  );
  invariant(record.gym_name, "Gym name required.");
  invariant(record.owner_email, "Owner email required.");
  invariant(record.operator_label, "Operator label required.");
  invariant(
    /^[a-f0-9]{64}$/u.test(
      String(record.handoff_scheduling_packet_sha256 ?? ""),
    ),
    "Scheduling packet SHA256 missing.",
  );
  assertFalse(
    record,
    "public_self_serve_launch_allowed",
    "Public self-serve must remain blocked.",
  );
  assertFalse(
    record,
    "invite_delivery_allowed",
    "Invite delivery must remain blocked.",
  );
  assertFalse(
    record,
    "source_import_automation_allowed",
    "Source automation must remain blocked.",
  );
  assertFalse(
    record,
    "automatic_answer_approval_allowed",
    "Automatic answer approval must remain blocked.",
  );
  assertFalse(
    record,
    "automatic_task_generation_allowed",
    "Automatic task generation must remain blocked.",
  );
  assertFalse(
    record,
    "email_ingress_allowed",
    "Email ingress must be blocked.",
  );
  assertFalse(
    record,
    "outbound_email_allowed",
    "Outbound email must be blocked.",
  );
  assertFalse(
    record,
    "notification_sending_allowed",
    "Notifications must be blocked.",
  );
  assertFalse(
    record,
    "live_provider_enablement_allowed",
    "Live providers must remain blocked.",
  );
  assertFalse(
    record,
    "billing_pos_member_writes_allowed",
    "Billing/POS/member writes must remain blocked.",
  );
}

function main() {
  const sessionRecordPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH ??
      DEFAULT_SESSION_RECORD_PATH,
    "OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH",
    { mustExist: true },
  );
  const runwayPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_DEMO_ONBOARDING_RUNWAY_PATH ??
      DEFAULT_RUNWAY_PATH,
    "OUTPOST_ADMIN_DEMO_ONBOARDING_RUNWAY_PATH",
    { mustExist: false },
  );
  invariant(
    !existsSync(runwayPath.resolved),
    "OUTPOST_ADMIN_DEMO_ONBOARDING_RUNWAY_PATH already exists.",
  );

  runCommand(
    ["node", "scripts/inspect-admin-customer-observed-session.mjs"],
    "Admin customer session record inspection",
    {
      OUTPOST_ADMIN_CUSTOMER_SESSION_RECORD_PATH:
        sessionRecordPath.relativePath,
    },
  );

  const { artifact: sessionRecord, sha256: sessionRecordSha256 } =
    readJsonArtifact(
      sessionRecordPath.resolved,
      "admin customer-observed session record",
    );
  assertCustomerSessionRecord(sessionRecord);

  const runway = {
    artifact_kind: "admin_demo_onboarding_runway",
    status: "admin_demo_onboarding_runway_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_customer_observed_session_record",
    customer_session_record_path: sessionRecordPath.relativePath,
    customer_session_record_sha256: sessionRecordSha256,
    handoff_scheduling_packet_sha256:
      sessionRecord.handoff_scheduling_packet_sha256,
    gym_name: sessionRecord.gym_name,
    owner_email: sessionRecord.owner_email,
    owner_label: sessionRecord.owner_label ?? "",
    operator_label: sessionRecord.operator_label,
    operator_led_demo_ready: true,
    customer_observed_session_recorded: true,
    customer_observed_handoff_claimed: true,
    public_self_serve_launch_allowed: false,
    invite_delivery_allowed: false,
    source_import_automation_allowed: false,
    automatic_answer_approval_allowed: false,
    automatic_task_generation_allowed: false,
    email_ingress_allowed: false,
    outbound_email_allowed: false,
    notification_sending_allowed: false,
    live_provider_enablement_allowed: false,
    billing_pos_member_writes_allowed: false,
    next_two_slices: [
      {
        id: "hosted_customer_session_proof",
        title: "Hosted customer-session proof",
        state: "next",
        command:
          "npm run admin:customer-session:record-hosted && npm run hosted:customer-session-record:proof",
        detail:
          "Import the observed-session digest into hosted Neon and prove founder-admin RPC visibility.",
      },
      {
        id: "operator_demo_onboarding_rehearsal",
        title: "Operator-led demo onboarding rehearsal",
        state: "queued",
        command: "npm run beta:owner-handoff:inspect",
        detail:
          "Use the customer-safe handoff packet/checklist to rehearse the next gym owner onboarding path.",
      },
    ],
    blocked_gates: [
      "Public owner self-signup",
      "Invite delivery",
      "Website scraping and Google API import",
      "Automatic answer approval",
      "Automatic task generation",
      "Gmail, Resend, SMTP, provider webhooks",
      "Inbound email and outbound email",
      "Notification sending",
      "Phone/email provider activation",
      "Billing, POS, access control, member-ledger writes",
    ],
    support_checklist: [
      "Run hosted customer-session proof before using this as demo evidence.",
      "Use protected Preview only; do not switch to production for rehearsal.",
      "Confirm the owner sees the expected gym tenant and no unexpected data.",
      "Keep invite delivery, live providers, billing, POS, and member-ledger writes blocked.",
      "Prepare the next owner onboarding rehearsal from this artifact, not chat memory.",
    ],
  };

  assertNoSecretShapedKeys(runway, "admin demo onboarding runway");
  assertNoSecretShapedValue(
    JSON.stringify(runway),
    "admin demo onboarding runway",
  );
  mkdirSync(dirname(runwayPath.resolved), { recursive: true });
  writeFileSync(runwayPath.resolved, `${JSON.stringify(runway, null, 2)}\n`);

  console.log("Admin demo onboarding runway prepared.");
  console.log(`Artifact: ${runwayPath.relativePath}`);
  console.log(`Customer session: ${sessionRecordSha256.slice(0, 16)}`);
  console.log("Next two slices: hosted proof, operator demo onboarding");
  console.log(
    "Public self-serve, invites, providers, billing/POS/member writes: blocked",
  );
}

main();
