# Changelog

## 0.4.0

- Added `fedcmLogin()` and `isFedCMSupported()` for FedCM sign-in against
  Shadow SSO's `/fedcm/config.json`, plus the `not_supported` error code.

## 0.3.1

- Use a constructed `CSSStyleSheet` (`adoptedStyleSheets`) for the one-tap
  card, with a `<style>` fallback for older browsers, improving compatibility
  with strict site CSPs.

## 0.3.0

- Added automatic sign-in for the one-tap card (`autoSelect`, default 5s delay).
- Added automatic sign-out state: `disableAutoSelect()`, `enableAutoSelect()`,
  `isAutoSelectDisabled()`, with a `sso_auto_select` cookie.
- Cancelling the one-tap card disables automatic sign-in for one day.
- Added `stateCookieDomain` for sharing the sign-out state across subdomains.
- Successful sign-in clears the disabled state.

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
