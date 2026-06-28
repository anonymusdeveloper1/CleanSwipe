import { Image } from "expo-image";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import { FileUp, Music, Repeat, Trash2, Video } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ConvertFormatPicker } from "@/features/convert/components/convert-format-picker";
import { getSelectableTargets, targetLabel, targetMimeForShare } from "@/features/convert/convert-targets";
import { selectRecentConvertedJobs } from "@/features/convert/convert.selectors";
import { useConvertStore } from "@/features/convert/convert.store";
import { ConversionJob, ConversionJobInput, ConvertTarget } from "@/features/convert/convert.types";
import { createConversionJobInput } from "@/features/convert/convert.utils";
import { useCustomConvertStore } from "@/features/convert/custom-convert.store";
import { getConvertCapabilities } from "@/features/convert/engine/conversion-engine";
import { useAppTheme } from "@/hooks/use-app-theme";
import { PhotoAsset } from "@/models/photo";
import { isCustomPickerAvailable, pickMediaForConversion, prepareCustomMediaPicker } from "@/services/custom-media-picker";
import { formatBytes } from "@/utils/format";

const PHOTO_PROBE = { mediaType: "photo" as const };
const VIDEO_PROBE = { mediaType: "video" as const };
const MAX_BATCH = 5;

/**
 * Convert mode of the Studio tab, redesigned as a "files" surface: a Browse
 * dropzone → stage up to 5 picks → choose one target format per media kind →
 * convert; plus a "Recent converted" list (tap a row to view/share, trash to
 * remove). A single convertible item routes to the rich per-item run screen
 * (/convert-run); 2+ items go to the batch converting screen (/convert-batch),
 * which drains the existing FIFO queue one at a time.
 */
