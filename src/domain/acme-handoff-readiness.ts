export type HandoffGateState = "done" | "pending" | "blocked";

export interface HandoffReadinessGate {
  detail: string;
  label: string;
  state: HandoffGateState;
}

export interface HandoffReadinessCommand {
  command: string;
  detail: string;
  label: string;
}

export interface HandoffReadinessLedger {
  commands: HandoffReadinessCommand[];
  gates: HandoffReadinessGate[];
  heading: string;
  nextAction: string;
  nonGoals: string[];
  stateLabel: string;
  summary: string;
}

interface HandoffReadinessTenant {
  id?: string;
  name?: string | null;
}

export function isAcmeFitnessHandoffTenant(tenant?: HandoffReadinessTenant | null) {
  return tenant?.id === "tenant_acme_fitness" || tenant?.name?.toLowerCase().startsWith("acme fitness") === true;
}

export function acmeFitnessHandoffReadinessLedger(): HandoffReadinessLedger {
  return {
    commands: [
      {
        label: "Fresh internal dry run",
        detail: "Creates retained disposable owner and tenant evidence for a browser pass.",
        command:
          "OUTPOST_ACME_DRY_RUN_KEEP_DATA=1 OUTPOST_ACME_DRY_RUN_EVIDENCE_PATH=artifacts/acme-dry-run/<run>-retained.json npm run acme:dry-run:onboarding"
      },
      {
        label: "Customer-safe packet",
        detail: "Packages retained, browser, and rollback evidence without secrets.",
        command: "npm run acme:customer-handoff:packet"
      },
      {
        label: "Observed completion",
        detail: "Only run after Acme Fitness observes the protected Preview handoff.",
        command: "npm run acme:customer-handoff:complete"
      }
    ],
    gates: [
      {
        label: "Internal operator dry run",
        // Proof status is durable project context in AGENTS.md/PLOT.md; refresh artifacts before any customer-observed run.
        detail: "Protected Preview owner sign-in, owner workspace, browser evidence, and rollback are proven internally.",
        state: "done"
      },
      {
        label: "Customer handoff packet",
        detail: "Generate from a fresh retained dry run, browser proof, and rollback-only cleanup before the owner call.",
        state: "pending"
      },
      {
        label: "Acme Fitness observed session",
        detail: "Wait until the owner or staff observer is present; do not record completion from an internal-only pass.",
        state: "pending"
      },
      {
        label: "Live-provider productization",
        detail: "Phone, email, invite delivery, notifications, billing, POS, and member-ledger writes stay blocked.",
        state: "blocked"
      }
    ],
    heading: "Acme Fitness handoff ledger",
    nextAction:
      "Set up a fresh disposable dry run when the Acme Fitness owner is available, then use the packet as the call checklist.",
    nonGoals: [
      "No customer-observed completion claim from internal proof.",
      "No phone or email provider activation.",
      "No invite delivery, notifications, billing, POS, access control, or member-ledger writes."
    ],
    stateLabel: "Owner-observed handoff pending",
    summary:
      "Internal protected-Preview proof is complete. The next gate is a real Acme Fitness observed walkthrough using a fresh dry-run packet and rollback evidence."
  };
}
