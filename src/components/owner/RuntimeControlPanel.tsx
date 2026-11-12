"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  OwnerSetupActionState,
  PersistenceMode,
} from "@/application/owner-setup/action-result";
import type { TenantRuntimeControl } from "@/domain/runtime-control";

interface RuntimeControlPanelProps {
  control: TenantRuntimeControl;
  onSetRuntimeProcessingState: (
    previousState: OwnerSetupActionState,
    formData: FormData,
  ) => Promise<OwnerSetupActionState>;
  persistenceMode: PersistenceMode;
  tenantId: string;
}

const initialState: OwnerSetupActionState = { ok: false, message: "" };

function defaultReason(enabled: boolean) {
  return enabled ? "Owner emergency stop" : "Owner approved protected processing";
}

function authoritativeTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC"
  }).format(new Date(value)) + " UTC";
}

export function RuntimeControlPanel({
  control,
  onSetRuntimeProcessingState,
  persistenceMode,
  tenantId,
}: RuntimeControlPanelProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    onSetRuntimeProcessingState,
    initialState,
  );
  const [operationKey, setOperationKey] = useState("");
  const enabled = control.processingState === "enabled";
  const [reason, setReason] = useState(() => defaultReason(enabled));
  const requestedState = enabled ? "stopped" : "enabled";
  const canSubmit =
    persistenceMode === "backend" && Boolean(operationKey) && !isPending;

  useEffect(() => {
    setOperationKey(`runtime_${crypto.randomUUID()}`);
  }, []);

  useEffect(() => {
    if (state.ok) {
      setOperationKey(`runtime_${crypto.randomUUID()}`);
      router.refresh();
    } else if (state.message.startsWith("Processing state changed.")) {
      router.refresh();
    }
  }, [router, state]);

  useEffect(() => {
    setReason(defaultReason(enabled));
  }, [control.pauseGeneration, enabled]);

  return (
    <section
      className={`panel runtime-control-panel ${enabled ? "enabled" : "stopped"}`}
      id="tenant-processing-authority"
    >
      <div className="panel-header">
        <div>
          <span className="rail-title">Tenant processing authority</span>
          <h2>
            {enabled
              ? "Background processing enabled"
              : "Background processing stopped"}
          </h2>
          <p>
            {enabled
              ? "Eligible tenant jobs may be claimed. Provider ingress and outbound delivery remain blocked."
              : "Tenant jobs remain queued and normalized provider persistence fails closed."}
          </p>
        </div>
        <span className={`channel-pill ${enabled ? "" : "quiet"}`}>
          {enabled ? "Enabled" : "Stopped"}
        </span>
      </div>
      <form action={formAction} className="runtime-control-form">
        <fieldset disabled={isPending || persistenceMode !== "backend"}>
          <input name="tenantId" type="hidden" value={tenantId} />
          <input name="operationKey" type="hidden" value={operationKey} />
          <input name="requestedState" type="hidden" value={requestedState} />
          <input
            name="expectedPauseGeneration"
            type="hidden"
            value={enabled ? "" : control.pauseGeneration}
          />
          <label>
            Audit reason
            <input
              maxLength={500}
              minLength={3}
              name="reason"
              onChange={(event) => setReason(event.target.value)}
              required
              value={reason}
            />
          </label>
          <button
            className={`button ${enabled ? "button-danger" : "button-primary"}`}
            disabled={!canSubmit}
            type="submit"
          >
            {isPending
              ? "Applying"
              : enabled
                ? "Stop background processing"
                : "Enable protected processing"}
          </button>
        </fieldset>
        {persistenceMode !== "backend" ? (
          <p className="form-help">Backend authority is required to change processing.</p>
        ) : null}
      </form>
      <div className="runtime-control-evidence">
        <span>Pause generation {control.pauseGeneration}</span>
        <span>
          Last authoritative change{" "}
          <time dateTime={control.updatedAt}>{authoritativeTimestamp(control.updatedAt)}</time>
        </span>
      </div>
      {state.message ? (
        <p
          className={`inline-form-status ${state.ok ? "success" : "error"}`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
    </section>
  );
}
