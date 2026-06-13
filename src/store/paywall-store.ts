import { create } from "zustand";
import { FeatureKey } from "@/features/subscription/feature-flags";

/**
 * Tiny, non-persisted store that lets any component request the Pro upgrade
 * sheet for a given feature without prop-drilling. A single <ProUpgradeSheet />
 * is mounted in the root layout and renders based on this state — the same
 * global-modal pattern the app already uses for CompressionCompleteSheet.
 */
type PaywallStore = {
  featureKey?: FeatureKey;
  open: (featureKey: FeatureKey) => void;
  close: () => void;
};

export const usePaywallStore = create<PaywallStore>((set) => ({
  featureKey: undefined,
  open: (featureKey) => set({ featureKey }),
  close: () => set({ featureKey: undefined })
}));
