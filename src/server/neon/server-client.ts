import "server-only";

import { cookies } from "next/headers";
import { NeonPostgrestClient } from "@neondatabase/postgrest-js";
import { requireNeonPublicEnv } from "./env";

export interface OutpostAuthUser {
  email?: string | null;
  id: string;
  user_metadata?: {
    name?: string;
  };
}

interface NeonAuthResponse {
  redirect?: boolean;
  token?: string;
  user?: {
    email?: string | null;
    emailVerified?: boolean;
    id: string;
    name?: string | null;
  };
}

interface NeonSessionResponse {
  session?: {
    token: string;
  };
  user?: NeonAuthResponse["user"];
}

interface NeonAnonymousTokenResponse {
  token?: string;
}

interface StoredSessionCookie {
  name: string;
  value: string;
}

export interface OutpostAuthResult<T> {
  data: T;
  error: { message: string } | null;
}

export interface OutpostAuthClient {
  exchangeCodeForSession(code: string): Promise<OutpostAuthResult<unknown>>;
  getUser(): Promise<OutpostAuthResult<{ user: OutpostAuthUser | null }>>;
  signInWithPassword(credentials: { email: string; password: string }): Promise<OutpostAuthResult<{ user: OutpostAuthUser | null }>>;
  signOut(): Promise<OutpostAuthResult<null>>;
  signUp(credentials: {
    email: string;
    options?: {
      data?: {
        name?: string;
      };
      emailRedirectTo?: string;
    };
    password: string;
  }): Promise<OutpostAuthResult<{ session: unknown | null; user: OutpostAuthUser | null }>>;
}

export type OutpostNeonClient = NeonPostgrestClient<any> & {
  auth: OutpostAuthClient;
};

const NEON_SESSION_COOKIE_PREFIX = "__Secure-neon-auth.session_token";
const OUTPOST_SESSION_COOKIE_NAME = "outpost_neon_auth_session_token";
const OUTPOST_SESSION_COOKIE_SOURCE_NAME = "outpost_neon_auth_session_cookie_name";

function toAuthError(error: unknown) {
  return {
    message: error instanceof Error ? error.message : "Neon Auth request failed."
  };
}

function normalizeUser(user: NeonAuthResponse["user"]): OutpostAuthUser | null {
  if (!user?.id) {
    return null;
  }

  return {
    email: user.email,
    id: user.id,
    user_metadata: {
      name: user.name ?? undefined
    }
  };
}

function getSetCookieValues(setCookieHeader: string | null) {
  if (!setCookieHeader) {
    return [];
  }

  return setCookieHeader.split(/,(?=\s*[^;,]+=)/u);
}

function extractSessionCookie(setCookieHeader: string | null) {
  return getSetCookieValues(setCookieHeader).find((value) => value.trim().startsWith(`${NEON_SESSION_COOKIE_PREFIX}=`)) ?? null;
}

async function getStoredSessionCookie(): Promise<StoredSessionCookie | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(OUTPOST_SESSION_COOKIE_NAME)?.value;

  if (!value) {
    return null;
  }

  return {
    name: cookieStore.get(OUTPOST_SESSION_COOKIE_SOURCE_NAME)?.value ?? NEON_SESSION_COOKIE_PREFIX,
    value
  };
}

