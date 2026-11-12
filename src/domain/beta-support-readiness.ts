export type BetaSupportReadinessState = "ready" | "pending" | "blocked";

export interface BetaSupportReadinessGate {
  detail: string;
  label: string;
  state: BetaSupportReadinessState;
}

export interface BetaSupportReadinessCommand {
  command: string;
  detail: string;
  label: string;
}

export interface BetaSupportReadinessGuideStep {
  detail: string;
  label: string;
  state: BetaSupportReadinessState;
}

export interface BetaSupportReadinessLedger {
  commands: BetaSupportReadinessCommand[];
  gates: BetaSupportReadinessGate[];
  heading: string;
  handoffGuide: BetaSupportReadinessGuideStep[];
  nextAction: string;
  nonGoals: string[];
  stateLabel: string;
  summary: string;
}

export function betaSupportReadinessLedger(): BetaSupportReadinessLedger {
  return {
    commands: [
      {
        label: "Prepare handoff bundle",
        detail: "Writes the checklist, packet, and preparation manifest from one matched set of operator inputs.",
        command: "npm run beta:owner-handoff:bundle"
      },
      {
        label: "Inspect prepared bundle",
        detail: "Reads the manifest and verifies checklist, packet, pending completion, and blocked live-provider state before sharing.",
        command: "npm run beta:owner-handoff:inspect"
      },
      {
        label: "Prepare handoff checklist",
        detail: "Writes the operator run sheet that sequences packet, observed completion, final gate, and hosted proof import.",
        command: "npm run beta:owner-handoff:checklist"
      },
      {
        label: "Generate beta owner packet",
        detail: "Builds a customer-safe Markdown checklist from explicit gym, owner, Preview, and Neon branch inputs.",
        command: "npm run beta:owner-handoff:packet"
      },
      {
        label: "Record observed completion",
        detail: "Only run after a real owner observes the protected Preview handoff with every gate confirmed.",
        command: "npm run beta:owner-handoff:complete"
      },
      {
        label: "Verify customer handoff gate",
        detail: "Validates the packet plus customer-observed completion record and writes the final reviewed gate record.",
        command: "npm run beta:owner-handoff:gate"
      }
    ],
    gates: [
      {
        label: "Beta owner preflight",
        detail: "Operator-assisted owner access and first-run workspace guidance are visible before and after sign-in.",
        state: "ready"
      },
      {
        label: "Support handoff packet",
        detail: "Ready to generate as part of the handoff bundle; packet generation alone is not customer completion.",
        state: "ready"
      },
      {
        label: "Observed completion record",
        detail: "Pending until the owner observes Preview sign-in, workspace, first workflow, reset review, and no unexpected data.",
        state: "pending"
      },
      {
        label: "Customer-observed gate record",
        detail: "Pending until packet and customer-observed completion evidence are validated together by the final gate command.",
        state: "pending"
      },
      {
        label: "Self-serve and live providers",
        detail: "Public signup, invite delivery, notifications, phone/email providers, billing, POS, and member-ledger writes stay blocked.",
        state: "blocked"
      }
    ],
    handoffGuide: [
      {
        label: "Prepare artifacts",
        detail: "Operator generates and inspects the bundle, then shares only the customer-safe packet and protected Preview URL.",
        state: "ready"
      },
      {
        label: "Observe the workspace",
        detail: "Owner signs in, sees the expected workspace, and walks through manual source to answer review to staff task.",
        state: "pending"
      },
      {
        label: "Record only after the session",
        detail: "Completion is recorded after a real owner confirms the flow, reset checklist, and no unexpected tenant data.",
        state: "pending"
      },
      {
        label: "Keep live gates blocked",
        detail: "Invites, notifications, phone/email providers, billing, POS, access control, and member-ledger writes stay off.",
        state: "blocked"
      }
    ],
    heading: "Beta support handoff ledger",
    nextAction:
      "Generate a fresh beta owner handoff bundle for the next operator-assisted gym, then record completion only after the real observed session.",
    nonGoals: [
      "No claim that a packet means customer completion.",
      "No public self-signup or invite delivery.",
      "No phone/email providers, notifications, billing, POS, access control, or member-ledger writes."
    ],
    stateLabel: "Observed session pending",
    summary:
      "The generic beta support path is ready for operator-assisted handoff preparation. Completion remains pending until a real owner observes the protected Preview workflow."
  };
}
