import { afterEach, describe, expect, it, vi } from "vitest";
import { fedcmLogin, isFedCMSupported } from "../src/index.js";

afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as unknown as { IdentityCredential?: unknown }).IdentityCredential;
});

function enable(get: (o: unknown) => Promise<unknown>): void {
  (window as unknown as { IdentityCredential: unknown }).IdentityCredential = class {};
  Object.defineProperty(navigator, "credentials", { value: { get }, configurable: true });
}

describe("fedcmLogin", () => {
  it("rejects with not_supported without the API", async () => {
    expect(isFedCMSupported()).toBe(false);
    await expect(fedcmLogin({ issuer: "https://sso.example.com", clientId: "c" })).rejects.toMatchObject({
      code: "not_supported",
    });
  });

  it("requests the config URL with a nonce and returns the token", async () => {
    const get = vi.fn().mockResolvedValue({ token: "id.token" });
    enable(get);
    const res = await fedcmLogin({ issuer: "https://sso.example.com/", clientId: "c1", nonce: "n1" });
    expect(res).toEqual({ token: "id.token", nonce: "n1" });
    const arg = get.mock.calls[0]![0] as { identity: { providers: unknown[] }; mediation: string };
    expect(arg.identity.providers[0]!).toEqual({
      configURL: "https://sso.example.com/fedcm/config.json",
      clientId: "c1",
      nonce: "n1",
    });
    expect(arg.mediation).toBe("optional");
  });

  it("passes the active UI mode to navigator.credentials.get", async () => {
    const get = vi.fn().mockResolvedValue({ token: "id.token" });
    enable(get);
    await fedcmLogin({
      issuer: "https://sso.example.com",
      clientId: "c1",
      nonce: "n1",
      mode: "active",
    });
    const arg = get.mock.calls[0]![0] as { identity: { mode?: string } };
    expect(arg.identity.mode).toBe("active");
  });

  it("maps NetworkError to login_required", async () => {
    enable(() => Promise.reject(Object.assign(new Error("x"), { name: "NetworkError" })));
    await expect(fedcmLogin({ issuer: "https://sso.example.com", clientId: "c" })).rejects.toMatchObject({
      code: "login_required",
    });
  });
});
