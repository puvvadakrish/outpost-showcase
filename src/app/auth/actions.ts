"use server";

import { redirect } from "next/navigation";
import { isNeonConfigured } from "@/server/neon/env";
import { createOutpostServerNeonClient } from "@/server/neon/server-client";

async function signOutTo(path: string) {
  if (isNeonConfigured()) {
    const neon = await createOutpostServerNeonClient();
    await neon.auth.signOut();
  }

  redirect(path);
}

export async function signOutOwnerAction() {
  await signOutTo("/owner/sign-in");
}

export async function signOutStaffAction() {
  await signOutTo("/staff/sign-in");
}

export async function signOutFounderAction() {
  await signOutTo("/admin");
}
