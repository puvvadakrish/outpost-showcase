export function withNeonApiKey(args, env = process.env) {
  const apiKey = env.NEON_API_KEY?.trim();

  if (!apiKey) {
    return args;
  }

  const separatorIndex = args.indexOf("--");

  if (separatorIndex === -1) {
    return [...args, "--api-key", apiKey];
  }

  return [
    ...args.slice(0, separatorIndex),
    "--api-key",
    apiKey,
    ...args.slice(separatorIndex)
  ];
}
