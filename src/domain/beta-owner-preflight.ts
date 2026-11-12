export type BetaOwnerPreflightState = "ready" | "assisted" | "blocked";

export interface BetaOwnerPreflightStep {
  detail: string;
  label: string;
  state: BetaOwnerPreflightState;
}

export interface BetaOwnerPreflight {
  blockedGates: string[];
  heading: string;
  nextAction: string;
  stateLabel: string;
  steps: BetaOwnerPreflightStep[];
  summary: string;
}

export function betaOwnerPreflight(): BetaOwnerPreflight {
  return {
    blockedGates: [
      "Public self-signup is not open.",
      "Invite email and notification delivery are off.",
      "Phone, email, billing, POS, access control, and member-ledger writes are blocked."
    ],
    heading: "Beta owner access preflight",
    nextAction:
      "Use the operator-provisioned beta owner account, create the workspace, then stage manual facts before any live provider setup.",
    stateLabel: "Operator-assisted beta",
    steps: [
      {
        detail: "An Outpost operator provisions the beta owner account and temporary password on the hosted proof branch.",
        label: "Owner access",
        state: "ready"
      },
      {
        detail: "The owner creates a tenant, first location, safe handoff defaults, and a task queue after sign-in.",
        label: "Workspace setup",
        state: "ready"
      },
      {
        detail: "Manual source facts, answer review, and staff task handoff are the beta proof path.",
        label: "First workflow",
        state: "assisted"
      },
      {
        detail: "Acme Fitness customer-observed handoff must be green before public self-serve or live providers.",
        label: "Self-serve gates",
        state: "blocked"
      }
    ],
    summary:
      "Outpost is ready for an operator-assisted beta owner walkthrough, not public self-serve onboarding or live phone/email automation."
  };
}
