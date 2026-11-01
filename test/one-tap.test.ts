import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/silent-login.js", () => ({
  checkSilentSession: vi.fn(),
  silentLogin: vi.fn(),
}));

import {
  checkSilentSession,
  disableAutoSelect,
  isAutoSelectDisabled,
  mountOneTap,
  silentLogin,
  SilentLoginError,
} from "../src/index.js";
import type { OneTapOptions } from "../src/index.js";

const checkMock = vi.mocked(checkSilentSession);
const loginMock = vi.mocked(silentLogin);

const baseOptions: OneTapOptions = {
  issuer: "https://sso.example.com",
  clientId: "client-1",
  redirectUri: `${window.location.origin}/callback`,
  parentOrigin: window.location.origin,
  preflight: false,
  timeoutMs: 100,
  onLogin: vi.fn(),
};

const signedInUser = {
  id: "user-1",
  email: "user@example.com",
  name: "Test User",
};

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function widgetHost(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-sso-one-tap]");
}

afterEach(() => {
  document.body.innerHTML = "";
  document.cookie = "sso_auto_select=; Path=/; Max-Age=0";
  vi.clearAllMocks();
});

describe("mountOneTap", () => {
  it("shows the account card when a session exists", async () => {
    checkMock.mockResolvedValue({
      authenticated: true,
      user: signedInUser,
      state: "state-1",
    });

    const controller = mountOneTap({ ...baseOptions, appName: "Test App" });
    await flush();

    const host = widgetHost();
    expect(host).not.toBeNull();
    expect(host?.style.display).toBe("block");
    expect(host?.shadowRoot?.textContent).toContain("Test User");
    expect(host?.shadowRoot?.textContent).toContain("user@example.com");
    expect(host?.shadowRoot?.textContent).toContain("Sign in to Test App");
    expect(host?.shadowRoot?.textContent).toContain("Continue as Test User");

    controller.destroy();
    expect(widgetHost()).toBeNull();
  });

  it("requests a fresh code only when Continue is clicked", async () => {
    checkMock.mockResolvedValue({
      authenticated: true,
      user: signedInUser,
      state: "state-1",
    });
    loginMock.mockResolvedValue({
      code: "code-123",
      state: "state-2",
      user: signedInUser,
    });
    const onLogin = vi.fn();
    const controller = mountOneTap({ ...baseOptions, onLogin });
    await flush();

    expect(loginMock).not.toHaveBeenCalled();

    const host = widgetHost();
    const button = host?.shadowRoot?.querySelector<HTMLButtonElement>("button.continue");
    expect(button).not.toBeNull();

    button?.click();
    await flush();

    expect(loginMock).toHaveBeenCalledTimes(1);
    expect(onLogin).toHaveBeenCalledWith({
      code: "code-123",
      state: "state-2",
      user: signedInUser,
    });
    expect(host?.style.display).toBe("none");

    controller.destroy();
  });

  it("stays hidden and reports login_required", async () => {
    checkMock.mockRejectedValue(new SilentLoginError("login_required", "No session."));
    const onLoginRequired = vi.fn();
    const controller = mountOneTap({ ...baseOptions, onLoginRequired });
    await flush();

    expect(onLoginRequired).toHaveBeenCalledTimes(1);
    expect(widgetHost()?.style.display).toBe("none");

    controller.destroy();
  });

  it("hides and reports consent_required", async () => {
    checkMock.mockRejectedValue(new SilentLoginError("consent_required", "Consent needed."));
    const onConsentRequired = vi.fn();
    const controller = mountOneTap({ ...baseOptions, onConsentRequired });
    await flush();

    expect(onConsentRequired).toHaveBeenCalledTimes(1);
    expect(widgetHost()?.style.display).toBe("none");

    controller.destroy();
  });

  it("removes the widget and aborts on destroy", async () => {
    checkMock.mockResolvedValue({
      authenticated: true,
      user: signedInUser,
      state: "state-1",
    });
    const controller = mountOneTap(baseOptions);
    await flush();

    expect(widgetHost()).not.toBeNull();
    controller.destroy();
    expect(widgetHost()).toBeNull();
  });

  it("auto signs in after the delay when autoSelect is enabled", async () => {
    checkMock.mockResolvedValue({
      authenticated: true,
      user: signedInUser,
      state: "state-1",
    });
    loginMock.mockResolvedValue({
      code: "code-auto",
      state: "state-2",
      user: signedInUser,
    });
    const onLogin = vi.fn();
    const controller = mountOneTap({
      ...baseOptions,
      autoSelect: true,
      autoSelectDelayMs: 10,
      onLogin,
    });
    await flush();

    expect(loginMock).not.toHaveBeenCalled();
    await sleep(20);

    expect(loginMock).toHaveBeenCalledTimes(1);
    expect(onLogin).toHaveBeenCalledWith({
      code: "code-auto",
      state: "state-2",
      user: signedInUser,
    });

    controller.destroy();
  });

  it("cancels auto sign-in on dismiss and disables it for later", async () => {
    checkMock.mockResolvedValue({
      authenticated: true,
      user: signedInUser,
      state: "state-1",
    });
    const onDismiss = vi.fn();
    const controller = mountOneTap({
      ...baseOptions,
      autoSelect: true,
      autoSelectDelayMs: 10,
      onDismiss,
    });
    await flush();

    const host = widgetHost();
    host?.shadowRoot?.querySelector<HTMLButtonElement>("button.close")?.click();
    await sleep(20);

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(loginMock).not.toHaveBeenCalled();
    expect(isAutoSelectDisabled()).toBe(true);

    controller.destroy();
  });

  it("does not auto sign in when the disabled cookie is present", async () => {
    disableAutoSelect();
    checkMock.mockResolvedValue({
      authenticated: true,
      user: signedInUser,
      state: "state-1",
    });
    const controller = mountOneTap({
      ...baseOptions,
      autoSelect: true,
      autoSelectDelayMs: 10,
    });
    await flush();
    await sleep(20);

    expect(loginMock).not.toHaveBeenCalled();
    expect(widgetHost()?.style.display).toBe("block");

    controller.destroy();
  });

  it("clears the disabled state after a successful manual sign-in", async () => {
    disableAutoSelect();
    checkMock.mockResolvedValue({
      authenticated: true,
      user: signedInUser,
      state: "state-1",
    });
    loginMock.mockResolvedValue({
      code: "code-manual",
      state: "state-2",
      user: signedInUser,
    });
    const controller = mountOneTap(baseOptions);
    await flush();

    const button = widgetHost()?.shadowRoot?.querySelector<HTMLButtonElement>("button.continue");
    button?.click();
    await flush();

    expect(isAutoSelectDisabled()).toBe(false);

    controller.destroy();
  });
});
