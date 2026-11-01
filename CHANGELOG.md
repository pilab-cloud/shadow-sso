# Changelog

## 0.2.0

- Added `mountOneTap()` / `mountOneClick()`: a Google One Tap-style corner card
  with Shadow DOM isolation, account avatar/initials, themes and placements.
- Added `checkSilentSession()`: session/user check without issuing a code.
- Added `mode=session` support to the silent-authorize flow.
- Silent login results now include optional user info (`id`, `email`, `name`).

## 0.1.0

Initial public release.

- Iframe-based silent login against Shadow SSO `/oauth2/silent-authorize`
- Frame-policy preflight for `Content-Security-Policy` and `X-Frame-Options`
- Typed `SilentLoginError` codes, including `origin_not_allowed` and `frame_blocked`
- `postMessage` origin and state validation
- PKCE `S256` helper
- `AbortSignal` and timeout support
- ESM, CJS and TypeScript declarations
