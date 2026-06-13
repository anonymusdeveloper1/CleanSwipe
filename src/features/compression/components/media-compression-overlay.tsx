import { ActivityIndicator, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useCompressionStore } from "@/features/compression/compression.store";
import { CompressionJob } from "@/features/compression/compression.types";
import type { TFunction } from "i18next";

type Props = {
  mediaId: string;
};

export function MediaCompressionOverlay({ mediaId }: Props) {
  const { t } = useTranslation();
  const job = useCompressionStore((state) => state.getJobByMediaId(mediaId));
  if (!job) return null;

  if (job.status === "completed") {
    return null;
  }

  if (job.status === "failed") {
    return (
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 10, paddingVertical: 9, backgroundColor: "rgba(127, 29, 29, 0.86)" }}>
        <Text numberOfLines={1} style={{ color: "#fff", fontSize: 12, fontWeight: "900" }}>
          {t("compression.failedTapToRetry")}
        </Text>
      </View>
    );
  }

  if (job.status !== "queued" && job.status !== "preparing" && job.status !== "compressing") return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: "rgba(5, 7, 13, 0.62)",
        alignItems: "center",
        justifyContent: "center",
        gap: 9,
        padding: 12
      }}
    >
      {job.status === "queued" ? null : <ActivityIndicator color="#fff" />}
      <Text numberOfLines={2} style={{ color: "#fff", fontSize: 14, fontWeight: "900", textAlign: "center" }}>
        {getOverlayText(job, t)}
      </Text>
      <View style={{ alignSelf: "stretch", height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.28)", overflow: "hidden" }}>
        <View style={{ width: `${Math.max(4, Math.round(job.progress * 100))}%`, height: 4, backgroundColor: "#fff" }} />
      </View>
    </View>
  );
}

function getOverlayText(job: CompressionJob, t: TFunction) {
  if (job.status === "queued") return t("compression.queued");
  if (job.status === "preparing") return t("compression.preparing");
  return t("compression.compressing", { progress: Math.round(job.progress * 100) });
}
