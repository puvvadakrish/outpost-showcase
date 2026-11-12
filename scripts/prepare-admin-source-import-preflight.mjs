#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

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
    "Source import preflight must write under gitignored artifacts/."
  );
  invariant(relativePath.endsWith(".json"), "Source import preflight must be a JSON artifact.");
  return { relativePath, resolved };
}

function optionalEnv(name) {
  const value = process.env[name]?.trim() ?? "";
  assertNoSecretShapedValue(value, name);
  return value;
}

function requireEnv(name) {
  const value = optionalEnv(name);
  invariant(value, `${name} required.`);
  return value;
}

function normalizePublicUrl(rawValue, label) {
  const value = rawValue.trim();
  if (!value) return null;
  const url = new URL(value);
  invariant(url.protocol === "https:", `${label} must use https.`);
  invariant(!url.username && !url.password, `${label} must not include credentials.`);
  invariant(!["localhost", "127.0.0.1", "::1"].includes(url.hostname), `${label} must not be local.`);
  url.hash = "";
  return url.toString();
}

function main() {
  const { relativePath, resolved } = normalizeArtifactPath(EXPORT_PATH);
  const gymName = requireEnv("OUTPOST_ADMIN_SOURCE_IMPORT_GYM_NAME");
  const ownerEmail = requireEnv("OUTPOST_ADMIN_SOURCE_IMPORT_OWNER_EMAIL").toLowerCase();
  invariant(/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(ownerEmail), "Owner email must be valid.");
  const websiteUrl = normalizePublicUrl(optionalEnv("OUTPOST_ADMIN_SOURCE_IMPORT_WEBSITE_URL"), "Website URL");
  const googleProfileUrl = normalizePublicUrl(
    optionalEnv("OUTPOST_ADMIN_SOURCE_IMPORT_GOOGLE_PROFILE_URL"),
    "Google profile URL"
  );
  invariant(websiteUrl || googleProfileUrl, "Provide website or Google profile URL.");

  const artifact = {
    artifact_kind: "admin_source_import_preflight",
    status: "source_import_preflight_prepared",
    generated_at: new Date().toISOString(),
    gym_name: gymName,
    owner_email: ownerEmail,
    candidate_sources: {
      website_url: websiteUrl,
      google_profile_url: googleProfileUrl
    },
    public_self_serve_launch_allowed: false,
    source_import_allowed: false,
    public_scraping_allowed: false,
    live_provider_enablement_allowed: false,
    checklist: [
      "Verify source URLs belong to the requested gym before any import implementation.",
      "Confirm owner can edit imported facts before answer approval.",
      "Keep all imported facts in draft/conflict review until owner approval.",
      "Do not scrape, call Google APIs, create tasks, send notifications, or enable providers in this preflight."
    ],
    blocked_gates: [
      "website_scraping",
      "public_owner_self_signup",
      "google_profile_api_import",
      "automatic_answer_approval",
      "task_generation",
      "notification_sending",
      "phone_email_provider_activation",
      "billing",
      "pos_access_control_member_ledger_writes"
    ]
  };

  assertNoSecretShapedKeys(artifact, "source import preflight");
  const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
  assertNoSecretShapedValue(serialized, "source import preflight");
  mkdirSync(dirname(resolved), { recursive: true });
  writeFileSync(resolved, serialized);
  console.log("Admin source import preflight prepared");
  console.log(`Artifact: ${relativePath}`);
  console.log(`SHA256: ${createHash("sha256").update(serialized).digest("hex")}`);
  console.log("Website/Google import remains blocked.");
}

main();
