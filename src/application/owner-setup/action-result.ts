export interface OwnerSetupActionState {
  ok: boolean;
  message: string;
  targetId?: string;
}

export type EditDraftAnswerActionState = OwnerSetupActionState;

export type PersistenceMode =
  | "backend"
  | "tenant_access_required"
  | "sign_in_required"
  | "backend_unavailable"
  | "setup_required";
