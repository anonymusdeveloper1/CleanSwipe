import { router } from "expo-router";
import { CheckCircle2, Loader2, XCircle } from "lucide-react-native";
import { useEffect } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCompressionStore } from "@/features/compression/compression.store";
import { CompressionJob } from "@/features/compression/compression.types";
import { useAppTheme } from "@/hooks/use-app-theme";

export function CompressionBanner() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const job = useCompressionStore((state) => {
    const activeJob = state.activeJobId ? state.jobs[state.activeJobId] : undefined;
    if (activeJob && !activeJob.inAppBannerDismissed) return activeJob;
    const finishedJob = state.lastFinishedJobId ? state.jobs[state.lastFinishedJobId] : undefined;
    return finishedJob && !finishedJob.inAppBannerDismissed ? finishedJob : undefined;
  });
  const dismissInAppBanner = useCompressionStore((state) => state.dismissInAppBanner);
  const translateX = useSharedValue(0);

  useEffect(() => {
    translateX.value = 0;
  }, [job?.id, translateX]);

  const dismiss = () => {
    if (job) dismissInAppBanner(job.id);
  };

  const openDetail = () => {
    if (!job) return;
    router.push(`/compression-detail?id=${encodeURIComponent(job.mediaId)}` as never);
  };

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
    })
    .onEnd((event) => {
      const shouldDismiss = Math.abs(event.translationX) > 86 || Math.abs(event.velocityX) > 780;
      if (shouldDismiss) {
        translateX.value = withTiming(event.translationX >= 0 ? 420 : -420, { duration: 180 }, () => runOnJS(dismiss)());
        return;
      }
      translateX.value = withSpring(0, { damping: 18, stiffness: 190 });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }]
  }));

  if (!job) return null;

  const content = getBannerContent(job, t);
  const Icon = job.status === "failed" ? XCircle : job.status === "completed" ? CheckCircle2 : Loader2;
  const iconColor = job.status === "failed" ? theme.red : job.status === "completed" ? theme.green : theme.accent;

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + 8, left: 14, right: 14, zIndex: 50 }}>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={animatedStyle}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("compression.bannerAccessibilityLabel", { fileName: job.fileName })}
            onPress={openDetail}
            style={{
              minHeight: 62,
              borderRadius: 12,
              paddingHorizontal: 13,
              paddingVertical: 10,
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.border,
              boxShadow: "0 12px 28px rgba(15, 23, 42, 0.16)",
              gap: 8
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Icon size={21} color={iconColor} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text selectable={false} numberOfLines={1} style={{ color: theme.text, fontSize: 14, fontWeight: "900" }}>
                  {content.title}
                </Text>
                <Text selectable={false} numberOfLines={1} style={{ color: theme.muted, fontSize: 12, fontWeight: "700", marginTop: 1 }}>
                  {content.message}
                </Text>
              </View>
            </View>
            {job.status === "compressing" || job.status === "preparing" || job.status === "queued" ? (
              <View style={{ height: 4, borderRadius: 2, overflow: "hidden", backgroundColor: theme.surfaceStrong }}>
                <View style={{ width: `${Math.max(4, Math.round(job.progress * 100))}%`, height: 4, backgroundColor: theme.accent }} />
              </View>
            ) : null}
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function getBannerContent(job: CompressionJob, t: TFunction) {
  const queueLabel = job.queueTotal && job.queueTotal > 1 && job.queuePosition ? ` ${job.queuePosition}/${job.queueTotal}` : "";
  if (job.status === "queued") {
    return {
      title: t("compression.bannerStatusQueued", { queuePosition: queueLabel }),
      message: job.fileName
    };
  }
  if (job.status === "preparing") {
    return {
      title: t("compression.bannerStatusPreparing", { queuePosition: queueLabel }),
      message: job.fileName
    };
  }
  if (job.status === "completed") {
    return {
      title: t("compression.bannerStatusCompleted"),
      message: job.savedBytes ? t("compression.bannerMessageSavedSpace", { fileName: job.fileName }) : job.fileName
    };
  }
  if (job.status === "failed") {
    return {
      title: t("compression.bannerStatusFailed"),
      message: job.errorMessage ?? t("compression.bannerMessageRetry")
    };
  }
  return {
    title: t("compression.bannerStatusCompressing", { queuePosition: queueLabel }),
    message: t("compression.bannerMessageProgress", { fileName: job.fileName, percent: Math.round(job.progress * 100) })
  };
}
