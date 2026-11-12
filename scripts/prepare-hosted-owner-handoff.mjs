#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { runVercelCurl } from "./vercel-curl.mjs";

const VERCEL_BYPASS_SECRET = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const USE_VERCEL_CURL = process.env.OUTPOST_USE_VERCEL_CURL === "1";

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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
    /(?:password|token|cookie|api[_-]?key|authorization|credential|private[_-]?key|secret|bypass|signature|jwt)\s*[:=]/iu.test(
      text
    );

  invariant(!secretValue, `${label} contains a secret-shaped value.`);
}

function normalizeHostedPreviewOrigin(rawOrigin) {
  invariant(rawOrigin?.trim(), "OUTPOST_VERCEL_DEPLOYMENT_URL or NEXT_PUBLIC_OUTPOST_APP_URL is required.");
  assertNoSecretShapedValue(rawOrigin, "hosted handoff Preview URL");

  let url;
  const value = rawOrigin.trim().startsWith("http") ? rawOrigin.trim() : `https://${rawOrigin.trim()}`;

  try {
    url = new URL(value);
  } catch {
    throw new Error("Hosted owner handoff Preview URL must be a valid URL.");
  }

  const localHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
  invariant(url.protocol === "https:", "Hosted owner handoff preparation must use an HTTPS Vercel Preview URL.");
  invariant(!localHosts.has(url.hostname), "Hosted owner handoff preparation refuses local app origins.");
  invariant(url.hostname.endsWith(".vercel.app"), "Hosted owner handoff preparation must target a Vercel Preview URL.");
  invariant(
    url.hostname !== "outpost-preview-20260610.vercel.app" && url.hostname !== "outpost.vercel.app",
    "Hosted owner handoff preparation refuses production-like Vercel origins."
  );
  url.pathname = "";
  url.search = "";
  url.hash = "";

  return url.toString().replace(/\/$/u, "");
}

async function routeSmokeWithFetch(origin, route, expectedText) {
  const protectionHeaders = VERCEL_BYPASS_SECRET
    ? {
        "x-vercel-protection-bypass": VERCEL_BYPASS_SECRET,
        "x-vercel-set-bypass-cookie": "true"
      }
    : {};
  const response = await fetch(`${origin}${route}`, {
    headers: protectionHeaders,
    redirect: "follow"
  });
  const html = await response.text();
  // Intentionally conservative: any secret-shaped page content turns the smoke into a fail-closed run.
  assertNoSecretShapedValue(html, "hosted owner handoff route smoke HTML");

  const missing = expectedText.filter((text) => !html.includes(text));
  invariant(response.ok && missing.length === 0, `${route} smoke failed: status=${response.status} missing=${missing.join(", ")}`);
}

function routeSmokeWithVercelCurl(origin, route, expectedText) {
  const result = runVercelCurl([route, "--deployment", origin, "--", "--fail"]);
  const html = result.stdout;
  // Intentionally conservative: any secret-shaped page content turns the smoke into a fail-closed run.
  assertNoSecretShapedValue(html, "hosted owner handoff Vercel curl HTML");

  const missing = expectedText.filter((text) => !html.includes(text));
  invariant(result.status === 0 && missing.length === 0, `${route} smoke failed: status=${result.status} missing=${missing.join(", ")}`);
}

async function routeSmoke(origin, route, expectedText) {
  if (USE_VERCEL_CURL) {
    routeSmokeWithVercelCurl(origin, route, expectedText);
    return;
  }

  await routeSmokeWithFetch(origin, route, expectedText);
}

function runBundle(origin) {
  const result = spawnSync("npm", ["run", "beta:owner-handoff:bundle"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      OUTPOST_BETA_HANDOFF_PREVIEW_URL: origin
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  assertNoSecretShapedValue(output, "hosted owner handoff bundle output");

  if (result.status !== 0) {
    throw new Error(`Hosted owner handoff bundle generation failed.\n${output}`);
  }

  return output.trim();
}

async function main() {
  const origin = normalizeHostedPreviewOrigin(
    process.env.OUTPOST_VERCEL_DEPLOYMENT_URL ?? process.env.NEXT_PUBLIC_OUTPOST_APP_URL
  );

  console.log("Outpost hosted owner handoff preparation");
  console.log(`Preview: ${origin}`);
  console.log("Mode: protected Preview entry smoke plus non-mutating handoff bundle preparation\n");

  await routeSmoke(origin, "/owner/sign-in", [
    "Owner sign-in",
    "Request owner beta access",
    "operator"
  ]);

  console.log("/owner/sign-in smoke passed.");
  console.log(runBundle(origin));
  console.log("Hosted owner handoff preparation complete. Customer-observed completion remains pending.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
