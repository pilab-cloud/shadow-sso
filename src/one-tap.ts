import { SilentLoginError, isSilentLoginError } from "./errors.js";
import { checkSilentSession, silentLogin } from "./silent-login.js";
import type {
  SilentLoginOptions,
  SilentLoginSuccess,
  SilentLoginUser,
} from "./types.js";

export type OneTapPosition = "top-right" | "top-left" | "bottom-right" | "bottom-left";
export type OneTapTheme = "light" | "dark" | "auto";

export interface OneTapOptions extends SilentLoginOptions {
  /** Called with a fresh authorization code when the user clicks Continue. */
  onLogin: (result: SilentLoginSuccess) => void | Promise<void>;
  /** Called when no active SSO session exists. The widget stays hidden. */
  onLoginRequired?: () => void;
  /** Called when the user is logged in but the client requires consent. */
  onConsentRequired?: () => void;
  /** Called for unexpected failures (network, frame policy, server error). */
  onError?: (error: SilentLoginError) => void;
  /** Called when the user dismisses the widget. */
  onDismiss?: () => void;
  /** Corner placement, defaults to top-right. */
  position?: OneTapPosition;
  /** Color theme, defaults to auto. */
  theme?: OneTapTheme;
  /** Application name shown in the widget header. */
  appName?: string;
  /** Button label. Supports {name}. Defaults to "Continue as {name}". */
  buttonText?: string;
  /** Stacking order, defaults to 2147483000. */
  zIndex?: number;
  /** Mount target, defaults to document.body. */
  target?: HTMLElement | string;
  /** Show the dismiss button, defaults to true. */
  dismissible?: boolean;
}

export interface OneTapController {
  /** Re-checks the SSO session and updates the widget. */
  refresh: () => Promise<void>;
  /** Removes the widget and aborts any in-flight request. */
  destroy: () => void;
}

const DEFAULT_Z_INDEX = 2147483000;

const STYLES = `
  :host {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  *, *::before, *::after { box-sizing: border-box; }
  .card {
    --bg: #ffffff;
    --text: #202124;
    --muted: #5f6368;
    --border: #dadce0;
    --accent: #1a73e8;
    --accent-hover: #1765cc;
    --accent-text: #ffffff;
    --error-bg: #fce8e6;
    --error-text: #c5221f;
    width: 360px;
    max-width: calc(100vw - 32px);
    background: var(--bg);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
    font-size: 14px;
    line-height: 1.4;
    overflow: hidden;
  }
  .card[data-theme="dark"] {
    --bg: #202124;
    --text: #e8eaed;
    --muted: #9aa0a6;
    --border: #3c4043;
    --accent: #8ab4f8;
    --accent-hover: #aecbfa;
    --accent-text: #202124;
    --error-bg: #3c1f1e;
    --error-text: #f28b82;
  }
  @media (prefers-color-scheme: dark) {
    .card[data-theme="auto"] {
      --bg: #202124;
      --text: #e8eaed;
      --muted: #9aa0a6;
      --border: #3c4043;
      --accent: #8ab4f8;
      --accent-hover: #aecbfa;
      --accent-text: #202124;
      --error-bg: #3c1f1e;
      --error-text: #f28b82;
    }
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px 0;
  }
  .brand {
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
    letter-spacing: 0.01em;
  }
  .close {
    appearance: none;
    border: 0;
    background: transparent;
    color: var(--muted);
    width: 26px;
    height: 26px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 20px;
    line-height: 1;
    display: grid;
    place-items: center;
    padding: 0;
  }
  .close:hover { background: rgba(128, 128, 128, 0.15); }
  .account {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
  }
  .avatar {
    width: 44px;
    height: 44px;
    flex: 0 0 44px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: #fff;
    background: linear-gradient(135deg, #4285f4, #a142f4);
    font-weight: 600;
    font-size: 16px;
    user-select: none;
  }
  .identity { min-width: 0; }
  .name {
    font-size: 15px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .email {
    color: var(--muted);
    font-size: 12.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .continue {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: calc(100% - 28px);
    margin: 0 14px 14px;
    padding: 10px 14px;
    border: 0;
    border-radius: 8px;
    background: var(--accent);
    color: var(--accent-text);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .continue:hover { background: var(--accent-hover); }
  .continue:disabled { opacity: 0.75; cursor: default; }
  .spinner {
    display: none;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(128, 128, 128, 0.4);
    border-top-color: currentColor;
    border-radius: 50%;
    animation: sso-spin 0.8s linear infinite;
  }
  .continue.loading .spinner { display: inline-block; }
  @keyframes sso-spin { to { transform: rotate(360deg); } }
  .error {
    display: none;
    margin: 0 14px 14px;
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--error-bg);
    color: var(--error-text);
    font-size: 12.5px;
  }
  .error.visible { display: block; }
`;

