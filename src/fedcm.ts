import { randomHex } from "./crypto.js";
import { SilentLoginError } from "./errors.js";

export interface FedCMLoginOptions {
  /** SSO issuer/base URL, for example https://sso.pilab.hu */
  issuer: string;
  /** OAuth client id registered in Shadow SSO */
  clientId: string;
  /** Nonce bound to the ID token. A random one is generated when omitted. */
  nonce?: string;
  /**
   * "silent" never shows UI and fails with login_required when the user must
   * choose; "optional" (default) lets the browser decide; "required" always asks.
   */
  mediation?: "silent" | "optional" | "required";
  /**
   * FedCM UX mode. "active" requires a user gesture (for example a button
   * click); "passive" (the browser default) can be invoked without direct
   * user interaction. Supported from Chrome 132.
   */
  mode?: "active" | "passive";
  /** Wording of the browser prompt. */
  context?: "signin" | "signup" | "use" | "continue";
  /** Optional cancellation signal */
  signal?: AbortSignal;
}

export interface FedCMLoginResult {
  /** ID token issued by Shadow SSO. Verify it server-side (JWKS, aud, nonce). */
  token: string;
  nonce: string;
}

/** Returns true when the browser exposes the FedCM API. */
export function isFedCMSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    "credentials" in navigator &&
    typeof (window as unknown as { IdentityCredential?: unknown }).IdentityCredential !== "undefined"
  );
}

/**
 * Signs in through the browser-mediated FedCM flow: no iframe and no
 * third-party cookies. Resolves with an ID token.
 */
export async function fedcmLogin(options: FedCMLoginOptions): Promise<FedCMLoginResult> {
  if (!options.issuer || !options.clientId) {
    throw new SilentLoginError("invalid_config", "issuer and clientId are required");
  }
  if (!isFedCMSupported()) {
    throw new SilentLoginError("not_supported");
  }
  const nonce = options.nonce ?? randomHex(16);
  const configURL = `${options.issuer.replace(/\/+$/, "")}/fedcm/config.json`;

  const identity: Record<string, unknown> = {
    context: options.context,
    providers: [{ configURL, clientId: options.clientId, nonce }],
  };
  if (options.mode) {
    identity.mode = options.mode;
  }

  const request: Record<string, unknown> = {
    identity,
    mediation: options.mediation ?? "optional",
    signal: options.signal,
  };

  let credential: Credential | null;
  try {
    credential = await navigator.credentials.get(request as CredentialRequestOptions);
  } catch (error) {
    const name = (error as { name?: string })?.name;
    if (name === "AbortError") {
      throw new SilentLoginError("aborted");
    }
    if (name === "NetworkError") {
      // The user dismissed the prompt, has no account, or login is required.
      throw new SilentLoginError("login_required", "No FedCM account was selected.");
    }
    throw new SilentLoginError("server_error", (error as Error)?.message);
  }

  const token = (credential as { token?: string } | null)?.token;
  if (!token) {
    throw new SilentLoginError("login_required", "No FedCM credential was returned.");
  }
  return { token, nonce };
}
