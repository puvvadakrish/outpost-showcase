#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const DEFAULT_LAUNCH_EVIDENCE_PATH =
  "artifacts/admin-launch-readiness/admin-launch-evidence-bundle.json";
const DEFAULT_PACKET_PATH =
  "artifacts/admin-launch-readiness/admin-handoff-scheduling-packet.json";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNoSecretShapedValue(value, label) {
  const text = String(value);
  const secretValue =
    /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/u.test(text) ||
    /\bpostgres(?:ql)?:\/\/[^:\s/@]+:[^@\s]+@/iu.test(text) ||
    /\bnapi_[A-Za-z0-9]{20,}\b/u.test(text) ||
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?\b/u.test(text) ||
    text.includes("__Secure-neon-auth") ||
    text.includes("outpost_neon_auth_session") ||
    /(?:password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)["']?\s*[:=]/iu.test(
      text
    );
  invariant(!secretValue, `${label} contains secret-shaped value.`);
}

function assertNoSecretShapedKeys(value, label) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoSecretShapedKeys(entry, `${label}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    invariant(
      !/(password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)/iu.test(
        key
      ),
      `${label} contains secret-shaped key ${key}.`
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
  const relativePath = relative(process.cwd(), resolved);
  const relativeToRoot = relative(root, resolved);
  invariant(
    relativeToRoot && !relativeToRoot.startsWith("..") && !relativeToRoot.split(sep).includes(".."),
    `${label} must stay under artifacts/.`
  );
  invariant(relativePath === value, `${label} must be normalized.`);
  invariant(existsSync(resolved) === mustExist, mustExist ? `${label} does not exist.` : `${label} already exists.`);
  return { relativePath, resolved };
}

function readJsonArtifact(path, label) {
  const raw = readFileSync(path, "utf8");
  assertNoSecretShapedValue(raw, label);
  const artifact = JSON.parse(raw);
  assertNoSecretShapedKeys(artifact, label);
  return { artifact, sha256: createHash("sha256").update(raw).digest("hex") };
}

function requireText(name, maxLength) {
  const value = String(process.env[name] ?? "").trim();
  invariant(value, `${name} required.`);
  invariant(value.length <= maxLength, `${name} too long.`);
  assertNoSecretShapedValue(value, name);
  return value;
}

function optionalText(name, maxLength) {
  const value = String(process.env[name] ?? "").trim();
  invariant(value.length <= maxLength, `${name} too long.`);
  assertNoSecretShapedValue(value, name);
  return value;
}

function runLaunchEvidenceInspect(bundlePath) {
  const result = spawnSync("node", ["scripts/inspect-admin-launch-evidence-bundle.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      OUTPOST_ADMIN_LAUNCH_EVIDENCE_BUNDLE_PATH: bundlePath
    }
  });
  if (result.status !== 0) {
    throw new Error(`Launch evidence bundle inspection failed.\n${result.stderr || result.stdout}`);
  }
}

function assertLaunchEvidenceBundle(bundle) {
  invariant(bundle.artifact_kind === "admin_launch_evidence_bundle", "Launch evidence bundle kind mismatch.");
  invariant(bundle.status === "admin_launch_evidence_bundle_prepared", "Launch evidence bundle status mismatch.");
  invariant(bundle.gym_name, "Launch evidence bundle gym name is required.");
  invariant(bundle.owner_email, "Launch evidence bundle owner email is required.");
  invariant(bundle.operator_evidence_ready === true, "Launch evidence must be operator-ready.");
  invariant(bundle.customer_observed_handoff_claimed === false, "Customer-observed handoff must remain pending.");
  invariant(bundle.public_self_serve_launch_allowed === false, "Public self-serve must remain blocked.");
  invariant(bundle.live_provider_enablement_allowed === false, "Live providers must remain blocked.");
  invariant(bundle.billing_pos_member_writes_allowed === false, "Billing/POS/member writes must remain blocked.");
}

function main() {
  const launchEvidencePath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_LAUNCH_EVIDENCE_BUNDLE_PATH ?? DEFAULT_LAUNCH_EVIDENCE_PATH,
    "OUTPOST_ADMIN_LAUNCH_EVIDENCE_BUNDLE_PATH",
    { mustExist: true }
  );
  const packetPath = normalizeArtifactPath(
    process.env.OUTPOST_ADMIN_HANDOFF_SCHEDULING_PACKET_PATH ?? DEFAULT_PACKET_PATH,
    "OUTPOST_ADMIN_HANDOFF_SCHEDULING_PACKET_PATH",
    { mustExist: false }
  );
  runLaunchEvidenceInspect(launchEvidencePath.relativePath);
  const { artifact: launchEvidence, sha256: launchEvidenceSha256 } = readJsonArtifact(
    launchEvidencePath.resolved,
    "admin launch evidence bundle"
  );
  assertLaunchEvidenceBundle(launchEvidence);

  const operatorLabel = requireText("OUTPOST_ADMIN_HANDOFF_SCHEDULING_OPERATOR", 120);
  const supportWindow = requireText("OUTPOST_ADMIN_HANDOFF_SCHEDULING_WINDOW", 160);
  const ownerLabel = optionalText("OUTPOST_ADMIN_HANDOFF_SCHEDULING_OWNER_LABEL", 120);
  const notes = optionalText("OUTPOST_ADMIN_HANDOFF_SCHEDULING_NOTES", 500);

  const packet = {
    artifact_kind: "admin_handoff_scheduling_packet",
    status: "admin_handoff_scheduling_packet_prepared",
    generated_at: new Date().toISOString(),
    evidence_basis: "admin_launch_evidence_bundle",
    launch_evidence_bundle_path: launchEvidencePath.relativePath,
    launch_evidence_bundle_sha256: launchEvidenceSha256,
    gym_name: launchEvidence.gym_name,
    owner_email: launchEvidence.owner_email,
    owner_label: ownerLabel,
    operator_label: operatorLabel,
    support_window: supportWindow,
    notes,
    customer_session_agenda: [
      "Confirm protected Preview workspace is the expected gym tenant.",
      "Walk owner through manual source facts saved from operator-reviewed source evidence.",
      "Walk owner through answer review and staff task handoff evidence.",
      "Confirm owner sees no unexpected tenant data, provider activation, or live-delivery claims.",
      "Decide whether to schedule a real customer-observed completion gate or stop for reset/rollback."
    ],
    support_checklist: [
      "Use operator-managed credentials shared outside this artifact.",
      "Keep customer-observed completion pending until the owner observes the protected Preview flow.",
      "Stop if customer reports unexpected data, provider claims, billing/POS/member-ledger claims, or account-access confusion.",
      "Use reset/rollback runbook before any new proof branch reuse."
    ],
    operator_evidence_ready: true,
    handoff_scheduling_ready: true,
    customer_observed_handoff_claimed: false,
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
    blocked_gates: [
      "Customer-observed handoff claim",
      "Public self-serve launch",
      "Invite delivery",
      "Website scraping and Google API import",
      "Automatic answer approval",
      "Automatic task generation",
      "Gmail, Resend, SMTP, and provider webhooks",
      "Inbound email, outbound delivery, and notifications",
      "Phone/email provider activation",
      "Billing, POS, access control, and member-ledger writes"
    ],
    command_sequence: [
      "npm run admin:launch-evidence:inspect",
      "npm run admin:handoff-scheduling:packet",
      "npm run admin:handoff-scheduling:inspect"
    ]
  };

  assertNoSecretShapedKeys(packet, "admin handoff scheduling packet");
  const serialized = `${JSON.stringify(packet, null, 2)}\n`;
  assertNoSecretShapedValue(serialized, "admin handoff scheduling packet");
  mkdirSync(dirname(packetPath.resolved), { recursive: true });
  writeFileSync(packetPath.resolved, serialized);
  console.log("Admin handoff scheduling packet prepared");
  console.log(`Artifact: ${packetPath.relativePath}`);
  console.log(`SHA256: ${createHash("sha256").update(serialized).digest("hex")}`);
  console.log("Customer-observed handoff, invite delivery, public self-serve, live providers, and billing/POS/member writes remain blocked.");
}

main();
