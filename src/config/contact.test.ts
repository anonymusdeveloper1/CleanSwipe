import { afterEach, describe, expect, it, vi } from "vitest";

async function loadContactConfigFor(platform: "android" | "ios") {
  vi.resetModules();
  vi.stubEnv("EXPO_OS", platform);
  return import("./contact");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("subscription legal configuration", () => {
  it("uses Google Play copy and terms on Android", async () => {
    const config = await loadContactConfigFor("android");

    expect(config.TERMS_OF_USE_URL).toBe("https://play.google.com/about/play-terms/");
    expect(config.SUBSCRIPTION_BILLING_DISCLAIMER_KEY).toBe("subscription.billingDisclaimerAndroid");
    expect(config.SUBSCRIPTION_TERMS_LABEL_KEY).toBe("subscription.termsOfUseAndroid");
  });

  it("uses Apple copy and the standard EULA on iOS", async () => {
    const config = await loadContactConfigFor("ios");

    expect(config.TERMS_OF_USE_URL).toBe("https://www.apple.com/legal/internet-services/itunes/dev/stdeula/");
    expect(config.SUBSCRIPTION_BILLING_DISCLAIMER_KEY).toBe("subscription.billingDisclaimerIos");
    expect(config.SUBSCRIPTION_TERMS_LABEL_KEY).toBe("subscription.termsOfUseIos");
  });
});
