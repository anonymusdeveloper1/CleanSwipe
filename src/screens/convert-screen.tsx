import { Image } from "expo-image";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import { FileUp, FolderOpen, Image as ImageIcon, Music, Plus, Repeat, Trash2, Video } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from "react-native-reanimated";
import { ConvertFormatSheet, FormatPill } from "@/features/convert/components/convert-format-sheet";
import { getSelectableTargets, sourceFormat, sourceFormatLabel, targetLabel, targetMimeForShare } from "@/features/convert/convert-targets";
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

const MAX_BATCH = 5;

/** Per-source-kind badge accent (gif → amber, video → accent, image → blue). */
function badgeColor(asset: PhotoAsset, accent: string): string {
  const fmt = sourceFormat(asset.filename) ?? sourceFormat(asset.uri);
  if (fmt === "gif") return "#EF9F27";
  if (asset.mediaType === "video") return accent;
  return "#378ADD";
}

/**
 * Convert mode of the Studio tab — a "workbench" surface: a Browse dropzone that
 * morphs into a type-grouped staging list, where EACH item carries its own
 * source badge + "from → to" format pill (tap to open the format sheet). The pill
 * never offers the file's own format. A single convertible item routes to the
 * rich per-item run screen; 2+ enqueue the FIFO batch. "Recent converted" lives
 * at the bottom.
 */
