import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AcmeHandoffReadinessPanel } from "../src/components/owner/AcmeHandoffReadinessPanel";
import { acmeFitnessHandoffReadinessLedger, isAcmeFitnessHandoffTenant } from "../src/domain/acme-handoff-readiness";

const workspace = readFileSync("src/components/owner/OwnerSetupWorkspaceClient.tsx", "utf8");
const panel = readFileSync("src/components/owner/AcmeHandoffReadinessPanel.tsx", "utf8");
const domain = readFileSync("src/domain/acme-handoff-readiness.ts", "utf8");
const globals = readFileSync("src/app/globals.css", "utf8");

describe("Acme Fitness handoff readiness ledger", () => {
  it("renders a customer-zero handoff ledger in the owner workspace", () => {
    expect(workspace).toContain("AcmeHandoffReadinessPanel");
    expect(workspace).toContain("acmeFitnessHandoffReadinessLedger");
    expect(workspace).toContain("isAcmeFitnessHandoffTenant(tenant)");
    expect(workspace).toContain("const acmeHandoffLedger = useMemo(");
    expect(workspace).toContain("acmeHandoffLedger ? <AcmeHandoffReadinessPanel ledger={acmeHandoffLedger} /> : null");
    expect(panel).toContain('aria-label="Acme Fitness handoff readiness"');
    expect(panel).toContain('aria-label="Acme Fitness handoff commands"');
    expect(panel).toContain("acme-handoff-ledger");
  });

  it("renders the ledger gates commands and no-go boundaries at runtime", () => {
    const rendered = renderToStaticMarkup(
      createElement(AcmeHandoffReadinessPanel, { ledger: acmeFitnessHandoffReadinessLedger() })
    );

    expect(rendered).toContain("Internal operator dry run");
    expect(rendered).toContain("Customer handoff packet");
    expect(rendered).toContain("Acme Fitness observed session");
    expect(rendered).toContain("Live-provider productization");
    expect(rendered).toContain("npm run acme:dry-run:onboarding");
    expect(rendered).toContain("npm run acme:customer-handoff:packet");
    expect(rendered).toContain("npm run acme:customer-handoff:complete");
    expect(rendered).toContain("No phone or email provider activation.");
  });

  it("only targets the seeded Acme Fitness tenant and disposable ACME dry-run tenants", () => {
    expect(isAcmeFitnessHandoffTenant({ id: "tenant_acme_fitness", name: "Acme Fitness" })).toBe(true);
    expect(isAcmeFitnessHandoffTenant({ id: "tenant_dry_run", name: "Acme Fitness Dry Run acme_001" })).toBe(
      true
    );
    expect(isAcmeFitnessHandoffTenant({ id: "tenant_next_gym", name: "Peak CrossFit" })).toBe(false);
    expect(isAcmeFitnessHandoffTenant({ id: "tenant_next_gym", name: null })).toBe(false);
    expect(isAcmeFitnessHandoffTenant(null)).toBe(false);
  });

  it("separates completed internal proof from the later customer-observed gate", () => {
    const ledger = acmeFitnessHandoffReadinessLedger();

    expect(ledger.stateLabel).toBe("Owner-observed handoff pending");
    expect(ledger.summary).toContain("Internal protected-Preview proof is complete");
    expect(ledger.summary).toContain("real Acme Fitness observed walkthrough");
    expect(ledger.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Internal operator dry run", state: "done" }),
        expect.objectContaining({ label: "Customer handoff packet", state: "pending" }),
        expect.objectContaining({ label: "Acme Fitness observed session", state: "pending" }),
        expect.objectContaining({ label: "Live-provider productization", state: "blocked" })
      ])
    );
  });

  it("keeps the ledger as a read-only operator surface with explicit no-live-provider gates", () => {
    const ledger = acmeFitnessHandoffReadinessLedger();

    expect(ledger.commands.map((command) => command.command).join("\n")).toContain("acme:dry-run:onboarding");
    expect(ledger.commands.map((command) => command.command).join("\n")).toContain("acme:customer-handoff:packet");
    expect(ledger.commands.map((command) => command.command).join("\n")).toContain("acme:customer-handoff:complete");
    expect(ledger.nonGoals.join("\n")).toContain("No customer-observed completion claim from internal proof.");
    expect(ledger.nonGoals.join("\n")).toContain("No phone or email provider activation.");
    expect(ledger.nonGoals.join("\n")).toContain("No invite delivery, notifications, billing, POS, access control, or member-ledger writes.");
    expect(domain).not.toMatch(/^import\s/u);
  });

  it("adds responsive styling without nested cards or horizontal mobile layout", () => {
    expect(globals).toContain(".acme-handoff-ledger");
    expect(globals).toContain(".acme-handoff-gates");
    expect(globals).toContain(".acme-handoff-commands");
    expect(globals).toContain(".channel-pill.quiet");
    expect(globals).toMatch(/\.beta-rehearsal-steps,[\s\S]*\.acme-handoff-gates\s*\{[\s\S]*grid-template-columns: 1fr;/u);
  });
});
