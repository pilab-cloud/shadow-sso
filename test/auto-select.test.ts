import { afterEach, describe, expect, it } from "vitest";
import {
  disableAutoSelect,
  enableAutoSelect,
  isAutoSelectDisabled,
} from "../src/index.js";

function clearStateCookie(): void {
  document.cookie = "sso_auto_select=; Path=/; Max-Age=0";
}

afterEach(() => {
  clearStateCookie();
});

describe("auto-select state", () => {
  it("disables and re-enables automatic sign-in", () => {
    expect(isAutoSelectDisabled()).toBe(false);

    disableAutoSelect();
    expect(isAutoSelectDisabled()).toBe(true);

    enableAutoSelect();
    expect(isAutoSelectDisabled()).toBe(false);
  });

  it("stores the disabled state in a cookie", () => {
    disableAutoSelect();
    expect(document.cookie).toContain("sso_auto_select=0");
  });
});
