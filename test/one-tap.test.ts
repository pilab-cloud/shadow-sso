import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/silent-login.js", () => ({
  checkSilentSession: vi.fn(),
  silentLogin: vi.fn(),
}));

import {
  checkSilentSession,
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

function widgetHost(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-sso-one-tap]");
}

afterEach(() => {
  document.body.innerHTML = "";
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
});
