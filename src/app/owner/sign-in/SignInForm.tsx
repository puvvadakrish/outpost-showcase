"use client";

import { useActionState } from "react";
import type { SignInActionState } from "./actions";
import { requestOwnerBetaAccessAction, signInOwnerAction } from "./actions";

const initialState: SignInActionState = {
  ok: false,
  message: ""
};

export function SignInForm() {
  const [signInState, signInFormAction, isSigningIn] = useActionState(signInOwnerAction, initialState);
  const [requestState, requestFormAction, isRequesting] = useActionState(requestOwnerBetaAccessAction, initialState);

  return (
    <div className="auth-form-grid">
      <form action={signInFormAction} className="auth-form">
        <h2>Sign in</h2>
        <p className="auth-form-note">Use the owner credentials provisioned by an Outpost operator.</p>
        <label suppressHydrationWarning>
          <span>Email</span>
          <input autoComplete="email" name="email" required suppressHydrationWarning type="email" />
        </label>
        <label suppressHydrationWarning>
          <span>Password</span>
          <input autoComplete="current-password" name="password" required suppressHydrationWarning type="password" />
        </label>
        {signInState.message ? (
          <p
            className={signInState.ok ? "form-status success" : "form-status error"}
            role="status"
          >
            {signInState.message}
          </p>
        ) : null}
        <button className="button button-primary" disabled={isSigningIn} type="submit">
          {isSigningIn ? "Signing in" : "Sign in"}
        </button>
      </form>
      <form action={requestFormAction} className="auth-form beta-access-request-form">
        <h2>Request owner beta access</h2>
        <p className="auth-form-note">
          Owner accounts are operator-provisioned after review. This request does not create an
          account, send an invite, or enable phone/email providers.
        </p>
        <ol className="beta-access-request-steps" aria-label="Beta access request steps">
          <li>
            <span>1</span>
            <strong>Submit request</strong>
            <small>Share the owner and gym details for operator review.</small>
          </li>
          <li>
            <span>2</span>
            <strong>Operator reviews</strong>
            <small>Outpost checks the protected Preview and no-live-provider gates.</small>
          </li>
          <li>
            <span>3</span>
            <strong>Manual access</strong>
            <small>Approved owners receive operator-provisioned credentials outside this form.</small>
          </li>
        </ol>
        <div className="beta-access-request-boundary" aria-label="Beta access request boundaries">
          <strong>Still blocked</strong>
          <ul>
            <li>No public owner self-signup.</li>
            <li>No invite delivery or notification sending.</li>
            <li>No billing, POS, or member-ledger writes.</li>
          </ul>
        </div>
        <label suppressHydrationWarning>
          <span>Owner name</span>
          <input autoComplete="name" maxLength={120} name="ownerName" required suppressHydrationWarning />
        </label>
        <label suppressHydrationWarning>
          <span>Gym name</span>
          <input autoComplete="organization" maxLength={140} name="gymName" required suppressHydrationWarning />
        </label>
        <label suppressHydrationWarning>
          <span>Email</span>
          <input autoComplete="email" maxLength={254} name="email" required suppressHydrationWarning type="email" />
        </label>
        <label suppressHydrationWarning>
          <span>City or location</span>
          <input autoComplete="address-level2" maxLength={160} name="locationHint" suppressHydrationWarning />
        </label>
        <label suppressHydrationWarning>
          <span>What should the operator know?</span>
          <textarea maxLength={500} name="note" rows={4} suppressHydrationWarning />
        </label>
        <label aria-hidden="true" className="form-honeypot" tabIndex={-1}>
          <span>Company website</span>
          <input autoComplete="off" name="companyWebsite" tabIndex={-1} />
        </label>
        {requestState.message ? (
          <p
            className={requestState.ok ? "form-status success" : "form-status error"}
            role="status"
          >
            {requestState.message}
          </p>
        ) : null}
        <button className="button" disabled={isRequesting} type="submit">
          {isRequesting ? "Sending request" : "Request beta access"}
        </button>
      </form>
    </div>
  );
}