export function ConvertScreen() {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const jobs = useConvertStore((state) => state.jobs);
  const resetCompletedJob = useConvertStore((state) => state.resetCompletedJob);
  const recents = selectRecentConvertedJobs(jobs);

  const [staged, setStaged] = useState<PhotoAsset[]>([]);
  const [targets, setTargets] = useState<Record<string, ConvertTarget>>({});
  const [picking, setPicking] = useState(false);
  const [sheetAssetId, setSheetAssetId] = useState<string | undefined>(undefined);

  const pickerAvailable = isCustomPickerAvailable();
  const caps = useMemo(() => getConvertCapabilities(), []);

  useEffect(() => {
    void prepareCustomMediaPicker();
  }, []);

  const imageItems = staged.filter((a) => a.mediaType === "photo");
  const videoItems = staged.filter((a) => a.mediaType === "video");
  const sheetAsset = staged.find((a) => a.id === sheetAssetId);

  const convertibleAssets = staged.filter((a) => createConversionJobInput(a, targets[a.id]) != null);
  const canConvert = convertibleAssets.length > 0;

  const defaultTargetFor = (asset: PhotoAsset): ConvertTarget | undefined => getSelectableTargets(asset, caps)[0];

  const handlePick = async () => {
    if (picking || staged.length >= MAX_BATCH) return;
    setPicking(true);
    const picked = await pickMediaForConversion(Math.max(1, MAX_BATCH - staged.length));
    setPicking(false);
    if (!picked.length) return;
    const next = dedupeById([...staged, ...picked]).slice(0, MAX_BATCH);
    setStaged(next);
    setTargets((prev) => {
      const merged = { ...prev };
      for (const asset of next) {
        if (merged[asset.id]) continue;
        const def = defaultTargetFor(asset);
        if (def) merged[asset.id] = def;
      }
      return merged;
    });
  };

  const dropOne = (id: string) => {
    setStaged((prev) => prev.filter((a) => a.id !== id));
    setTargets((prev) => {
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const clearAll = () => {
    setStaged([]);
    setTargets({});
  };

  const handleConvert = () => {
    const inputs = convertibleAssets
      .map((a) => createConversionJobInput(a, targets[a.id]))
      .filter((x): x is ConversionJobInput => x != null);
    if (inputs.length === 0) return;

    if (convertibleAssets.length === 1) {
      const asset = convertibleAssets[0];
      const target = targets[asset.id];
      if (!target) return;
      useCustomConvertStore.getState().setTarget(asset);
      router.push({ pathname: "/convert-run", params: { id: asset.id, target, custom: "1", origin: "/(tabs)/premium" } } as never);
    } else {
      const batchId = useConvertStore.getState().enqueueBatch(inputs);
      router.push({ pathname: "/convert-batch", params: { batchId, origin: "/(tabs)/premium" } } as never);
    }
    clearAll();
  };

  const openRecent = (job: ConversionJob) => {
    if (!job.outputUri) return;
    if (job.outputKind === "audio") {
      void shareUri(job.outputUri, targetMimeForShare(job.target), t("convert.shareTitle"));
      return;
    }
    router.push({ pathname: "/compression-media-viewer", params: { uri: job.outputUri, media: job.outputKind === "video" ? "video" : "photo" } } as never);
  };

  const renderItem = (asset: PhotoAsset) => {
    const badge = badgeColor(asset, theme.accent);
    const target = targets[asset.id];
    const hasTargets = getSelectableTargets(asset, caps).length > 0;
    return (
      <Animated.View
        key={asset.id}
        entering={FadeInDown.springify().damping(18)}
        exiting={FadeOut.duration(160)}
        layout={LinearTransition.springify().damping(18)}
        style={{ flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border, padding: 9 }}
      >
        <View style={{ width: 46, height: 46, borderRadius: 10, overflow: "hidden", backgroundColor: theme.surfaceStrong, alignItems: "center", justifyContent: "center" }}>
          {asset.mediaType === "video" ? <Video size={22} color={theme.muted} /> : <Image source={{ uri: asset.uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />}
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 7 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <View style={{ backgroundColor: `${badge}22`, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ color: badge, fontSize: 9.5, fontWeight: "900" }}>{sourceFormatLabel(asset)}</Text>
            </View>
            <Text numberOfLines={1} style={{ color: theme.text, fontSize: 13.5, fontWeight: "800", flexShrink: 1 }}>{asset.filename ?? (asset.mediaType === "video" ? t("convert.video") : t("convert.photo"))}</Text>
          </View>
          {hasTargets ? (
            <FormatPill sourceLabel={sourceFormatLabel(asset)} target={target} onPress={() => setSheetAssetId(asset.id)} />
          ) : (
            <Text style={{ color: theme.muted, fontSize: 11.5, fontWeight: "700" }}>{t("convert.noTargets")}</Text>
          )}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t("convert.removeStaged")} onPress={() => dropOne(asset.id)} hitSlop={8} style={{ width: 30, height: 30, alignItems: "center", justifyContent: "center", alignSelf: "flex-start" }}>
          <Text style={{ color: theme.muted, fontSize: 18, fontWeight: "700", lineHeight: 20 }}>×</Text>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 16 }}>
      <View style={{ gap: 4, paddingTop: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Repeat size={24} color={theme.accent} />
          <Text selectable style={{ color: theme.text, fontSize: 24, fontWeight: "900" }}>{t("convert.title")}</Text>
        </View>
        <Text selectable style={{ color: theme.muted, fontSize: 15, lineHeight: 21 }}>{t("convert.subtitle")}</Text>
      </View>

      {!pickerAvailable ? (
        <Notice text={t("convert.pickerUnavailable")} />
      ) : staged.length === 0 ? (
        <Animated.View entering={FadeIn.duration(180)} layout={LinearTransition}>
          <Pressable
            accessibilityRole="button"
            onPress={handlePick}
            style={{ borderRadius: 22, borderWidth: 1.5, borderStyle: "dashed", borderColor: `${theme.accent}66`, backgroundColor: `${theme.accent}0D`, padding: 28, alignItems: "center", gap: 12 }}
          >
            <View style={{ width: 78, height: 78, borderRadius: 39, backgroundColor: `${theme.accent}1F`, alignItems: "center", justifyContent: "center" }}>
              <FileUp size={32} color={theme.accent} />
            </View>
            <Text style={{ color: theme.text, fontSize: 17, fontWeight: "900" }}>{t("convert.dropzoneTitle")}</Text>
            <Text style={{ color: theme.muted, fontSize: 13, textAlign: "center", lineHeight: 19 }}>{t("convert.dropzoneHint")}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.accent, borderRadius: 13, minHeight: 46, paddingHorizontal: 24, justifyContent: "center" }}>
              <FolderOpen size={18} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "900" }}>{picking ? t("convert.opening") : t("convert.browse")}</Text>
            </View>
          </Pressable>
        </Animated.View>
      ) : (
        <Animated.View entering={FadeIn.duration(180)} layout={LinearTransition} style={{ gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: theme.muted, fontSize: 13, fontWeight: "800" }}>{t("convert.selectedCount", { count: staged.length })}</Text>
            {staged.length < MAX_BATCH ? (
              <Pressable accessibilityRole="button" onPress={handlePick} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Plus size={15} color={theme.accent} />
                <Text style={{ color: theme.accent, fontSize: 13.5, fontWeight: "800" }}>{picking ? t("convert.opening") : t("convert.addMore")}</Text>
              </Pressable>
            ) : null}
          </View>

          {imageItems.length > 0 ? (
            <View style={{ gap: 8 }}>
              <GroupHeader icon={<ImageIcon size={13} color="#85B7EB" />} label={t("convert.group.image")} color="#85B7EB" />
              {imageItems.map(renderItem)}
            </View>
          ) : null}

          {videoItems.length > 0 ? (
            <View style={{ gap: 8 }}>
              <GroupHeader icon={<Video size={13} color={theme.accent} />} label={t("convert.group.video")} color={theme.accent} />
              {videoItems.map(renderItem)}
            </View>
          ) : null}

          <View style={{ flexDirection: "row", gap: 10, marginTop: 2 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={t("convert.clear")} onPress={clearAll} style={{ width: 54, borderRadius: 15, borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center" }}>
              <Trash2 size={19} color={theme.muted} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canConvert }}
              disabled={!canConvert}
              onPress={handleConvert}
              style={{ flex: 1, minHeight: 56, borderRadius: 15, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center", opacity: canConvert ? 1 : 0.5 }}
            >
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>{t("convert.convertCountCta", { count: convertibleAssets.length })}</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

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

      <ConvertFormatSheet
        asset={sheetAsset}
        caps={caps}
        selected={sheetAsset ? targets[sheetAsset.id] : undefined}
        onSelect={(target) => {
          if (sheetAsset) setTargets((prev) => ({ ...prev, [sheetAsset.id]: target }));
          setSheetAssetId(undefined);
        }}
        onClose={() => setSheetAssetId(undefined)}
      />
    </ScrollView>
  );
}

function GroupHeader({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      {icon}
      <Text style={{ color, fontSize: 11, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</Text>
    </View>
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
