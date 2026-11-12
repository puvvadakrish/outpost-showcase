#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

const EXPORT_PATH =
  process.env.OUTPOST_ADMIN_SOURCE_IMPORT_PREFLIGHT_PATH ??
  "artifacts/admin-launch-readiness/admin-source-import-preflight.json";

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

function assertNoSecretShapedKeys(value, label, trail = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSecretShapedKeys(item, label, [...trail, String(index)]));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nestedValue] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/gu, "");
    const path = [...trail, key].join(".");
    const secretKey =
      normalizedKey.includes("password") ||
      normalizedKey.includes("token") ||
      normalizedKey.includes("cookie") ||
      normalizedKey.includes("apikey") ||
      normalizedKey.includes("secret") ||
      normalizedKey.includes("credential") ||
      normalizedKey.includes("authorization") ||
      normalizedKey.includes("bypass") ||
      normalizedKey.includes("jwt");
    invariant(!secretKey, `${label} contains secret-shaped key ${path}.`);
    assertNoSecretShapedKeys(nestedValue, label, [...trail, key]);
  }
}

function normalizeArtifactPath(rawPath) {
  assertNoSecretShapedValue(rawPath, "OUTPOST_ADMIN_SOURCE_IMPORT_PREFLIGHT_PATH");
  const resolved = resolve(process.cwd(), rawPath);
  const relativePath = isAbsolute(rawPath) ? rawPath : relative(process.cwd(), resolved);
  const normalizedRelative = relative(process.cwd(), resolved).split(sep).join("/");
  invariant(
    !normalizedRelative.startsWith("..") && normalizedRelative.startsWith("artifacts/"),
    "Source import preflight must read under gitignored artifacts/."
  );
  invariant(existsSync(resolved), `Source import preflight not found at ${relativePath}.`);
  return { relativePath, resolved };
}

function assertArtifactShape(artifact) {
  invariant(artifact.artifact_kind === "admin_source_import_preflight", "Artifact kind mismatch.");
  invariant(artifact.status === "source_import_preflight_prepared", "Artifact status mismatch.");
  invariant(artifact.public_self_serve_launch_allowed === false, "Public self-serve must remain blocked.");
  invariant(artifact.source_import_allowed === false, "Source import must remain blocked.");
  invariant(artifact.public_scraping_allowed === false, "Public scraping must remain blocked.");
  invariant(artifact.live_provider_enablement_allowed === false, "Live providers must remain blocked.");
  invariant(artifact.candidate_sources?.website_url || artifact.candidate_sources?.google_profile_url, "At least one candidate source required.");
  invariant(artifact.blocked_gates?.includes("website_scraping"), "Website scraping gate must be blocked.");
  invariant(artifact.blocked_gates?.includes("public_owner_self_signup"), "Public owner self-signup gate must be blocked.");
  invariant(artifact.blocked_gates?.includes("google_profile_api_import"), "Google profile import gate must be blocked.");
  invariant(artifact.blocked_gates?.includes("automatic_answer_approval"), "Automatic answer approval gate must be blocked.");
  invariant(artifact.blocked_gates?.includes("task_generation"), "Task generation gate must be blocked.");
  invariant(artifact.blocked_gates?.includes("notification_sending"), "Notification sending gate must be blocked.");
  invariant(artifact.blocked_gates?.includes("phone_email_provider_activation"), "Provider activation gate must be blocked.");
  invariant(artifact.blocked_gates?.includes("billing"), "Billing gate must be blocked.");
  invariant(artifact.blocked_gates?.includes("pos_access_control_member_ledger_writes"), "POS/member-ledger gate must be blocked.");
}

function main() {
  const { relativePath, resolved } = normalizeArtifactPath(EXPORT_PATH);
  const raw = readFileSync(resolved, "utf8");
  assertNoSecretShapedValue(raw, "source import preflight");
  const artifact = JSON.parse(raw);
  assertNoSecretShapedKeys(artifact, "source import preflight");
  assertArtifactShape(artifact);
  console.log("Admin source import preflight inspection");
  console.log(`Artifact: ${relativePath}`);
  console.log(`SHA256: ${createHash("sha256").update(raw).digest("hex")}`);
  console.log("Website/Google import remains blocked.");
}

main();
