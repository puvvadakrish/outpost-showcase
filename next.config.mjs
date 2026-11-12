export function buildContentSecurityPolicy(environment, config = process.env) {
  const scriptSource =
    environment === "development"
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'";
  const configuredConnectOrigins = [
    config.NEXT_PUBLIC_NEON_AUTH_URL,
    config.NEXT_PUBLIC_NEON_DATA_API_URL
  ]
    .flatMap((value) => {
      try {
        const url = new URL(value ?? "");
        return url.protocol === "https:" ? [url.origin] : [];
      } catch {
        return [];
      }
    })
    .filter((value, index, values) => values.indexOf(value) === index);
  const connectSource = ["connect-src 'self'", ...configuredConnectOrigins].join(" ");

  return [
    "default-src 'self'",
    "base-uri 'self'",
    connectSource,
    "font-src 'self' data:",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data: blob:",
    "object-src 'none'",
    scriptSource,
    "style-src 'self' 'unsafe-inline'",
    "upgrade-insecure-requests"
  ].join("; ");
}

const contentSecurityPolicy = buildContentSecurityPolicy(process.env.NODE_ENV);

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" }
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ headers: securityHeaders, source: "/(.*)" }];
  }
};

export default nextConfig;
