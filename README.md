# @pilab/shadow-sso-silent-login

[![npm version](https://img.shields.io/npm/v/@pilab/shadow-sso-silent-login.svg)](https://www.npmjs.com/package/@pilab/shadow-sso-silent-login)
[![CI](https://github.com/pilab-cloud/shadow-sso-silent-login/actions/workflows/ci.yml/badge.svg)](https://github.com/pilab-cloud/shadow-sso-silent-login/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@pilab/shadow-sso-silent-login.svg)](./LICENSE)

Iframe-based silent login for **Shadow SSO**.

The SDK loads the SSO `/oauth2/silent-authorize` endpoint in a hidden iframe,
waits for a validated `postMessage`, and resolves with an authorization code or
a typed `SilentLoginError`.

It has **no runtime dependencies** and ships ESM, CJS and TypeScript
declarations.

## Features

- Hidden iframe silent authentication (`prompt=none` semantics)
- Strict `event.origin` and `state` validation
- `postMessage` target derived from the registered redirect URI origin
- Frame-policy preflight: checks `Content-Security-Policy` and
  `X-Frame-Options` **before** creating the iframe
- Typed errors: `login_required`, `consent_required`, `origin_not_allowed`,
  `frame_blocked`, `timeout`, `aborted`, and more
- PKCE `S256` verifier/challenge helper
- `AbortSignal` support and configurable timeout
- ESM + CJS + `.d.ts`
- Works with Shadow SSO's `/oauth2/silent-authorize` endpoint

## Install

```bash
pnpm add @pilab/shadow-sso-silent-login
# or
npm install @pilab/shadow-sso-silent-login
# or
yarn add @pilab/shadow-sso-silent-login
```

## Quick start

```ts
import {
  generatePkcePair,
  isSilentLoginError,
  silentLogin,
} from "@pilab/shadow-sso-silent-login";

const pkce = await generatePkcePair();
sessionStorage.setItem("sso_pkce_verifier", pkce.verifier);

try {
  const { code, state } = await silentLogin({
    issuer: "https://sso.pilab.hu",
    clientId: "my-app",
    redirectUri: "https://app.pilab.hu/auth/callback",
    scope: "openid profile email",
    codeChallenge: pkce.challenge,
    codeChallengeMethod: "S256",
    timeoutMs: 8000,
  });

  // Exchange `code` at POST /oauth2/token.
  // For a public SPA, send the stored code_verifier as well.
  // A backend/BFF can perform the exchange instead.
  console.log("silent login code", code, state);
} catch (error) {
  if (isSilentLoginError(error)) {
    switch (error.code) {
      case "login_required":
        // No active SSO session: show the normal login button.
        break;
      case "consent_required":
        // Start the normal top-level /oauth2/authorize flow.
        break;
      case "origin_not_allowed":
        // The parent origin does not match the redirect URI origin.
        break;
      case "frame_blocked":
        // CSP/X-Frame-Options rejected the iframe before it was created.
        break;
      case "timeout":
        // The iframe did not answer (third-party cookies, CSP, network, ...).
        break;
    }
  }
}
```

## API

### `silentLogin(options): Promise<SilentLoginSuccess>`

Builds the silent-authorize URL, runs the frame-policy preflight (unless
disabled), inserts the hidden iframe, validates the response, and resolves with
`{ code, state }`.

### `buildSilentAuthorizeUrl(options): SilentAuthorizeUrl`

Builds the iframe URL without touching the DOM. Useful for advanced
integrations and tests.

```ts
const { url, state, origin, parentOrigin } = buildSilentAuthorizeUrl(options);
```

### `preflightSilentAuthorize(options): Promise<void>`

Runs only the frame-policy preflight. Throws `SilentLoginError` with
`code: "frame_blocked"` when the SSO response headers forbid framing.

### `generatePkcePair(): Promise<PkcePair>`

Generates a PKCE verifier and an `S256` challenge using Web Crypto.

```ts
const { verifier, challenge, method } = await generatePkcePair();
```

### `isSilentLoginError(value)`

Type guard for `SilentLoginError`.

## Options

| Option | Required | Description |
| --- | --- | --- |
| `issuer` | yes | SSO base URL, for example `https://sso.pilab.hu` |
| `clientId` | yes | OAuth client ID |
| `redirectUri` | yes | Registered redirect URI on the application origin |
| `scope` | no | Defaults to `openid profile email` |
| `state` | no | Generated when omitted; returned on success |
| `nonce` | no | OIDC nonce |
| `codeChallenge` | no | PKCE challenge; use `generatePkcePair()` |
| `codeChallengeMethod` | no | `S256` (default) or `plain` |
| `parentOrigin` | no | Defaults to `window.location.origin`; in the browser it must match the page origin |
| `preflight` | no | Check the SSO frame policy headers before creating the iframe; defaults to `true` |
| `timeoutMs` | no | Defaults to `10000` |
| `extraParams` | no | Additional query parameters; critical parameters cannot be overridden |
| `iframeTitle` | no | Accessible iframe title |
| `signal` | no | `AbortSignal` for cancellation |

## Result and errors

On success:

```ts
{ code: string, state: string }
```

Failures reject with `SilentLoginError`:

| Code | Meaning |
| --- | --- |
| `login_required` | No active SSO session |
| `consent_required` | Logged in, but the client requires consent |
| `origin_not_allowed` | Parent origin differs from the registered redirect URI origin |
| `frame_blocked` | CSP `frame-ancestors` or `X-Frame-Options` blocks the iframe |
| `frame_error` | The iframe failed to load |
| `timeout` | The iframe did not answer in time |
| `aborted` | The supplied `AbortSignal` was aborted |
| `access_denied` | The authorization request was denied |
| `invalid_request` | Invalid silent login request |
| `invalid_client` | Invalid or inactive OAuth client |
| `invalid_scope` | Requested scope is not allowed |
| `server_error` | The SSO could not complete silent login |
| `not_browser` | Browser or Web Crypto APIs are unavailable |
| `invalid_config` | Invalid issuer, redirect URI, parent origin, timeout or preflight response |

## Frame-policy preflight

Before inserting the iframe, the SDK sends a `HEAD` request to the
silent-authorize URL and reads:

- `Content-Security-Policy` (`frame-ancestors`)
- `X-Frame-Options`

If either header blocks the parent origin, the SDK logs a `console.error` and
throws `frame_blocked` **before** creating the iframe.

The SSO must expose those headers through CORS:

```
Access-Control-Expose-Headers: Content-Security-Policy, X-Frame-Options
```

Shadow SSO's `/oauth2/silent-authorize` does this automatically for the matching
`parent_origin`.

If the preflight request fails (network, CORS, or an older SSO returning
404/405), the SDK logs a `console.warn` and continues with the iframe. The
normal `timeout` path still applies if the browser then blocks the iframe.

Set `preflight: false` to skip this check.

## Origin handling

The SDK sends `parent_origin` to the SSO. The SSO page is frameable only by that
origin. If it does not match the registered `redirect_uri` origin, the SSO posts:

```json
{ "type": "sso-silent-result", "state": "...", "error": "origin_not_allowed" }
```

and never issues an authorization code.

The `redirectUri` and the page hosting the SDK must be on the same origin.

## Parent page requirements

Allow the SSO origin in the parent page's CSP:

```html
<meta
  http-equiv="Content-Security-Policy"
  content="frame-src https://sso.pilab.hu"
/>
```

The SDK creates a zero-size off-screen iframe so browsers still load and
execute it.

## PKCE and token exchange

Use `generatePkcePair()` and keep the verifier:

```ts
const pkce = await generatePkcePair();
sessionStorage.setItem("sso_pkce_verifier", pkce.verifier);

const { code } = await silentLogin({
  issuer: "https://sso.pilab.hu",
  clientId: "my-app",
  redirectUri: "https://app.pilab.hu/auth/callback",
  codeChallenge: pkce.challenge,
  codeChallengeMethod: "S256",
});

await fetch("https://sso.pilab.hu/oauth2/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    client_id: "my-app",
    redirect_uri: "https://app.pilab.hu/auth/callback",
    code,
    code_verifier: sessionStorage.getItem("sso_pkce_verifier")!,
  }),
});
```

For confidential clients, perform the exchange on the backend/BFF and send only
the authorization code from the browser.

## Browser caveats

- Same-site applications (for example `app.pilab.hu` and `sso.pilab.hu`) work
  with the normal OP session cookie.
- Cross-site iframe silent login depends on the browser's third-party cookie
  policy. Browsers that block third-party cookies may return `login_required`
  or `timeout`.
- Silent login is not a replacement for the interactive OIDC flow. Use it to
  check for an existing session, then fall back to the normal
  `/oauth2/authorize` redirect when it fails.

## Security

- Validates `event.origin` against the SSO issuer origin.
- Validates the `state` value on every message.
- Ignores messages from other windows when the browser exposes `event.source`.
- Uses `postMessage` with an explicit target origin, never `"*"`.
- Never exposes the authorization code in a URL or in the parent document.
- Removes the iframe and all listeners after completion, timeout or abort.

Please report security issues privately to `gyula@pilab.hu`.

## Development

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build
pnpm pack
```

`tsup` emits `dist/index.mjs`, `dist/index.cjs` and `dist/index.d.ts`.

CI runs on GitHub-hosted `ubuntu-latest`.

## Release

See [RELEASE.md](./RELEASE.md) for the full checklist.

For the GitHub Actions publish workflow, add an npm automation token as the
`NPM_TOKEN` repository secret. The npm user must have publish access to the
`@pilab` scope.

```bash
pnpm version patch   # or minor / major
git push --follow-tags
pnpm publish --access public
```

The package is published as a public scoped package:

```
@pilab/shadow-sso-silent-login
```

## License

MIT © [Progressive Innovation LAB](https://pilab.hu)

Author: Paal Gyula `<gyula@pilab.hu>`
