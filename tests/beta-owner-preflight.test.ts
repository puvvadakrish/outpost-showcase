import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OwnerBetaPreflightPanel } from "../src/components/owner/OwnerBetaPreflightPanel";
import { betaOwnerPreflight } from "../src/domain/beta-owner-preflight";

const signInPage = readFileSync("src/app/owner/sign-in/page.tsx", "utf8");
const bootstrap = readFileSync("src/components/owner/OwnerOnboardingBootstrap.tsx", "utf8");
const panel = readFileSync("src/components/owner/OwnerBetaPreflightPanel.tsx", "utf8");
const domain = readFileSync("src/domain/beta-owner-preflight.ts", "utf8");
const globals = readFileSync("src/app/globals.css", "utf8");

describe("beta owner preflight", () => {
  it("renders on owner sign-in and first-run bootstrap entry points", () => {
    expect(signInPage).toContain("OwnerBetaPreflightPanel");
    expect(signInPage).toContain("betaOwnerPreflight()");
    expect(signInPage).toContain("<OwnerBetaPreflightPanel preflight={preflight} />");
    expect(bootstrap).toContain("OwnerBetaPreflightPanel");
    expect(bootstrap).toContain("betaOwnerPreflight()");
    expect(bootstrap).toContain("<OwnerBetaPreflightPanel preflight={preflight} />");
    expect(panel).toContain('aria-label="Beta owner access preflight"');
  });

  it("renders beta owner guidance and blocked self-serve gates at runtime", () => {
    const rendered = renderToStaticMarkup(
      createElement(OwnerBetaPreflightPanel, { preflight: betaOwnerPreflight() })
    );

    expect(rendered).toContain("Beta owner access preflight");
    expect(rendered).toContain("Operator-assisted beta");
    expect(rendered).toContain("Owner access");
    expect(rendered).toContain("Workspace setup");
    expect(rendered).toContain("First workflow");
    expect(rendered).toContain("Self-serve gates");
    expect(rendered).toContain("Public self-signup is not open.");
    expect(rendered).toContain("Invite email and notification delivery are off.");
    expect(rendered).toContain("Phone, email, billing, POS, access control, and member-ledger writes are blocked.");
  });

  it("keeps the current product boundary operator-assisted and read-only", () => {
    const preflight = betaOwnerPreflight();

    expect(preflight.summary).toContain("not public self-serve onboarding or live phone/email automation");
    expect(preflight.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Owner access", state: "ready" }),
        expect.objectContaining({ label: "Workspace setup", state: "ready" }),
        expect.objectContaining({ label: "First workflow", state: "assisted" }),
        expect.objectContaining({ label: "Self-serve gates", state: "blocked" })
      ])
    );
    expect(preflight.blockedGates.join("\n")).toContain("Public self-signup is not open.");
    expect(preflight.blockedGates.join("\n")).toContain("Invite email and notification delivery are off.");
    expect(preflight.blockedGates.join("\n")).toContain("Phone, email, billing, POS, access control, and member-ledger writes are blocked.");
    expect(domain).not.toMatch(/^import\s/mu);
  });

  it("adds responsive styling for owner preflight without horizontal mobile layout", () => {
    expect(globals).toContain(".owner-beta-preflight");
    expect(globals).toContain(".owner-beta-preflight-steps");
    expect(globals).toContain(".owner-beta-preflight-blockers");
    expect(globals).toMatch(/\.beta-rehearsal-steps,[\s\S]*\.owner-beta-preflight-steps,[\s\S]*grid-template-columns: 1fr;/u);
  });
});
