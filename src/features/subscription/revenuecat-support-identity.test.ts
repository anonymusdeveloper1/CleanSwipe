import { describe, expect, it } from "vitest";
import { resolveRevenueCatSupportIdentity } from "./revenuecat-support-identity";

describe("resolveRevenueCatSupportIdentity", () => {
  it("uses the server customer ID and retains a different device alias", () => {
    expect(resolveRevenueCatSupportIdentity("current-customer", "old-device-alias")).toEqual({
      supportId: "current-customer",
      deviceAlias: "old-device-alias"
    });
  });

  it("does not repeat the device ID when it matches the server ID", () => {
    expect(resolveRevenueCatSupportIdentity("same-id", "same-id")).toEqual({ supportId: "same-id" });
  });

  it("falls back to the device ID when customer info is unavailable", () => {
    expect(resolveRevenueCatSupportIdentity(undefined, "device-id")).toEqual({ supportId: "device-id" });
  });

  it("normalizes blank values and returns undefined when neither ID exists", () => {
    expect(resolveRevenueCatSupportIdentity("  ", "\t")).toBeUndefined();
  });
});
