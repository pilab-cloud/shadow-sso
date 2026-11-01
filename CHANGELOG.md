# Changelog

## 0.1.0

Initial public release.

- Iframe-based silent login against Shadow SSO `/oauth2/silent-authorize`
- Frame-policy preflight for `Content-Security-Policy` and `X-Frame-Options`
- Typed `SilentLoginError` codes, including `origin_not_allowed` and `frame_blocked`
- `postMessage` origin and state validation
- PKCE `S256` helper
- `AbortSignal` and timeout support
- ESM, CJS and TypeScript declarations
