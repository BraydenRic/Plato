import { forwardRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
  type ViewProps,
} from "react-native";
import { Palette, Radius, Spacing } from "@/constants/theme";

// ── Buttons ───────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends PressableProps {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  compact?: boolean;
}

export function Button({ title, variant = "primary", loading, compact, disabled, style, ...rest }: ButtonProps) {
  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: Palette.accent, fg: "#ffffff" },
    secondary: { bg: Palette.surfaceRaised, fg: Palette.text, border: Palette.border },
    ghost: { bg: "transparent", fg: Palette.accentText },
    danger: { bg: Palette.dangerSoft, fg: Palette.danger },
  };
  const c = palette[variant];
  return (
    <Pressable
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: c.bg, borderColor: c.border ?? "transparent", borderWidth: c.border ? 1 : 0 },
        (pressed || disabled) && { opacity: pressed ? 0.75 : 0.4 },
        typeof style === "function" ? undefined : style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={c.fg} size="small" />
      ) : (
        <Text style={[styles.buttonText, compact && styles.buttonTextCompact, { color: c.fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

// ── Surfaces ──────────────────────────────────────────────────────────────────

export function Card({ style, ...rest }: ViewProps) {
  return <View style={[styles.card, style]} {...rest} />;
}

export function Divider() {
  return <View style={styles.divider} />;
}

// ── Text inputs ───────────────────────────────────────────────────────────────

export const Field = forwardRef<TextInput, TextInputProps>(function Field({ style, ...rest }, ref) {
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={Palette.textTertiary}
      style={[styles.field, style]}
      {...rest}
    />
  );
});

// ── Labels / misc ─────────────────────────────────────────────────────────────

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: Palette.accentSoft, borderColor: Palette.accent }]}>
      <Text style={[styles.chipText, active && { color: Palette.accentText }]}>{label}</Text>
    </Pressable>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.md,
  },
  buttonCompact: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.sm,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  buttonTextCompact: {
    fontSize: 13,
  },
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.three,
  },
  divider: {
    height: 1,
    backgroundColor: Palette.border,
    marginVertical: Spacing.two,
  },
  field: {
    backgroundColor: Palette.surfaceRaised,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    fontSize: 16,
    color: Palette.text,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: Palette.textTertiary,
    marginBottom: Spacing.two,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
    color: Palette.textSecondary,
  },
  empty: {
    alignItems: "center",
    paddingVertical: Spacing.five,
    gap: Spacing.one,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Palette.text,
  },
  emptyMessage: {
    fontSize: 14,
    color: Palette.textTertiary,
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 20,
  },
});
