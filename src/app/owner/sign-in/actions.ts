"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isNeonConfigured } from "@/server/neon/env";
import { createOutpostServerNeonClient } from "@/server/neon/server-client";

export interface SignInActionState {
  ok: boolean;
  message: string;
}

export async function signInOwnerAction(
  _previousState: SignInActionState,
  formData: FormData
): Promise<SignInActionState> {
  if (!isNeonConfigured()) {
    return { ok: false, message: "Neon is not configured for this environment." };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, message: "Email and password are required." };
  }

  try {
    const neon = await createOutpostServerNeonClient();
    const { error } = await neon.auth.signInWithPassword({ email, password });

    if (error) {
      return { ok: false, message: "Unable to sign in with those owner credentials." };
    }
  } catch {
    return { ok: false, message: "Unable to reach owner sign-in right now." };
  }

  redirect("/owner");
}

export async function requestOwnerBetaAccessAction(
  _previousState: SignInActionState,
  formData: FormData
): Promise<SignInActionState> {
  if (!isNeonConfigured()) {
    return { ok: false, message: "Neon is not configured for beta access requests in this environment." };
  }

  const email = String(formData.get("email") ?? "").trim();
  const ownerName = String(formData.get("ownerName") ?? "").trim();
  const gymName = String(formData.get("gymName") ?? "").trim();
  const locationHint = String(formData.get("locationHint") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const companyWebsite = String(formData.get("companyWebsite") ?? "").trim();

  if (!email || !ownerName || !gymName) {
    return { ok: false, message: "Owner name, gym name, and email are required." };
  }

  try {
    const neon = await createOutpostServerNeonClient();
    const { error } = await neon.rpc("submit_owner_beta_access_request", {
      p_company_website: companyWebsite,
      p_gym_name: gymName,
      p_location_hint: locationHint,
      p_note: note,
      p_owner_email: email,
      p_owner_name: ownerName
    });

    if (error) {
      return {
        ok: false,
        message: "Unable to save that beta access request. Check the fields and try again."
      };
    }
  } catch {
    return { ok: false, message: "Unable to reach beta access requests right now." };
  }

  revalidatePath("/admin");

  return {
    ok: true,
    message:
      "Request received. An operator will review it and provision owner access manually if approved; invite delivery and public self-serve remain off."
  };
}
