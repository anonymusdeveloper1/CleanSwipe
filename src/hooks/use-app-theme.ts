import { useMemo } from "react";
import { accentColors, darkTheme, lightTheme } from "@/theme/colors";
import { useAppStore } from "@/store/app-store";

export function useAppTheme() {
  const settings = useAppStore((state) => state.settings);
  return useMemo(() => {
    const palette = settings.darkModeEnabled ? darkTheme : lightTheme;
    return {
      ...palette,
      accent: accentColors[settings.accentColor],
      isDark: settings.darkModeEnabled
    };
  }, [settings.accentColor, settings.darkModeEnabled]);
}
