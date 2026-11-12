export const DISALLOWED_NEON_PROJECT_IDS = new Map([
  ["aaaaaaaaaaaaaaaaaaa1", "other-project-a"],
  ["aaaaaaaaaaaaaaaaaaa2", "other-project-b"],
  ["aaaaaaaaaaaaaaaaaaa3", "other-project-c"],
  ["aaaaaaaaaaaaaaaaaaa4", "other-project-d"]
]);

function envValue(env, ...names) {
  for (const name of names) {
    const value = env[name]?.trim();

    if (value) {
      return value;
    }
  }

  return undefined;
}

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function assertAllowedProjectId(projectId) {
  invariant(projectId, "OUTPOST_NEON_PROJECT_ID is required.");

  const reusedProjectName = DISALLOWED_NEON_PROJECT_IDS.get(projectId);
  invariant(
    !reusedProjectName,
    `Refusing to use existing Neon project ${reusedProjectName} (${projectId}) for Outpost hosted proof. Use the dedicated Outpost Neon project.`
  );
}

function endpointIdFromHost(hostname, serviceMarker) {
  const [endpointId] = hostname.split(`.${serviceMarker}.`);

  return endpointId && endpointId !== hostname ? endpointId : null;
}

function databaseNameFromPath(pathname, suffix) {
  const normalized = pathname.replace(/\/+$/u, "");

  if (!normalized.endsWith(suffix)) {
    return null;
  }

  const prefix = normalized.slice(0, -suffix.length).replace(/^\/+|\/+$/gu, "");

  return prefix || null;
}

export function assertHostedNeonUrl(rawUrl) {
  let url;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_NEON_DATA_API_URL is not a valid URL.");
  }

  const localHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
  invariant(!localHosts.has(url.hostname), "Refusing hosted readiness proof against local Neon.");
  invariant(url.protocol === "https:", "Hosted Neon proof must use an https Neon endpoint URL.");
  invariant(!url.port, "Hosted Neon URL must not include a custom port.");
  invariant(url.pathname.endsWith("/rest/v1"), "Hosted Neon Data API URL must include the database /rest/v1 path.");
  invariant(url.hostname.endsWith(".neon.tech") || url.hostname.endsWith(".neon.co"), "Hosted Neon URL must use a Neon host.");
  invariant(endpointIdFromHost(url.hostname, "apirest"), "Hosted Neon Data API URL must use a branch Data API host.");
  invariant(databaseNameFromPath(url.pathname, "/rest/v1"), "Hosted Neon Data API URL must include a database name before /rest/v1.");

  return url;
}

export function assertHostedNeonAuthUrl(rawUrl) {
  let url;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_NEON_AUTH_URL is not a valid URL.");
  }

  const localHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
  invariant(!localHosts.has(url.hostname), "Refusing hosted readiness proof against local Neon Auth.");
  invariant(url.protocol === "https:", "Hosted Neon Auth proof must use an https endpoint URL.");
  invariant(url.hostname.includes(".neonauth."), "Hosted Neon Auth URL must use a Neon Auth host.");
  invariant(endpointIdFromHost(url.hostname, "neonauth"), "Hosted Neon Auth URL must use a branch Auth host.");
  invariant(databaseNameFromPath(url.pathname, "/auth"), "Hosted Neon Auth URL must include a database name before /auth.");

  return url;
}

export function assertHostedNeonEndpointPair(authUrl, dataApiUrl) {
  const authEndpointId = endpointIdFromHost(authUrl.hostname, "neonauth");
  const dataEndpointId = endpointIdFromHost(dataApiUrl.hostname, "apirest");
  const authDatabase = databaseNameFromPath(authUrl.pathname, "/auth");
  const dataApiDatabase = databaseNameFromPath(dataApiUrl.pathname, "/rest/v1");

  invariant(
    authEndpointId === dataEndpointId,
    "NEXT_PUBLIC_NEON_AUTH_URL and NEXT_PUBLIC_NEON_DATA_API_URL must point to the same Neon branch endpoint."
  );
  invariant(
    authDatabase === dataApiDatabase,
    "NEXT_PUBLIC_NEON_AUTH_URL and NEXT_PUBLIC_NEON_DATA_API_URL must point to the same Neon database."
  );

  return {
    databaseName: authDatabase,
    endpointId: authEndpointId
  };
}

export function assertHostedNeonBranchServiceUrls(config, branch, authStatus, dataApiStatus) {
  invariant(branch?.id, "Unable to load configured Neon branch metadata for hosted proof.");
  invariant(branch?.name === config.branchName, "Configured Neon branch metadata does not match OUTPOST_NEON_BRANCH_NAME.");
  invariant(
    authStatus?.branch_id === branch.id,
    "Configured Neon Auth URL does not belong to the hosted proof branch."
  );
  invariant(
    authStatus?.base_url === config.neonAuthUrl,
    "NEXT_PUBLIC_NEON_AUTH_URL must exactly match the configured branch Neon Auth base_url."
  );
  invariant(
    dataApiStatus?.url === config.neonDataApiUrl,
    "NEXT_PUBLIC_NEON_DATA_API_URL must exactly match the configured branch Neon Data API url."
  );
}

export function readHostedReadinessConfig(env = process.env) {
  const branchName = envValue(env, "OUTPOST_NEON_BRANCH_NAME");
  const projectId = envValue(env, "OUTPOST_NEON_PROJECT_ID");
  const neonAuthUrl = envValue(env, "NEXT_PUBLIC_NEON_AUTH_URL");
  const neonDataApiUrl = envValue(env, "NEXT_PUBLIC_NEON_DATA_API_URL");
  const seedPassword = envValue(env, "OUTPOST_NEON_SEED_PASSWORD");

  assertAllowedProjectId(projectId);
  invariant(branchName, "OUTPOST_NEON_BRANCH_NAME is required for hosted proof.");
  invariant(
    branchName !== "outpost-neon-spike",
    "Refusing to run hosted proof against the Neon migration spike branch. Use a dedicated hosted proof branch."
  );
  invariant(neonAuthUrl, "NEXT_PUBLIC_NEON_AUTH_URL is required.");
  invariant(neonDataApiUrl, "NEXT_PUBLIC_NEON_DATA_API_URL is required.");
  invariant(
    seedPassword,
    "OUTPOST_NEON_SEED_PASSWORD is required. Use the rotated hosted seed password, not the local seed password."
  );
  invariant(
    seedPassword !== "outpost-local-password",
    "Refusing the local seed password for hosted proof. Rotate the hosted seed password first."
  );
  const parsedAuthUrl = assertHostedNeonAuthUrl(neonAuthUrl);
  const parsedDataApiUrl = assertHostedNeonUrl(neonDataApiUrl);
  const { databaseName } = assertHostedNeonEndpointPair(parsedAuthUrl, parsedDataApiUrl);

  return {
    branchName,
    databaseName,
    neonAuthUrl,
    neonDataApiUrl,
    projectId,
    seedPassword
  };
}

export const assertAllowedProjectRef = assertAllowedProjectId;
