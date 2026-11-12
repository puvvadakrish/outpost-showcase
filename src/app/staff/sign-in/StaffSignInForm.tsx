"use client";

import { useActionState, useState } from "react";
import type { StaffSignInActionState } from "./actions";
import { signInStaffAction, signUpStaffAction } from "./actions";

const initialState: StaffSignInActionState = {
  kind: "idle",
  ok: false,
  message: ""
};

const resultGuidance: Record<
  StaffSignInActionState["kind"],
  { title: string; nextStep: string; tone: "neutral" | "success" | "warning" | "error" }
> = {
  already_claimed: {
    nextStep: "Ask the owner to check the staff access row before you try a different account.",
    title: "Roster row already claimed",
    tone: "warning"
  },
  backend_unavailable: {
    nextStep: "Retry after the local Neon backend is running and the seed state is current.",
    title: "Backend claim did not complete",
    tone: "error"
  },
  confirm_email: {
    nextStep: "Confirm the staff account email if Neon asks for it, then return here and sign in.",
    title: "Account created",
    tone: "success"
  },
  credentials_error: {
    nextStep: "Check the email and password. Use the email the owner added to staff access.",
    title: "Credentials were not accepted",
    tone: "error"
  },
  idle: {
    nextStep: "Use the exact email from the owner roster. Outpost links access only after Auth succeeds.",
    title: "Ready to claim staff access",
    tone: "neutral"
  },
  missing_email_claim: {
    nextStep: "Sign out and sign in again. If it repeats, reset the local Auth session before retrying.",
    title: "Email claim missing",
    tone: "error"
  },
  not_rostered: {
    nextStep: "Ask the owner to add this email in Staff access, then return to this page.",
    title: "Owner access is needed first",
    tone: "warning"
  },
  unconfirmed_email: {
    nextStep: "Confirm this staff account email, then return here and sign in again.",
    title: "Email confirmation required",
    tone: "warning"
  }
};

export function StaffSignInForm() {
  const [signInState, signInFormAction, isSigningIn] = useActionState(signInStaffAction, initialState);
  const [signUpState, signUpFormAction, isSigningUp] = useActionState(signUpStaffAction, initialState);
  const [lastIntent, setLastIntent] = useState<"sign_in" | "sign_up" | null>(null);
  const activeState =
    lastIntent === "sign_up" ? signUpState : lastIntent === "sign_in" ? signInState : initialState;
  const guidance = resultGuidance[activeState.kind];

  return (
    <div className="staff-auth-claim-layout">
      <aside className={`staff-auth-result ${guidance.tone}`} aria-live="polite">
        <span className="rail-title">Claim result</span>
        <h2>{guidance.title}</h2>
        <p>{activeState.message || "Staff access is tenant-scoped and owner-rostered before claim."}</p>
        <dl>
          <div>
            <dt>Next step</dt>
            <dd>{guidance.nextStep}</dd>
          </div>
          <div>
            <dt>Boundary</dt>
            <dd>No invite email, Auth admin provisioning, hosted proof, or live providers.</dd>
          </div>
        </dl>
      </aside>

      <div className="auth-form-grid staff-auth-form-grid">
        <form action={signInFormAction} className="auth-form" onSubmit={() => setLastIntent("sign_in")}>
          <div>
            <h2>Staff sign in</h2>
            <p>Use an existing staff Auth account.</p>
          </div>
          <label suppressHydrationWarning>
            <span>Email</span>
            <input autoComplete="email" name="email" required suppressHydrationWarning type="email" />
          </label>
          <label suppressHydrationWarning>
            <span>Password</span>
            <input autoComplete="current-password" name="password" required suppressHydrationWarning type="password" />
          </label>
          <button className="button button-primary" disabled={isSigningIn} type="submit">
            {isSigningIn ? "Signing in" : "Sign in and claim roster"}
          </button>
        </form>
        <form action={signUpFormAction} className="auth-form" onSubmit={() => setLastIntent("sign_up")}>
          <div>
            <h2>Create staff account</h2>
            <p>Use the email the owner added.</p>
          </div>
          <label suppressHydrationWarning>
            <span>Email</span>
            <input autoComplete="email" name="email" required suppressHydrationWarning type="email" />
          </label>
          <label suppressHydrationWarning>
            <span>Password</span>
            <input autoComplete="new-password" minLength={8} name="password" required suppressHydrationWarning type="password" />
          </label>
          <button className="button" disabled={isSigningUp} type="submit">
            {isSigningUp ? "Creating account" : "Create and claim roster"}
          </button>
        </form>
      </div>
    </div>
  );
}
