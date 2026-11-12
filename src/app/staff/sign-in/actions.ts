"use server";

import { redirect } from "next/navigation";
import { StaffAuthApplicationService } from "@/application/staff-auth/service";
import { NeonStaffAuthRepository } from "@/infrastructure/neon/staff-auth-repository";
import { isNeonConfigured } from "@/server/neon/env";
import { createOutpostServerNeonClient } from "@/server/neon/server-client";
import type { OutpostNeonClient } from "@/server/neon/server-client";

export interface StaffSignInActionState {
  kind:
    | "idle"
    | "credentials_error"
    | "not_rostered"
    | "already_claimed"
    | "unconfirmed_email"
    | "missing_email_claim"
    | "confirm_email"
    | "backend_unavailable";
  ok: boolean;
  message: string;
}

async function claimStaffRosterAfterAuth(neon: OutpostNeonClient) {
  const service = new StaffAuthApplicationService(new NeonStaffAuthRepository(neon));
  await service.claimStaffRosterMembership();
}

function staffClaimMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return {
      kind: "backend_unavailable" as const,
      message: "Unable to claim staff access through backend persistence."
    };
  }

  const message = error.message.replace(/^Unable to claim staff roster membership:\s*/u, "");

  if (message.includes("roster membership is required")) {
    return {
      kind: "not_rostered" as const,
      message: "Your email is not on an active staff roster yet. Ask the owner to add staff access first."
    };
  }

  if (message.includes("already linked")) {
    return {
      kind: "already_claimed" as const,
      message: "This staff roster email is already linked to another authenticated account."
    };
  }

  if (message.includes("confirmed authenticated email")) {
    return {
      kind: "unconfirmed_email" as const,
      message: "Confirm this staff account email before claiming roster access."
    };
  }

  if (message.includes("authenticated email claim")) {
    return {
      kind: "missing_email_claim" as const,
      message: "Neon did not return an email claim for this staff account."
    };
  }

  return {
    kind: "backend_unavailable" as const,
    message: "Unable to claim staff access through backend persistence."
  };
}

export async function signInStaffAction(
  _previousState: StaffSignInActionState,
  formData: FormData
): Promise<StaffSignInActionState> {
  if (!isNeonConfigured()) {
    return { kind: "backend_unavailable", ok: false, message: "Neon is not configured for this environment." };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { kind: "credentials_error", ok: false, message: "Email and password are required." };
  }

  try {
    const neon = await createOutpostServerNeonClient();
    const { error } = await neon.auth.signInWithPassword({ email, password });

    if (error) {
      return { kind: "credentials_error", ok: false, message: "Unable to sign in with those staff credentials." };
    }

    await claimStaffRosterAfterAuth(neon);
  } catch (error) {
    const result = staffClaimMessage(error);
    return { kind: result.kind, ok: false, message: result.message };
  }

  redirect("/staff/tasks");
}

export async function signUpStaffAction(
  _previousState: StaffSignInActionState,
  formData: FormData
): Promise<StaffSignInActionState> {
  if (!isNeonConfigured()) {
    return { kind: "backend_unavailable", ok: false, message: "Neon is not configured for this environment." };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { kind: "credentials_error", ok: false, message: "Email and password are required." };
  }

  try {
    const neon = await createOutpostServerNeonClient();
    const { data, error } = await neon.auth.signUp({ email, password });

    if (error) {
      return { kind: "credentials_error", ok: false, message: "Unable to create a staff account with those credentials." };
    }

    if (!data.session) {
      const { error: signInError } = await neon.auth.signInWithPassword({ email, password });

      if (signInError) {
        return {
          kind: "confirm_email",
          ok: true,
          message: "Staff account created. Confirm the email if prompted, then sign in."
        };
      }
    }

    await claimStaffRosterAfterAuth(neon);
  } catch (error) {
    const result = staffClaimMessage(error);
    return { kind: result.kind, ok: false, message: result.message };
  }

  redirect("/staff/tasks");
}