function initialsFor(user?: SilentLoginUser): string {
  const source = user?.name?.trim() || user?.email?.trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return `${first}${last}`.toUpperCase();
}

function positionStyles(position: OneTapPosition): Partial<CSSStyleDeclaration> {
  switch (position) {
    case "top-left":
      return { top: "16px", left: "16px" };
    case "bottom-right":
      return { bottom: "16px", right: "16px" };
    case "bottom-left":
      return { bottom: "16px", left: "16px" };
    default:
      return { top: "16px", right: "16px" };
  }
}

/**
 * Mounts a Google One Tap-style "Continue as …" card in a page corner.
 *
 * It checks the SSO session once, shows the account card when a session exists,
 * and only requests an authorization code when the user clicks Continue.
 */
export function mountOneTap(options: OneTapOptions): OneTapController {
  if (typeof document === "undefined" || typeof window === "undefined") {
    throw new SilentLoginError("not_browser", "mountOneTap requires a browser environment.");
  }
  if (typeof options.onLogin !== "function") {
    throw new SilentLoginError("invalid_config", "onLogin is required.");
  }

  const target =
    typeof options.target === "string"
      ? document.querySelector<HTMLElement>(options.target)
      : options.target ?? document.body ?? document.documentElement;

  if (!target) {
    throw new SilentLoginError("invalid_config", "One-tap mount target was not found.");
  }

  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  const host = document.createElement("div");
  host.setAttribute("data-sso-one-tap", "");
  host.style.position = "fixed";
  host.style.zIndex = String(options.zIndex ?? DEFAULT_Z_INDEX);
  host.style.display = "none";
  Object.assign(host.style, positionStyles(options.position ?? "top-right"));

  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `<style>${STYLES}</style>
    <div class="card" role="dialog" aria-label="Sign in with Shadow SSO" data-theme="auto">
      <div class="header">
        <span class="brand"></span>
        <button class="close" type="button" aria-label="Dismiss sign-in">×</button>
      </div>
      <div class="account">
        <div class="avatar" aria-hidden="true"></div>
        <div class="identity">
          <div class="name"></div>
          <div class="email"></div>
        </div>
      </div>
      <button class="continue" type="button">
        <span class="spinner" aria-hidden="true"></span>
        <span class="continue-label"></span>
      </button>
      <div class="error" role="alert"></div>
    </div>`;

  const card = shadow.querySelector<HTMLElement>(".card");
  const brand = shadow.querySelector<HTMLElement>(".brand");
  const closeButton = shadow.querySelector<HTMLButtonElement>(".close");
  const avatar = shadow.querySelector<HTMLElement>(".avatar");
  const name = shadow.querySelector<HTMLElement>(".name");
  const email = shadow.querySelector<HTMLElement>(".email");
  const continueButton = shadow.querySelector<HTMLButtonElement>(".continue");
  const continueLabel = shadow.querySelector<HTMLElement>(".continue-label");
  const errorBox = shadow.querySelector<HTMLElement>(".error");

  if (!card || !brand || !closeButton || !avatar || !name || !email || !continueButton || !continueLabel || !errorBox) {
    throw new SilentLoginError("invalid_config", "One-tap widget markup is incomplete.");
  }

  card.dataset.theme = options.theme ?? "auto";
  brand.textContent = options.appName ? `Sign in to ${options.appName}` : "Sign in with Shadow SSO";
  closeButton.style.display = options.dismissible === false ? "none" : "";

  let destroyed = false;
  let busy = false;
  let refreshing = false;
  let currentUser: SilentLoginUser | undefined;

  const hide = () => {
    host.style.display = "none";
  };

  const showError = (message: string) => {
    errorBox.textContent = message;
    errorBox.classList.add("visible");
  };

  const clearError = () => {
    errorBox.textContent = "";
    errorBox.classList.remove("visible");
  };

  const labelFor = (user?: SilentLoginUser): string => {
    const template = options.buttonText ?? (user?.name ? "Continue as {name}" : "Continue");
    return template.replace(/\{name\}/g, user?.name || user?.email || "").trim();
  };

  const renderUser = (user?: SilentLoginUser) => {
    currentUser = user;
    avatar.textContent = initialsFor(user);
    name.textContent = user?.name || user?.email || "Signed in";
    email.textContent = user?.email || "";
    email.style.display = user?.email ? "" : "none";
    continueLabel.textContent = labelFor(user);
    clearError();
    host.style.display = "block";
  };

  const handleError = (error: unknown, forClick: boolean) => {
    if (destroyed || controller.signal.aborted) {
      return;
    }
    if (isSilentLoginError(error)) {
      switch (error.code) {
        case "login_required":
          hide();
          options.onLoginRequired?.();
          return;
        case "consent_required":
          hide();
          options.onConsentRequired?.();
          return;
        case "aborted":
          return;
        default:
          options.onError?.(error);
          if (forClick) {
            showError("Sign-in failed. Please try again.");
          } else {
            hide();
          }
          return;
      }
    }
    options.onError?.(new SilentLoginError("server_error", error instanceof Error ? error.message : String(error)));
    if (forClick) {
      showError("Sign-in failed. Please try again.");
    } else {
      hide();
    }
  };

  const refresh = async (): Promise<void> => {
    if (destroyed || refreshing) {
      return;
    }
    refreshing = true;
    try {
      const result = await checkSilentSession({ ...options, signal: controller.signal });
      if (destroyed) {
        return;
      }
      if (result.authenticated) {
        renderUser(result.user);
      } else {
        hide();
        options.onLoginRequired?.();
      }
    } catch (error) {
      handleError(error, false);
    } finally {
      refreshing = false;
    }
  };

  const login = async () => {
    if (busy || destroyed) {
      return;
    }
    busy = true;
    clearError();
    continueButton.disabled = true;
    continueButton.classList.add("loading");
    continueLabel.textContent = "Signing in…";
    try {
      const result = await silentLogin({ ...options, signal: controller.signal });
      if (destroyed) {
        return;
      }
      await options.onLogin(result);
      if (!destroyed) {
        hide();
      }
    } catch (error) {
      if (!destroyed) {
        handleError(error, true);
      }
    } finally {
      busy = false;
      if (!destroyed) {
        continueButton.disabled = false;
        continueButton.classList.remove("loading");
        continueLabel.textContent = labelFor(currentUser);
      }
    }
  };

  continueButton.addEventListener("click", () => {
    void login();
  });
  closeButton.addEventListener("click", () => {
    hide();
    options.onDismiss?.();
  });

  target.appendChild(host);
  void refresh();

  return {
    refresh,
    destroy: () => {
      destroyed = true;
      options.signal?.removeEventListener("abort", onExternalAbort);
      controller.abort();
      host.remove();
    },
  };
}

/** Alias for mountOneTap(). */
export const mountOneClick = mountOneTap;
