const AUTO_SELECT_COOKIE = "sso_auto_select";
const DEFAULT_DISABLED_DAYS = 1;

export interface AutoSelectStateOptions {
  /** Cookie domain, for example ".pilab.hu" to share the state across subdomains. */
  domain?: string;
  /** How long automatic sign-in stays disabled. Defaults to 1 day. */
  days?: number;
  /** Force the Secure attribute. Defaults to true on HTTPS pages. */
  secure?: boolean;
}

function isSecure(options?: AutoSelectStateOptions): boolean {
  if (typeof options?.secure === "boolean") {
    return options.secure;
  }
  return typeof location !== "undefined" && location.protocol === "https:";
}

function cookiePath(options?: AutoSelectStateOptions): string {
  const parts = ["Path=/", "SameSite=Lax"];
  if (isSecure(options)) {
    parts.push("Secure");
  }
  if (options?.domain) {
    parts.push(`Domain=${options.domain}`);
  }
  return parts.join("; ");
}

/**
 * Disables One Tap automatic sign-in for this browser (default: one day).
 * Call this when the user signs out of your site to prevent an automatic
 * sign-in loop.
 */
export function disableAutoSelect(options?: AutoSelectStateOptions): void {
  if (typeof document === "undefined") {
    return;
  }
  const days = Math.max(1, options?.days ?? DEFAULT_DISABLED_DAYS);
  const maxAge = Math.floor(days * 24 * 60 * 60);
  document.cookie = `${AUTO_SELECT_COOKIE}=0; ${cookiePath(options)}; Max-Age=${maxAge}`;
}

/**
 * Re-enables automatic sign-in. The one-tap widget calls this after a
 * successful manual or automatic sign-in.
 */
export function enableAutoSelect(options?: AutoSelectStateOptions): void {
  if (typeof document === "undefined") {
    return;
  }
  document.cookie = `${AUTO_SELECT_COOKIE}=; ${cookiePath(options)}; Max-Age=0`;
}

/** Returns true when automatic sign-in was disabled by a sign-out. */
export function isAutoSelectDisabled(): boolean {
  if (typeof document === "undefined") {
    return true;
  }
  return document.cookie
    .split(";")
    .some((part) => part.trim().startsWith(`${AUTO_SELECT_COOKIE}=`));
}
