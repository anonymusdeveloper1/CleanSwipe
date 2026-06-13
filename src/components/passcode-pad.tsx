import { Delete, Fingerprint, LucideIcon, ScanFace } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { BiometricKind, PASSCODE_LENGTH } from "@/services/app-lock-service";
import { useAppTheme } from "@/hooks/use-app-theme";

type Props = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  error?: boolean;
  disabled?: boolean;
  onBiometric?: () => void;
  biometricKind?: BiometricKind;
};

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function PasscodePad({ value, onChange, length = PASSCODE_LENGTH, error, disabled, onBiometric, biometricKind }: Props) {
  const theme = useAppTheme();
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!error) return;
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true })
    ]).start();
  }, [error, shake]);

  const press = (digit: string) => {
    if (disabled || value.length >= length) return;
    onChange(value + digit);
  };
  const backspace = () => {
    if (disabled || value.length === 0) return;
    onChange(value.slice(0, -1));
  };

  const BiometricIcon: LucideIcon = biometricKind === "face" ? ScanFace : Fingerprint;
  const translateX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-9, 9] });

  return (
    <View style={{ alignItems: "center", gap: 30 }}>
      <Animated.View style={{ flexDirection: "row", gap: 18, transform: [{ translateX }] }}>
        {Array.from({ length }).map((_unused, index) => {
          const filled = index < value.length;
          return (
            <View
              key={index}
              style={{
                width: 16,
                height: 16,
                borderRadius: 8,
                borderWidth: 2,
                borderColor: error ? theme.red : theme.accent,
                backgroundColor: filled ? (error ? theme.red : theme.accent) : "transparent"
              }}
            />
          );
        })}
      </Animated.View>

      <View style={{ width: 264, flexDirection: "row", flexWrap: "wrap", justifyContent: "center", rowGap: 16, columnGap: 18 }}>
        {KEYS.map((digit) => (
          <PadKey key={digit} onPress={() => press(digit)} disabled={disabled}>
            <Text style={{ color: theme.text, fontSize: 28, fontWeight: "700" }}>{digit}</Text>
          </PadKey>
        ))}
        {onBiometric ? (
          <PadKey onPress={onBiometric} disabled={disabled} subtle>
            <BiometricIcon size={28} color={theme.accent} />
          </PadKey>
        ) : (
          <View style={{ width: 76, height: 76 }} />
        )}
        <PadKey onPress={() => press("0")} disabled={disabled}>
          <Text style={{ color: theme.text, fontSize: 28, fontWeight: "700" }}>0</Text>
        </PadKey>
        <PadKey onPress={backspace} disabled={disabled || value.length === 0} subtle>
          <Delete size={26} color={theme.muted} />
        </PadKey>
      </View>
    </View>
  );
}

function PadKey({ onPress, disabled, subtle, children }: { onPress: () => void; disabled?: boolean; subtle?: boolean; children: React.ReactNode }) {
  const theme = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        width: 76,
        height: 76,
        borderRadius: 38,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: subtle ? "transparent" : pressed ? theme.surfaceStrong : theme.surfaceSoft,
        opacity: disabled ? 0.4 : 1
      })}
    >
      {children}
    </Pressable>
  );
}
