import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OwnerBetaSupportReadinessPanel } from "../src/components/owner/OwnerBetaSupportReadinessPanel";
import { betaSupportReadinessLedger } from "../src/domain/beta-support-readiness";

const workspace = readFileSync("src/components/owner/OwnerSetupWorkspaceClient.tsx", "utf8");
const panel = readFileSync("src/components/owner/OwnerBetaSupportReadinessPanel.tsx", "utf8");
const domain = readFileSync("src/domain/beta-support-readiness.ts", "utf8");
const globals = readFileSync("src/app/globals.css", "utf8");

describe("beta support readiness ledger", () => {
  it("renders the generic beta support handoff ledger in the owner workspace", () => {
    expect(workspace).toContain("OwnerBetaSupportReadinessPanel");
    expect(workspace).toContain("betaSupportReadinessLedger");
    expect(workspace).toContain("const betaSupportLedger = betaSupportReadinessLedger();");
    expect(workspace).toContain("<OwnerBetaSupportReadinessPanel ledger={betaSupportLedger} />");
    expect(panel).toContain('aria-label="Beta support handoff readiness"');
    expect(panel).toContain('aria-label="Beta owner handoff guide"');
    expect(panel).toContain('aria-label="Beta support handoff commands"');
    expect(panel).toContain("owner-beta-support-ledger");
  });

  it("renders the packet and observed-completion support path without claiming completion", () => {
    const rendered = renderToStaticMarkup(
      createElement(OwnerBetaSupportReadinessPanel, { ledger: betaSupportReadinessLedger() })
    );

    expect(rendered).toContain("Beta support handoff ledger");
    expect(rendered).toContain("Observed session pending");
    expect(rendered).toContain("Beta owner preflight");
    expect(rendered).toContain("Support handoff packet");
    expect(rendered).toContain("Observed completion record");
    expect(rendered).toContain("Customer-observed gate record");
    expect(rendered).toContain("Self-serve and live providers");
    expect(rendered).toContain("Prepare handoff bundle");
    expect(rendered).toContain("Inspect prepared bundle");
    expect(rendered).toContain("Prepare handoff checklist");
    expect(rendered).toContain("Generate beta owner packet");
    expect(rendered).toContain("Record observed completion");
    expect(rendered).toContain("Verify customer handoff gate");
    expect(rendered).toContain("state-ready");
    expect(rendered).toContain("state-pending");
    expect(rendered).toContain("state-blocked");
    expect(rendered).toContain("Ready");
    expect(rendered).toContain("Pending");
    expect(rendered).toContain("Blocked");
    expect(rendered).toContain("npm run beta:owner-handoff:bundle");
    expect(rendered).toContain("npm run beta:owner-handoff:inspect");
    expect(rendered).toContain("npm run beta:owner-handoff:checklist");
    expect(rendered).toContain("npm run beta:owner-handoff:packet");
    expect(rendered).toContain("npm run beta:owner-handoff:complete");
    expect(rendered).toContain("npm run beta:owner-handoff:gate");
    expect(rendered).toContain("Owner handoff guide");
    expect(rendered).toContain("Prepare artifacts");
    expect(rendered).toContain("Observe the workspace");
    expect(rendered).toContain("Record only after the session");
    expect(rendered).toContain("Keep live gates blocked");
    expect(rendered).toContain("No claim that a packet means customer completion.");
  });

  it("keeps the generic ledger as a read-only owner support surface", () => {
    const ledger = betaSupportReadinessLedger();

    expect(ledger.stateLabel).toBe("Observed session pending");
    expect(ledger.summary).toContain("generic beta support path is ready");
    expect(ledger.summary).toContain("Completion remains pending");
    expect(ledger.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Beta owner preflight", state: "ready" }),
        expect.objectContaining({ label: "Support handoff packet", state: "ready" }),
        expect.objectContaining({ label: "Observed completion record", state: "pending" }),
        expect.objectContaining({ label: "Customer-observed gate record", state: "pending" }),
        expect.objectContaining({ label: "Self-serve and live providers", state: "blocked" })
      ])
    );
    expect(ledger.commands.map((command) => command.command)).toEqual([
      "npm run beta:owner-handoff:bundle",
      "npm run beta:owner-handoff:inspect",
      "npm run beta:owner-handoff:checklist",
      "npm run beta:owner-handoff:packet",
      "npm run beta:owner-handoff:complete",
      "npm run beta:owner-handoff:gate"
    ]);
    expect(ledger.handoffGuide).toEqual([
      expect.objectContaining({ label: "Prepare artifacts", state: "ready" }),
      expect.objectContaining({ label: "Observe the workspace", state: "pending" }),
      expect.objectContaining({ label: "Record only after the session", state: "pending" }),
      expect.objectContaining({ label: "Keep live gates blocked", state: "blocked" })
    ]);
    expect(ledger.handoffGuide.map((step) => step.detail).join("\n")).toContain(
      "manual source to answer review to staff task"
    );
    expect(ledger.handoffGuide.map((step) => step.detail).join("\n")).toContain(
      "Invites, notifications, phone/email providers, billing, POS, access control, and member-ledger writes stay off."
    );
    expect(ledger.nonGoals.join("\n")).toContain("No public self-signup or invite delivery.");
    expect(ledger.nonGoals.join("\n")).toContain(
      "No phone/email providers, notifications, billing, POS, access control, or member-ledger writes."
    );
    expect(domain).not.toMatch(/^import\s/mu);
    expect(domain).not.toMatch(/schema|rpc|mutation|readFileSync|writeFileSync/iu);
  });

  it("adds responsive styling without nested cards or horizontal mobile layout", () => {
    expect(globals).toContain(".owner-beta-support-ledger");
    expect(globals).toContain(".owner-beta-support-gates");
    expect(globals).toContain(".owner-beta-support-guide");
    expect(globals).toContain(".owner-beta-support-guide-row");
    expect(globals).toContain(".owner-beta-support-commands");
    expect(globals).toContain(".owner-beta-support-non-goals");
    expect(globals).toMatch(/\.owner-beta-preflight-steps,[\s\S]*\.owner-beta-support-gates,[\s\S]*\.acme-handoff-gates\s*\{[\s\S]*grid-template-columns: 1fr;/u);
    expect(globals).toMatch(/\.owner-beta-support-gate\s*\{[\s\S]*border-bottom: 1px solid var\(--op-line\);[\s\S]*border-right: 0;/u);
    expect(globals).toMatch(/\.owner-beta-support-guide-row\s*\{[\s\S]*grid-template-columns: 30px 1fr;/u);
  });
});