async function setSessionCookie(setCookieHeader: string | null) {
  const rawSessionCookie = extractSessionCookie(setCookieHeader);

  if (!rawSessionCookie) {
    return;
  }

  const [nameValue] = rawSessionCookie.trim().split(";");
  const [name, value] = nameValue.split("=");
  const cookieStore = await cookies();

  cookieStore.set(OUTPOST_SESSION_COOKIE_NAME, decodeURIComponent(value), {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
  cookieStore.set(OUTPOST_SESSION_COOKIE_SOURCE_NAME, name, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
}

async function clearSessionCookies() {
  const cookieStore = await cookies();

  cookieStore.delete(OUTPOST_SESSION_COOKIE_NAME);
  cookieStore.delete(OUTPOST_SESSION_COOKIE_SOURCE_NAME);
}

async function requestNeonAuth<TBody>(
  path: string,
  options: {
    body?: unknown;
    cookie?: StoredSessionCookie | null;
    method?: "GET" | "POST";
  } = {}
): Promise<{
  body: TBody | null;
  ok: boolean;
  setCookie: string | null;
  status: number;
}> {
  const { appUrl, authUrl } = requireNeonPublicEnv();
  const response = await fetch(`${authUrl}${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers: {
      "Content-Type": "application/json",
      Origin: appUrl,
      ...(options.cookie ? { Cookie: `${options.cookie.name}=${encodeURIComponent(options.cookie.value)}` } : {})
    },
    method: options.method ?? "GET"
  });
  const text = await response.text();

  return {
    body: text ? (JSON.parse(text) as TBody) : null,
    ok: response.ok,
    setCookie: response.headers.get("set-cookie"),
    status: response.status
  };
}

async function getJwtFromSessionCookie() {
  const sessionCookie = await getStoredSessionCookie();

  if (!sessionCookie) {
    return null;
  }

  const response = await requestNeonAuth<{ token?: string }>("/token", {
    cookie: sessionCookie
  });

  return response.ok ? response.body?.token ?? null : null;
}

async function getAnonymousJwt() {
  const response = await requestNeonAuth<NeonAnonymousTokenResponse>("/token/anonymous");

  return response.ok ? response.body?.token ?? null : null;
}

function createAuthClient(): OutpostAuthClient {
  return {
    async exchangeCodeForSession() {
      return {
        data: null,
        error: {
          message:
            "Neon Auth callback code exchange is not implemented for Outpost yet. Use email/password sign-in for the local beta path."
        }
      };
    },
    async getUser() {
      try {
        const sessionCookie = await getStoredSessionCookie();

        if (!sessionCookie) {
          return { data: { user: null }, error: null };
        }

        const response = await requestNeonAuth<NeonSessionResponse>("/get-session", {
          cookie: sessionCookie
        });

        if (!response.ok) {
          return { data: { user: null }, error: { message: "Unable to load Neon Auth session." } };
        }

        return { data: { user: normalizeUser(response.body?.user) }, error: null };
      } catch (error) {
        return { data: { user: null }, error: toAuthError(error) };
      }
    },
    async signInWithPassword(credentials) {
      try {
        const response = await requestNeonAuth<NeonAuthResponse>("/sign-in/email", {
          body: credentials,
          method: "POST"
        });

        if (!response.ok) {
          return {
            data: { user: null },
            error: { message: response.body ? JSON.stringify(response.body) : "Unable to sign in with Neon Auth." }
          };
        }

        await setSessionCookie(response.setCookie);
        return { data: { user: normalizeUser(response.body?.user) }, error: null };
      } catch (error) {
        return { data: { user: null }, error: toAuthError(error) };
      }
    },
    async signOut() {
      try {
        const sessionCookie = await getStoredSessionCookie();

        if (sessionCookie) {
          await requestNeonAuth("/sign-out", {
            cookie: sessionCookie,
            method: "POST"
          });
        }

        await clearSessionCookies();
        return { data: null, error: null };
      } catch (error) {
        await clearSessionCookies();
        return { data: null, error: toAuthError(error) };
      }
    },
    async signUp(credentials) {
      try {
        const { appUrl } = requireNeonPublicEnv();
        const response = await requestNeonAuth<NeonAuthResponse>("/sign-up/email", {
          body: {
            callbackURL: credentials.options?.emailRedirectTo ?? `${appUrl}/auth/callback`,
            email: credentials.email,
            name: credentials.options?.data?.name ?? credentials.email,
            password: credentials.password
          },
          method: "POST"
        });

        if (!response.ok) {
          return {
            data: { session: null, user: null },
            error: { message: response.body ? JSON.stringify(response.body) : "Unable to sign up with Neon Auth." }
          };
        }

        await setSessionCookie(response.setCookie);
        return { data: { session: response.body?.token ?? null, user: normalizeUser(response.body?.user) }, error: null };
      } catch (error) {
        return { data: { session: null, user: null }, error: toAuthError(error) };
      }
    }
  };
}

export async function createOutpostServerNeonClient(): Promise<OutpostNeonClient> {
  const { dataApiUrl } = requireNeonPublicEnv();
  const auth = createAuthClient();
  const client = new NeonPostgrestClient({
    dataApiUrl,
    options: {
      global: {
        fetch: async (input, init) => {
          const token = (await getJwtFromSessionCookie()) ?? (await getAnonymousJwt());
          const headers = new Headers(init?.headers);

          if (token) {
            headers.set("Authorization", `Bearer ${token}`);
          }

          return fetch(input, {
            ...init,
            headers
          });
        }
      }
    }
  }) as OutpostNeonClient;

  client.auth = auth;
  return client;
}
