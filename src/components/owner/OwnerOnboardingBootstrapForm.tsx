"use client";

import { useActionState } from "react";
import type { OwnerSetupActionState } from "@/application/owner-setup/action-result";

interface OwnerOnboardingBootstrapFormProps {
  action: (
    previousState: OwnerSetupActionState,
    formData: FormData
  ) => Promise<OwnerSetupActionState>;
  ownerEmail: string;
}

const initialState: OwnerSetupActionState = {
  ok: false,
  message: ""
};

export function OwnerOnboardingBootstrapForm({
  action,
  ownerEmail
}: OwnerOnboardingBootstrapFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="setup-bootstrap-form">
      <div className="form-grid">
        <label>
          <span>Owner</span>
          <input autoComplete="name" defaultValue="" name="ownerName" required />
        </label>
        <label>
          <span>Signed-in email</span>
          <input disabled value={ownerEmail} />
        </label>
        <label>
          <span>Gym name</span>
          <input autoComplete="organization" name="tenantName" required />
        </label>
        <label>
          <span>First location</span>
          <input name="locationName" required />
        </label>
        <label className="form-span-2">
          <span>Location address</span>
          <input autoComplete="street-address" name="locationAddress" required />
        </label>
        <label>
          <span>Timezone</span>
          <input defaultValue="America/Chicago" name="timezone" required />
        </label>
        <label>
          <span>Public phone</span>
          <input autoComplete="tel" name="publicPhone" />
        </label>
      </div>
      {state.message ? (
        <p className={state.ok ? "form-status success" : "form-status error"} role="status">
          {state.message}
        </p>
      ) : null}
      <button className="button button-primary" disabled={isPending} type="submit">
        {isPending ? "Creating setup" : "Create owner workspace"}
      </button>
    </form>
  );
}
