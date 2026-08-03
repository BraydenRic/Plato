import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button, Card, SectionLabel } from "@/components/ui";
import { Palette, Radius, Spacing, THEME_LIST } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { REST_OPTIONS, useRestTimer } from "@/context/RestTimerContext";
import { useThemePicker } from "@/context/ThemeContext";
import { useDefaultSets, MIN_SETS, MAX_SETS } from "@/context/DefaultSetsContext";
import { useWeightUnit } from "@/context/UnitContext";

// 1–5 sets, the range offered for a newly added exercise.
const SET_OPTIONS = Array.from({ length: MAX_SETS - MIN_SETS + 1 }, (_, i) => MIN_SETS + i);

export default function ProfileScreen() {
  const {
    user,
    isGuest,
    discardGuestData,
    signOut,
    updateDisplayName,
    deleteAccount,
    refreshUser,
    resendVerificationEmail,
  } = useAuth();
  const router = useRouter();
  const { theme, themeId, setThemeId } = useThemePicker();
  // Label beside control only works while both fit. Past a mild text bump the
  // label wins the space and the control drops beneath it.
  const { fontScale } = useWindowDimensions();
  const stackPrefs = fontScale > 1.3;
  const { unit, setUnit } = useWeightUnit();
  const { restSeconds, setRestSeconds } = useRestTimer();
  const { defaultSets, setDefaultSets } = useDefaultSets();

  // Providers like Apple only surface a name once (and Hide My Email hides it),
  // so let people set the name that shows on their profile themselves.
  function editName() {
    Alert.prompt(
      "Your name",
      "This is the name shown on your profile.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save",
          onPress: async (name?: string) => {
            const trimmed = (name ?? "").trim();
            if (!trimmed || trimmed === user?.displayName) return;
            try {
              await updateDisplayName(trimmed);
            } catch {
              Alert.alert("Couldn't update name", "Check your connection and try again.");
            }
          },
        },
      ],
      "plain-text",
      user?.displayName ?? ""
    );
  }

  function confirmSignOut() {
    Alert.alert("Sign out?", "Your data stays synced to your account.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => signOut() },
    ]);
  }

  // App Store guideline 5.1.1: apps with account creation must offer in-app
  // account deletion. Re-verifying identity guards against a stolen unlocked
  // phone — password users retype their password, but Apple/Google accounts
  // have no password, so they confirm through their native sign-in sheet.
  const providerIds = user?.providerData.map((p) => p.providerId) ?? [];
  const hasPassword = providerIds.includes("password");
  const socialName = providerIds.includes("apple.com") ? "Apple" : "Google";

  // emailVerified only updates server-side, so re-check once per visit —
  // otherwise the "verify your email" nudge lingers after they've verified.
  useEffect(() => {
    if (hasPassword && !user?.emailVerified) refreshUser().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resendVerification() {
    try {
      await resendVerificationEmail();
      Alert.alert("Verification sent", `Check ${user?.email} for the link — spam folder too.`);
    } catch {
      Alert.alert("Couldn't send email", "Wait a minute, then try again.");
    }
  }

  async function runDeleteAccount(password?: string) {
    try {
      await deleteAccount(password);
    } catch {
      Alert.alert(
        "Couldn't delete account",
        hasPassword
          ? "Check your password and connection, then try again."
          : `We couldn't confirm it's you. Make sure you pick the same ${socialName} account you signed up with, then try again.`
      );
    }
  }

  // Guest data lives only on this phone, so there's no account to delete and
  // no way to recover it — say so plainly before wiping.
  function confirmDiscardGuestData() {
    Alert.alert(
      "Delete all data?",
      "Every workout, template, and custom exercise saved on this phone will be permanently erased. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete forever", style: "destructive", onPress: () => discardGuestData() },
      ]
    );
  }

  function confirmDeleteAccount() {
    Alert.alert(
      "Delete account?",
      "Your account and every workout, template, and custom exercise will be permanently erased. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () =>
            hasPassword
              ? Alert.prompt(
                  "Confirm your password",
                  "Enter your password to permanently delete your account.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete forever",
                      style: "destructive",
                      onPress: (password?: string) => runDeleteAccount(password),
                    },
                  ],
                  "secure-text"
                )
              : Alert.alert(
                  "Confirm it's you",
                  `You'll sign in with ${socialName} one more time to confirm, then your account is permanently deleted.`,
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete forever",
                      style: "destructive",
                      onPress: () => runDeleteAccount(),
                    },
                  ]
                ),
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>

        <Card style={styles.accountCard}>
          <View
            style={[styles.avatar, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
            <Image
              source={require("../../../assets/images/plato-logo.png")}
              style={styles.avatarLogo}
              contentFit="contain"
              tintColor={theme.accentText}
            />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.name}>{isGuest ? "Guest" : user?.displayName ?? "Athlete"}</Text>
            <Text style={styles.email} numberOfLines={1}>
              {isGuest ? "Saved on this phone" : user?.email}
            </Text>
          </View>
          {/* Guests have no Firebase profile to rename. */}
          {!isGuest && (
            <Pressable onPress={editName} hitSlop={10} style={styles.editButton}>
              <Ionicons name="pencil" size={16} color={Palette.textSecondary} />
            </Pressable>
          )}
        </Card>

        {isGuest && (
          <Card
            style={[
              styles.upgradeCard,
              { backgroundColor: theme.accentSoft, borderColor: theme.accent },
            ]}>
            <Text style={styles.upgradeTitle}>Back up your workouts</Text>
            <Text style={styles.upgradeText}>
              Your history is only on this phone right now. Create an account and it syncs across
              your devices — everything you&apos;ve already logged comes with you.
            </Text>
            <Button
              title="Create account or sign in"
              onPress={() => router.push({ pathname: "/sign-in", params: { upgrade: "1" } })}
            />
          </Card>
        )}

        {hasPassword && user && !user.emailVerified && (
          <Pressable onPress={resendVerification} style={styles.verifyRow} hitSlop={4}>
            <Ionicons name="mail-unread-outline" size={16} color={theme.accentText} />
            <Text style={[styles.verifyText, { color: theme.accentText }]}>
              Verify your email — tap to resend the link
            </Text>
          </Pressable>
        )}

        <View>
          <SectionLabel>Preferences</SectionLabel>
          <Card style={styles.themeCard}>
            <View style={styles.themeHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.prefTitle}>Accent</Text>
                <Text style={styles.prefHint}>Colours the app and your home screen icon</Text>
              </View>
              <Text style={[styles.themeName, { color: theme.accentText }]}>{theme.label}</Text>
            </View>
            {/* Wraps rather than squeezing, so the swatches keep their tap
                target at large text sizes instead of clipping off the row. */}
            <View style={styles.swatchRow}>
              {THEME_LIST.map((t) => {
                const selected = t.id === themeId;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => setThemeId(t.id)}
                    hitSlop={4}
                    accessibilityRole="button"
                    accessibilityLabel={t.label}
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [
                      styles.swatchRing,
                      // The ring wears the swatch's own light shade, so the
                      // selected state reads as part of that theme.
                      selected && { borderColor: t.accentText },
                      pressed && { opacity: 0.7 },
                    ]}>
                    <View style={[styles.swatch, { backgroundColor: t.accent }]} />
                  </Pressable>
                );
              })}
            </View>
          </Card>
          <Card style={[styles.prefCard, stackPrefs && styles.prefCardStacked, styles.cardGap]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.prefTitle}>Weight unit</Text>
              <Text style={styles.prefHint}>Used for new sets and displayed volumes</Text>
            </View>
            <View style={styles.segment}>
              {(["lbs", "kg"] as const).map((u) => (
                <Pressable
                  key={u}
                  onPress={() => setUnit(u)}
                  style={[styles.segmentItem, unit === u && { backgroundColor: theme.accent }]}>
                  <Text style={[styles.segmentText, unit === u && { color: theme.onAccent }]}>{u}</Text>
                </Pressable>
              ))}
            </View>
          </Card>
          <Card style={styles.restCard}>
            <View>
              <Text style={styles.prefTitle}>Rest timer</Text>
              <Text style={styles.prefHint}>Countdown after checking off a set</Text>
            </View>
            <View style={[styles.segment, { alignSelf: "flex-start" }]}>
              {REST_OPTIONS.map((o) => (
                <Pressable
                  key={o.seconds}
                  onPress={() => setRestSeconds(o.seconds)}
                  style={[
                    styles.segmentItem,
                    restSeconds === o.seconds && { backgroundColor: theme.accent },
                  ]}>
                  <Text
                    style={[
                      styles.segmentText,
                      restSeconds === o.seconds && { color: theme.onAccent },
                    ]}>
                    {o.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card>
          <Card style={styles.restCard}>
            <View>
              <Text style={styles.prefTitle}>Default sets</Text>
              <Text style={styles.prefHint}>Sets a new exercise starts with</Text>
            </View>
            <View style={[styles.segment, { alignSelf: "flex-start" }]}>
              {SET_OPTIONS.map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setDefaultSets(n)}
                  style={[
                    styles.segmentItem,
                    defaultSets === n && { backgroundColor: theme.accent },
                  ]}>
                  <Text
                    style={[styles.segmentText, defaultSets === n && { color: theme.onAccent }]}>
                    {n}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card>
        </View>

        {!isGuest && <Button title="Sign out" variant="danger" onPress={confirmSignOut} />}

        <Pressable onPress={isGuest ? confirmDiscardGuestData : confirmDeleteAccount} hitSlop={8}>
          <Text style={styles.deleteAccount}>
            {isGuest ? "Delete all data" : "Delete account"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.bg,
  },
  scroll: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  header: {
    marginTop: Spacing.two,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: Palette.text,
    letterSpacing: -0.5,
  },
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  editButton: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: Palette.surfaceRaised,
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: "center",
    justifyContent: "center",
  },
  upgradeCard: {
    gap: Spacing.two,
  },
  upgradeTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Palette.text,
  },
  upgradeText: {
    fontSize: 13,
    lineHeight: 19,
    color: Palette.textSecondary,
  },
  verifyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    marginTop: -Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  verifyText: {
    fontSize: 13,
    fontWeight: "600",
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLogo: {
    width: 38,
    height: 38,
  },
  name: {
    fontSize: 17,
    fontWeight: "700",
    color: Palette.text,
  },
  email: {
    fontSize: 13,
    color: Palette.textTertiary,
  },
  prefCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  cardGap: {
    marginTop: Spacing.two,
  },
  themeCard: {
    gap: Spacing.three,
  },
  themeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  themeName: {
    fontSize: 13,
    fontWeight: "700",
  },
  swatchRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  swatchRing: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  swatch: {
    width: 30,
    height: 30,
    borderRadius: Radius.full,
  },
  prefCardStacked: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: Spacing.two,
  },
  restCard: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  deleteAccount: {
    fontSize: 13,
    color: Palette.textTertiary,
    textAlign: "center",
    textDecorationLine: "underline",
  },
  prefTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Palette.text,
  },
  prefHint: {
    fontSize: 12,
    color: Palette.textTertiary,
    marginTop: 1,
  },
  // Wraps rather than overflowing: at large text sizes five rest-timer options
  // can't fit one row, so they flow onto a second line instead of being cut off.
  segment: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    backgroundColor: Palette.surfaceRaised,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: 3,
    gap: 3,
  },
  segmentItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.sm - 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "600",
    color: Palette.textSecondary,
  },
});
