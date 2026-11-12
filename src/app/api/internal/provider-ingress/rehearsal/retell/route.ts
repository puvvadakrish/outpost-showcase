import type { NextRequest } from "next/server";
import { handleProviderIngressRequest } from "@/server/providers/ingress-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return handleProviderIngressRequest({ request, providerKey: "retell" });
}
