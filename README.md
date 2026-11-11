<div align="center">

# @pilab/shadow-sso

**One Tap sign-in for your own identity provider, without the iframe.**

[![npm version](https://img.shields.io/npm/v/@pilab/shadow-sso.svg?logo=npm&color=6d5efc)](https://www.npmjs.com/package/@pilab/shadow-sso)
[![npm downloads](https://img.shields.io/npm/dm/@pilab/shadow-sso.svg?color=22d3ee)](https://www.npmjs.com/package/@pilab/shadow-sso)
[![CI](https://github.com/pilab-cloud/shadow-sso/actions/workflows/ci.yml/badge.svg)](https://github.com/pilab-cloud/shadow-sso/actions/workflows/ci.yml)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@pilab/shadow-sso?label=minzipped)](https://bundlephobia.com/package/@pilab/shadow-sso)
[![types](https://img.shields.io/npm/types/@pilab/shadow-sso.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](./package.json)
[![FedCM](https://img.shields.io/badge/FedCM-ready-4285f4.svg?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/identity/fedcm/overview)
[![OpenID Connect](https://img.shields.io/badge/OpenID%20Connect-compatible-f78c40.svg?logo=openid&logoColor=white)](https://openid.net/connect/)
[![license](https://img.shields.io/npm/l/@pilab/shadow-sso.svg)](./LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-ff69b4.svg)](https://github.com/pilab-cloud/shadow-sso/pulls)

<img src="./docs/assets/fedcm-one-tap.png" alt="Shadow SSO FedCM One Tap: browser-native account chooser" width="860">

<sub>Illustration of the browser-native FedCM prompt shown by `fedcmLogin()`.</sub>

</div>

## Why Shadow SSO One Tap?

Google One Tap made sign-in a single click, but it ties you to Google's
identity and, historically, to iframes and third-party cookies, which browsers
are removing. Shadow SSO gives you the same experience against **your own**
OpenID Connect provider, with two modern building blocks:

- **FedCM** (`fedcmLogin`): the browser shows the account chooser. No iframe, no
  third-party cookies, no popup that can be spoofed.
- **Silent login + One Tap card** (`silentLogin`, `mountOneTap`): a hidden-iframe
  fallback with strict origin checks for browsers without FedCM.

### Advantages over other SSO options

| | Shadow SSO | Google One Tap | Keycloak (keycloak-js) | Auth0 / Okta widgets |
|---|:--:|:--:|:--:|:--:|
| Self-hosted, you own the users | ✅ | ❌ Google accounts only | ✅ | ❌ SaaS |
| FedCM (no iframe, no 3P cookies) | ✅ | ✅ | ❌ relies on an iframe session check | ⚠️ varies |
| One Tap style prompt for your own IdP | ✅ | ✅ | ❌ | ⚠️ paid tiers / redirects |
| Zero runtime dependencies | ✅ | n/a (remote script) | ❌ | ❌ |
| Tiny, tree-shakeable ESM + CJS + types | ✅ | ❌ remote script | ⚠️ larger | ⚠️ larger |
| Frame-policy preflight and typed errors | ✅ | ❌ | ❌ | ❌ |
| No third-party script loaded at runtime | ✅ | ❌ | ✅ | ❌ |
| Per-vendor pricing / user limits | none | none | none | ⚠️ yes |

<sub>Comparison is a summary of default, documented behaviour at the time of
writing; products evolve, so verify against their current docs.</sub>

**In short:** the One Tap UX you know, on infrastructure you control, built for
a world without third-party cookies.

Official JavaScript/TypeScript helper for **Shadow SSO**.

This package is the home for Shadow SSO browser helpers. The first module is
iframe-based silent login: it loads the SSO `/oauth2/silent-authorize` endpoint
in a hidden iframe, waits for a validated `postMessage`, and resolves with an
authorization code or a typed `SilentLoginError`.

It has **no runtime dependencies** and ships ESM, CJS and TypeScript
declarations.

## Features

- Umbrella package for Shadow SSO JavaScript/TypeScript helpers
- Google One Tap-style corner card (`mountOneTap`)
- Automatic sign-in and sign-out state (`autoSelect`, `disableAutoSelect`)
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
- FedCM sign-in (`fedcmLogin`): browser-mediated One Tap alternative with no
  iframe or third-party cookies (requires Shadow SSO's `/fedcm/*` endpoints)

## FedCM: usage in depth

### How it works

```
 Browser                         Your app                    Shadow SSO
    | fedcmLogin() ----------------------------------------> /fedcm/config.json
    |<------------------------- native account chooser ----- /fedcm/accounts (cookie)
    | user taps "Continue" -----------------------------------> /fedcm/assertion
    |<------------------------- { token: <ID token> } -------- (nonce-bound)
    | POST token + nonce -----------> verify (JWKS, aud, nonce) -> your session
```

1. Register your app as a client in Shadow SSO; its redirect URI origins define
   which page origins may use FedCM.
2. Call `fedcmLogin()` from that origin.
3. Send the returned ID token and nonce to **your backend** and verify it there.

### 1. Minimal

```ts
import { fedcmLogin, isFedCMSupported } from "@pilab/shadow-sso";

if (isFedCMSupported()) {
  const { token, nonce } = await fedcmLogin({
    issuer: "https://sso.pilab.hu",
    clientId: "my-app",
  });
  await fetch("/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, nonce }),
  });
}
```

### 1b. Active mode (button flow)

FedCM has two UX modes. Passive mode (the default) can run without direct user
interaction and is used for One Tap/silent checks. Active mode must be started
from a transient user gesture, such as clicking a "Sign in with SSO" button, and
uses the browser's button-flow UI.

```ts
button.addEventListener("click", async () => {
  const { token, nonce } = await fedcmLogin({
    issuer: "https://sso.pilab.hu",
    clientId: "my-app",
    mode: "active",
    context: "signin",
  });
  await fetch("/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, nonce }),
  });
});
```

`mode` is supported from Chrome 132. Older browsers ignore it and use passive
mode. Shadow SSO supports both flows: the IdP config advertises
`supports_use_other_account`, and its `login_url` serves an isolated login flow
that closes the browser's FedCM dialog with `IdentityProvider.close()`.

### 2. Best practice: server-issued nonce and graceful fallback

Let the server mint the nonce so a stolen token cannot be replayed, and fall
back to the iframe card when FedCM is unavailable or declined.

```ts
import {
  fedcmLogin,
  isFedCMSupported,
  isSilentLoginError,
  mountOneTap,
} from "@pilab/shadow-sso";

const issuer = "https://sso.pilab.hu";
const clientId = "my-app";

async function signIn(): Promise<void> {
  const { nonce } = await (await fetch("/api/nonce", { method: "POST" })).json();

  if (isFedCMSupported()) {
    try {
      const { token } = await fedcmLogin({ issuer, clientId, nonce, context: "continue" });
      await fetch("/api/session", { method: "POST", body: JSON.stringify({ token }) });
      return location.reload();
    } catch (error) {
      if (!isSilentLoginError(error) || error.code === "aborted") return;
      // login_required / server_error: fall through to the card.
    }
  }

  mountOneTap({
    issuer,
    clientId,
    redirectUri: `${location.origin}/auth/callback`,
    appName: "My App",
    onLogin: ({ code }) => (location.href = `/auth/callback?code=${code}`),
  });
}
```

### 3. Auto sign-in on page load (no UI when possible)

```ts
const controller = new AbortController();
try {
  const { token } = await fedcmLogin({
    issuer, clientId, mediation: "silent", signal: controller.signal,
  });
  // returning user, signed in without any prompt
} catch {
  // not signed in: show your regular button
}
```

### 4. React hook

```tsx
import { useEffect, useState } from "react";
import { fedcmLogin, isFedCMSupported } from "@pilab/shadow-sso";

export function useShadowSso(issuer: string, clientId: string) {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    if (!isFedCMSupported()) return;
    const ac = new AbortController();
    fedcmLogin({ issuer, clientId, mediation: "optional", signal: ac.signal })
      .then((r) => setToken(r.token))
      .catch(() => {});
    return () => ac.abort();
  }, [issuer, clientId]);
  return token;
}
```

### 5. Verify the ID token on the server (Node, `jose`)

```ts
import { createRemoteJWKSet, jwtVerify } from "jose";

const jwks = createRemoteJWKSet(new URL("https://sso.pilab.hu/.well-known/jwks.json"));

export async function verify(token: string, expectedNonce: string) {
  const { payload } = await jwtVerify(token, jwks, {
    issuer: "https://sso.pilab.hu",
    audience: "my-app",
  });
  if (payload.nonce !== expectedNonce) throw new Error("nonce mismatch");
  return payload; // sub, email, name ...
}
```

### 6. Next.js route handler

```ts
// app/api/session/route.ts
import { cookies } from "next/headers";
import { verify } from "@/lib/verify";

export async function POST(req: Request) {
  const { token } = await req.json();
  const jar = await cookies();
  const nonce = jar.get("sso_nonce")?.value ?? "";
  const claims = await verify(token, nonce);
  jar.set("session", await createSession(claims.sub!), { httpOnly: true, secure: true, sameSite: "lax" });
  return Response.json({ ok: true });
}
```

### Error handling

| Code | Meaning | Suggested action |
|---|---|---|
| `not_supported` | Browser has no FedCM | Use `mountOneTap` / `silentLogin` |
| `login_required` | No account, dismissed, or SSO session missing | Show your normal login |
| `aborted` | `AbortSignal` fired | Ignore |
| `invalid_config` | Missing `issuer` / `clientId` | Fix configuration |
| `server_error` | IdP rejected the request (for example the origin is not registered) | Check client registration |

### Requirements

- HTTPS (FedCM also works on `localhost`).
- `/.well-known/web-identity` reachable at the registrable domain root of the
  Shadow SSO issuer. For `https://sso.pilab.hu`, that is
  `https://pilab.hu/.well-known/web-identity` (not the issuer subdomain).
- The page origin must match an origin of the client's registered redirect URIs.
- Verify tokens server-side: never trust the token in the browser.

## Install

```bash
pnpm add @pilab/shadow-sso
# or
npm install @pilab/shadow-sso
# or
yarn add @pilab/shadow-sso
```

## Quick start

```ts
import {
  generatePkcePair,
  isSilentLoginError,
  silentLogin,
} from "@pilab/shadow-sso";

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

## One-tap corner login

`mountOneTap()` renders a Google One Tap-style card in a page corner. It checks
the SSO session once, shows the signed-in account when a session exists, and
only requests a fresh authorization code when the user clicks **Continue**.

```ts
import { mountOneTap } from "@pilab/shadow-sso";

const controller = mountOneTap({
  issuer: "https://sso.pilab.hu",
  clientId: "my-app",
  redirectUri: "https://app.pilab.hu/auth/callback",
  appName: "My App",
  position: "top-right",
  onLogin: async ({ code, state }) => {
    // Exchange the code at /oauth2/token (or send it to your BFF).
    await fetch("/auth/sso/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, state }),
    });
  },
  onLoginRequired: () => {
    // Optional: show the site's normal login button.
  },
});

// Later:
// controller.refresh();
// controller.destroy();
```

The card is rendered inside a Shadow DOM, so site CSS cannot leak into it and
the widget cannot style the host page. It is hidden when there is no SSO
session, when the client requires consent, or when the frame policy blocks it.

One-tap options extend `SilentLoginOptions` with:

| Option | Description |
| --- | --- |
| `onLogin` | Required; called with `{ code, state, user }` after a click |
| `onLoginRequired` | No active SSO session |
| `onConsentRequired` | Logged in, but interactive consent is required |
| `onError` | Network, frame-policy or server failure |
| `onDismiss` | User closed the card |
| `position` | `top-right` (default), `top-left`, `bottom-right`, `bottom-left` |
| `theme` | `auto` (default; Pilab dark palette, light when the OS prefers it), `light`, `dark`. Override the accent with the `--sso-primary` CSS variable. |
| `appName` | Shown as “Sign in to …” |
| `buttonText` | Defaults to `Continue as {name}` |
| `zIndex` | Defaults to `2147483000` |
| `target` | Mount element or selector; defaults to `document.body` |
| `dismissible` | Defaults to `true` |
| `autoSelect` | Automatically sign in after `autoSelectDelayMs`; defaults to `false` |
| `autoSelectDelayMs` | Delay before automatic sign-in; defaults to `5000` |
| `stateCookieDomain` | Cookie domain for the sign-out state, e.g. `.pilab.hu` |

The initial check uses `mode=session` and does **not** create an authorization
code. The code is generated only when the user clicks Continue or automatic
sign-in fires.

## Automatic sign-in and sign-out

This mirrors Google One Tap without FedCM:

- With `autoSelect: true`, the card is shown and, if the user does not dismiss
  it within `autoSelectDelayMs` (default 5 seconds), the SDK obtains a code and
  calls `onLogin` automatically.
- Dismissing the card cancels automatic sign-in and disables it for one day.
- On logout, call `disableAutoSelect()` before navigating away. This prevents an
  automatic sign-in loop when the user returns to a One Tap page.
- A successful manual or automatic sign-in clears the disabled state.

```ts
import {
  disableAutoSelect,
  mountOneTap,
} from "@pilab/shadow-sso";

const controller = mountOneTap({
  issuer: "https://sso.pilab.hu",
  clientId: "my-app",
  redirectUri: "https://app.pilab.hu/auth/callback",
  appName: "My App",
  autoSelect: true,
  autoSelectDelayMs: 5000,
  stateCookieDomain: ".pilab.hu",
  onLogin: async ({ code }) => {
    await exchangeCodeAtBackend(code);
  },
});

// On logout:
function logout() {
  disableAutoSelect({ domain: ".pilab.hu" });
  window.location.href = "/logout";
}
```

The disabled state is stored in a `sso_auto_select` cookie for one day. Set
`stateCookieDomain` to your parent domain (for example `.pilab.hu`) when One Tap
is used on multiple subdomains, otherwise each subdomain keeps its own state.

`enableAutoSelect()` clears the state if you need to re-enable it manually.

**Important:** automatic sign-in must be disabled when the user signs out,
otherwise a post-logout One Tap page can sign them straight back in — the same
dead-loop Google warns about.

## API

### `silentLogin(options): Promise<SilentLoginSuccess>`

Builds the silent-authorize URL, runs the frame-policy preflight (unless
disabled), inserts the hidden iframe, validates the response, and resolves with
`{ code, state, user? }`.

### `checkSilentSession(options): Promise<SilentSessionCheckResult>`

Checks whether the browser has an active SSO session **without issuing an
authorization code**. Resolves with `{ authenticated: true, user?, state }` or
rejects with `SilentLoginError` (`login_required`, `consent_required`, …).

### `mountOneTap(options): OneTapController`

Mounts the corner card. Returns `{ refresh, destroy }`.

### `disableAutoSelect(options?)`

Disables automatic sign-in for one day (or `options.days`). Use it on logout.
`options.domain` shares the state across subdomains.

### `enableAutoSelect(options?)`

Clears the disabled state. The one-tap card calls this after a successful
sign-in.

### `isAutoSelectDisabled()`

Returns whether automatic sign-in is currently disabled.

### `buildSilentAuthorizeUrl(options, mode?): SilentAuthorizeUrl`

Builds the iframe URL without touching the DOM. Useful for advanced
integrations and tests.

```ts
const { url, state, origin, parentOrigin } = buildSilentAuthorizeUrl(options);

// Session check URL (no authorization code):
const { url: sessionUrl } = buildSilentAuthorizeUrl(options, "session");
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

The one-tap card is rendered in a Shadow DOM. Modern browsers use a constructed
stylesheet (`adoptedStyleSheets`); older browsers fall back to a `<style>`
element, which may require `style-src 'unsafe-inline'` in a strict CSP.

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
@pilab/shadow-sso
```

## License

MIT © [Progressive Innovation LAB](https://pilab.hu)

Author: Paal Gyula `<gyula@pilab.hu>`
