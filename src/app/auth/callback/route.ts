import { NextResponse, type NextRequest } from "next/server";
import { createOutpostServerNeonClient } from "@/server/neon/server-client";

const CALLBACK_FALLBACK_PATH = "/owner";
const DISALLOWED_DECODED_REDIRECT_CHARACTERS =
  /[\\\u0000-\u001f\u007f-\u009f\ufffd]/u;

function resolveCallbackDestination(
  requestedNext: string | null,
  requestOrigin: string,
) {
  let decodedForInspection = requestedNext;

  try {
    decodedForInspection = requestedNext ? decodeURI(requestedNext) : null;
  } catch {
    return new URL(CALLBACK_FALLBACK_PATH, requestOrigin);
  }

  if (
    !requestedNext ||
    !decodedForInspection ||
    !requestedNext.startsWith("/") ||
    requestedNext.startsWith("//") ||
    DISALLOWED_DECODED_REDIRECT_CHARACTERS.test(decodedForInspection) ||
    decodedForInspection.startsWith("//")
  ) {
    return new URL(CALLBACK_FALLBACK_PATH, requestOrigin);
  }

  try {
    const destination = new URL(requestedNext, requestOrigin);

    return destination.origin === requestOrigin &&
      destination.pathname.startsWith("/") &&
      !destination.pathname.startsWith("//")
      ? destination
      : new URL(CALLBACK_FALLBACK_PATH, requestOrigin);
  } catch {
    return new URL(CALLBACK_FALLBACK_PATH, requestOrigin);
  }
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const destination = resolveCallbackDestination(
    requestUrl.searchParams.get("next"),
    requestUrl.origin,
  );

  if (code) {
    const neon = await createOutpostServerNeonClient();
    const { error } = await neon.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(new URL("/owner/sign-in?auth=callback-not-available", requestUrl.origin));
    }
  }

  return NextResponse.redirect(destination);
}
