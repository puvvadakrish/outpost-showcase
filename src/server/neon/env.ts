export function getOutpostAppUrl(env: Record<string, string | undefined> = process.env) {
  if (env.NEXT_PUBLIC_OUTPOST_APP_URL) {
    return env.NEXT_PUBLIC_OUTPOST_APP_URL;
  }

  if (env.VERCEL_URL) {
    return `https://${env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

export function getNeonPublicEnv() {
  return {
    appUrl: getOutpostAppUrl(),
    authUrl: process.env.NEXT_PUBLIC_NEON_AUTH_URL,
    dataApiUrl: process.env.NEXT_PUBLIC_NEON_DATA_API_URL
  };
}

export function isNeonConfigured() {
  const { authUrl, dataApiUrl } = getNeonPublicEnv();
  return Boolean(authUrl && dataApiUrl);
}

export function requireNeonPublicEnv() {
  const env = getNeonPublicEnv();

  if (!env.authUrl || !env.dataApiUrl) {
    throw new Error("Neon is not configured. Set NEXT_PUBLIC_NEON_AUTH_URL and NEXT_PUBLIC_NEON_DATA_API_URL.");
  }

  return {
    appUrl: env.appUrl,
    authUrl: env.authUrl,
    dataApiUrl: env.dataApiUrl
  };
}