export function ConvertScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const jobs = useConvertStore((state) => state.jobs);
  const resetCompletedJob = useConvertStore((state) => state.resetCompletedJob);
  const recents = selectRecentConvertedJobs(jobs);

  const [staged, setStaged] = useState<PhotoAsset[]>([]);
  const [imgTarget, setImgTarget] = useState<ConvertTarget | undefined>(undefined);
  const [vidTarget, setVidTarget] = useState<ConvertTarget | undefined>(undefined);
  const [picking, setPicking] = useState(false);

  const pickerAvailable = isCustomPickerAvailable();
  const caps = getConvertCapabilities();

  useEffect(() => {
    void prepareCustomMediaPicker();
  }, []);

  const imageItems = staged.filter((a) => a.mediaType === "photo");
  const videoItems = staged.filter((a) => a.mediaType === "video");
  const imageTargets = getSelectableTargets(PHOTO_PROBE, caps);
  const videoTargets = getSelectableTargets(VIDEO_PROBE, caps);

  const targetFor = (a: PhotoAsset) => (a.mediaType === "video" ? vidTarget : imgTarget);
  const convertibleAssets = staged.filter((a) => createConversionJobInput(a, targetFor(a)) != null);
  const imageReady = imageItems.length === 0 || Boolean(imgTarget);
  const videoReady = videoItems.length === 0 || videoTargets.length === 0 || Boolean(vidTarget);
  const canConvert = imageReady && videoReady && convertibleAssets.length > 0;

  const handlePick = async () => {
    if (picking || staged.length >= MAX_BATCH) return;
    setPicking(true);
    const picked = await pickMediaForConversion(Math.max(1, MAX_BATCH - staged.length));
    setPicking(false);
    if (!picked.length) return;
    setStaged((prev) => dedupeById([...prev, ...picked]).slice(0, MAX_BATCH));
    setImgTarget(undefined);
    setVidTarget(undefined);
  };

  const dropOne = (id: string) => setStaged((prev) => prev.filter((a) => a.id !== id));

  const handleConvert = () => {
    const inputs = convertibleAssets
      .map((a) => createConversionJobInput(a, targetFor(a)))
      .filter((x): x is ConversionJobInput => x != null);
    if (inputs.length === 0) return;

    if (convertibleAssets.length === 1) {
      // Single item keeps the richer per-item run screen (size delta + save note).
      const asset = convertibleAssets[0];
      const target = targetFor(asset);
      if (!target) return;
      useCustomConvertStore.getState().setTarget(asset);
      router.push({ pathname: "/convert-run", params: { id: asset.id, target, custom: "1", origin: "/(tabs)/premium" } } as never);
    } else {
      const batchId = useConvertStore.getState().enqueueBatch(inputs);
      router.push({ pathname: "/convert-batch", params: { batchId, origin: "/(tabs)/premium" } } as never);
    }
    setStaged([]);
    setImgTarget(undefined);
    setVidTarget(undefined);
  };

  const openRecent = (job: ConversionJob) => {
    if (!job.outputUri) return;
    if (job.outputKind === "audio") {
      void shareUri(job.outputUri, targetMimeForShare(job.target), t("convert.shareTitle"));
      return;
    }
    router.push({ pathname: "/compression-media-viewer", params: { uri: job.outputUri, media: job.outputKind === "video" ? "video" : "photo" } } as never);
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28, gap: 16 }}>
      <View style={{ gap: 4, paddingTop: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Repeat size={24} color={theme.accent} />
          <Text selectable style={{ color: theme.text, fontSize: 24, fontWeight: "900" }}>{t("convert.title")}</Text>
        </View>
        <Text selectable style={{ color: theme.muted, fontSize: 15, lineHeight: 21 }}>{t("convert.subtitle")}</Text>
      </View>

      {!pickerAvailable ? (
        <Notice text={t("convert.pickerUnavailable")} />
      ) : (
        <>
          <Pressable
            accessibilityRole="button"
            disabled={staged.length >= MAX_BATCH}
            onPress={handlePick}
            style={{ borderRadius: 18, borderWidth: 1.5, borderStyle: "dashed", borderColor: theme.border, backgroundColor: theme.surfaceSoft, padding: 22, alignItems: "center", gap: 10, opacity: staged.length >= MAX_BATCH ? 0.6 : 1 }}
          >
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.surfaceStrong, alignItems: "center", justifyContent: "center" }}>
              <FileUp size={28} color={theme.accent} />
            </View>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: "800" }}>{t("convert.dropzoneTitle")}</Text>
            <Text style={{ color: theme.muted, fontSize: 13, textAlign: "center" }}>{t("convert.dropzoneHint")}</Text>
            <View style={{ backgroundColor: theme.accent, borderRadius: 12, minHeight: 44, paddingHorizontal: 20, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>{picking ? t("convert.opening") : t("convert.browse")}</Text>
            </View>
          </Pressable>

          {staged.length > 0 ? (
            <View style={{ gap: 12 }}>
              <Text style={{ color: theme.text, fontSize: 15, fontWeight: "800" }}>{t("convert.selectedCount", { count: staged.length })}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {staged.map((a) => (
                  <View key={a.id} style={{ width: 56, height: 56, borderRadius: 12, overflow: "hidden", backgroundColor: theme.surfaceStrong, alignItems: "center", justifyContent: "center" }}>
                    {a.mediaType === "video" ? <Video size={22} color={theme.muted} /> : <Image source={{ uri: a.uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />}
                    <Pressable accessibilityRole="button" accessibilityLabel={t("convert.removeStaged")} onPress={() => dropOne(a.id)} hitSlop={6} style={{ position: "absolute", top: 2, right: 2, width: 20, height: 20, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900", lineHeight: 15 }}>×</Text>
                    </Pressable>
                  </View>
                ))}
              </View>

              {imageItems.length > 0 ? <ConvertFormatPicker targets={imageTargets} selected={imgTarget} onSelect={setImgTarget} /> : null}
              {videoItems.length > 0 && videoTargets.length > 0 ? <ConvertFormatPicker targets={videoTargets} selected={vidTarget} onSelect={setVidTarget} /> : null}

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !canConvert }}
                disabled={!canConvert}
                onPress={handleConvert}
                style={{ minHeight: 56, borderRadius: 14, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center", opacity: canConvert ? 1 : 0.5 }}
              >
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>{t("convert.convertCountCta", { count: convertibleAssets.length })}</Text>
              </Pressable>
              {staged.length < MAX_BATCH ? (
                <Pressable accessibilityRole="button" onPress={handlePick} style={{ alignSelf: "center", paddingVertical: 6, paddingHorizontal: 16 }}>
                  <Text style={{ color: theme.accent, fontSize: 15, fontWeight: "800" }}>{t("convert.addMore")}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {recents.length > 0 ? (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ color: theme.text, fontSize: 15, fontWeight: "800" }}>{t("convert.recentTitle")}</Text>
                <Text style={{ color: theme.muted, fontSize: 13, fontWeight: "700" }}>{t("convert.recentCount", { count: recents.length })}</Text>
              </View>
              {recents.map((job) => (
                <Pressable key={job.id} accessibilityRole="button" onPress={() => openRecent(job)} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 12 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 10, overflow: "hidden", backgroundColor: theme.surfaceStrong, alignItems: "center", justifyContent: "center" }}>
                    {job.outputKind === "image" ? (
                      <Image source={{ uri: job.outputUri ?? job.uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                    ) : job.outputKind === "audio" ? (
                      <Music size={22} color={theme.muted} />
                    ) : (
                      <Video size={22} color={theme.muted} />
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text numberOfLines={1} style={{ color: theme.text, fontSize: 15, fontWeight: "800" }}>{job.fileName}</Text>
                    <Text style={{ color: theme.muted, fontSize: 12, fontWeight: "700" }}>
                      {`${targetLabel(job.target)} · ${formatBytes(job.outputSizeBytes ?? 0)}${job.completedAt ? ` · ${formatShortDate(job.completedAt)}` : ""}`}
                    </Text>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel={t("convert.removeRecent")} onPress={() => resetCompletedJob(job.id)} hitSlop={8} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
                    <Trash2 size={18} color={theme.red} />
                  </Pressable>
                </Pressable>
              ))}
            </View>
          ) : staged.length === 0 ? (
            <Notice text={t("convert.recentEmpty")} />
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

async function shareUri(uri: string, mime: string, dialogTitle: string) {
  try {
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle });
  } catch {
    // User dismissed the share sheet or it failed — nothing to recover.
  }
}

function dedupeById(list: PhotoAsset[]): PhotoAsset[] {
  const seen = new Set<string>();
  return list.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
}

function formatShortDate(ts?: number): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function Notice({ text }: { text: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ backgroundColor: theme.surfaceSoft, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 16 }}>
      <Text selectable style={{ color: theme.muted, fontSize: 13, lineHeight: 19 }}>{text}</Text>
    </View>
  );
}
