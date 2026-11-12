# Security Headers

Outpost applies one response-header policy from `next.config.mjs` to every
route. Production blocks framing, objects, non-self forms/base URLs, browser
permissions, MIME sniffing, and non-HTTPS transport after HSTS is learned.
Browser connections are limited to self plus the exact configured HTTPS Neon
Auth and Data API origins.

Next.js currently requires inline bootstrap scripts, so production
`script-src` includes `'unsafe-inline'`. Development alone also includes
`'unsafe-eval'` for React diagnostics. Treat `'unsafe-inline'` as a known CSP
limitation: do not add inline event handlers or customer-authored HTML, and
move to request-scoped nonces before introducing any surface that renders
untrusted markup. Protected Preview browser proof must cover sign-in and data
loading whenever the auth/client integration changes.

CSP reporting is deferred until Outpost has an approved telemetry endpoint and
retention policy. Do not send violation reports containing page URLs or request
context to an unreviewed third party.
