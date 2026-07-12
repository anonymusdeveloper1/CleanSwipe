# ============================================================================
# SwipeClean — R8 / ProGuard keep rules for the RELEASE build.
#
# NOTE: the JavaScript bundle is minified SEPARATELY by Metro/Hermes. R8 only
# touches the NATIVE (Java/Kotlin) side. Most libraries ship their own consumer
# ProGuard rules (merged automatically by AGP), so these are deliberately GENEROUS
# belt-and-suspenders keeps for anything reached via JNI, reflection, or native
# code — where an over-aggressive strip would crash only at runtime.
# ============================================================================

# ---------------------------------------------------------------------------
# React Native core / Hermes / JNI
# ---------------------------------------------------------------------------
-keep,includedescriptorclasses class com.facebook.react.bridge.** { *; }
-keep,includedescriptorclasses class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.yoga.** { *; }
-dontwarn com.facebook.react.**

# Facebook DoNotStrip / Keep annotations (used across RN + Fresco)
-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keep @com.facebook.common.internal.DoNotStrip class *
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
    @com.facebook.common.internal.DoNotStrip *;
    @com.facebook.proguard.annotations.KeepGettersAndSetters *;
}

# JNI: never rename/remove any native method or the classes that declare them.
-keepclasseswithmembernames,includedescriptorclasses class * {
    native <methods>;
}

# RN annotation-based native modules / view managers (reflection-registered).
-keep @com.facebook.react.module.annotations.ReactModule class * { *; }
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp <methods>;
    @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>;
    @com.facebook.react.bridge.ReactMethod <methods>;
}

# ---------------------------------------------------------------------------
# Expo modules (autolinked; use Kotlin reflection for their DSL definitions)
# ---------------------------------------------------------------------------
-keep class expo.modules.** { *; }
-keep class expo.core.** { *; }
-keep interface expo.modules.** { *; }
-keepclassmembers class * { @expo.modules.core.interfaces.ExpoMethod *; }
-dontwarn expo.modules.**

# ---------------------------------------------------------------------------
# Kotlin runtime / coroutines / metadata (Expo + native modules are Kotlin)
# ---------------------------------------------------------------------------
-keep class kotlin.Metadata { *; }
-keepclassmembers class **$Companion { *; }
-keepclassmembers class kotlinx.coroutines.** { volatile <fields>; }
-dontwarn kotlin.**
-dontwarn kotlinx.coroutines.**

# ---------------------------------------------------------------------------
# react-native-purchases (RevenueCat) — entitlement source of truth
# ---------------------------------------------------------------------------
-keep class com.revenuecat.purchases.** { *; }
-keep class com.revenuecatui.** { *; }
-dontwarn com.revenuecat.purchases.**

# Google Play Billing (RevenueCat's backend on Android)
-keep class com.android.billingclient.** { *; }
-keep class com.android.vending.billing.** { *; }
-dontwarn com.android.billingclient.**

# ---------------------------------------------------------------------------
# react-native-google-mobile-ads (AdMob) + Play Services + UMP consent
# ---------------------------------------------------------------------------
-keep class io.invertase.googlemobileads.** { *; }
-keep class com.google.android.gms.ads.** { *; }
-keep class com.google.android.gms.internal.ads.** { *; }
-keep class com.google.android.ump.** { *; }
-dontwarn com.google.android.gms.**

# ---------------------------------------------------------------------------
# react-native-compressor (image/video compression)
# ---------------------------------------------------------------------------
-keep class com.reactnativecompressor.** { *; }
-dontwarn com.reactnativecompressor.**

# ---------------------------------------------------------------------------
# Vendored native modules (JNI + native-referenced; keep entirely).
#   swipecleanaudioencode — LAME MP3/WAV encoder (loads libswipecleanlame.so)
#   swipecleanaudioextract — MediaExtractor audio track pull
#   swipecleanwebm — MediaCodec WebM/VP-family transcode + EGL glue
# ---------------------------------------------------------------------------
-keep class expo.modules.swipecleanaudioencode.** { *; }
-keep class expo.modules.swipecleanaudioextract.** { *; }
-keep class expo.modules.swipecleanwebm.** { *; }
# App's own Kotlin (MainActivity/MainApplication) — harmless to keep.
-keep class com.cognitix.swipeclean.** { *; }

# ---------------------------------------------------------------------------
# Other autolinked RN native libraries (reanimated/worklets/gesture-handler/
# screens/svg/flashlist/async-storage/secure-store/background-actions/
# notifications/localization/image/video/haptics)
# ---------------------------------------------------------------------------
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.worklets.** { *; }
-keep class com.swmansion.common.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }
-keep class com.swmansion.rnscreens.** { *; }
-keep class com.horcrux.svg.** { *; }
-keep class com.shopify.reactnative.** { *; }
-keep class com.reactnativecommunity.asyncstorage.** { *; }
-keep class com.asterinet.react.bgactions.** { *; }

# ---------------------------------------------------------------------------
# Reflection-reached shapes: annotations, enums, Parcelable, Serializable.
# ---------------------------------------------------------------------------
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod,Exceptions,SourceFile,LineNumberTable
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}
-keepclassmembers class * implements android.os.Parcelable {
    public static final ** CREATOR;
}
-keepnames class * implements java.io.Serializable
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# ---------------------------------------------------------------------------
# Networking used transitively by RevenueCat / ads (OkHttp / Okio).
# ---------------------------------------------------------------------------
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**
