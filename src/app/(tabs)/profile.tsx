import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";

import { Button, Card, SectionLabel, Stepper } from "@/components/ui";
import { Sparkline } from "@/components/sparkline";
import { useBodyweight } from "@/hooks/use-bodyweight";
import { convertWeight } from "@/lib/workout-utils";
import { Palette, Radius, Spacing, THEME_LIST } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { REST_OPTIONS, nearestRestIndex, useRestTimer } from "@/context/RestTimerContext";
import { useThemePicker } from "@/context/ThemeContext";
import { useDefaultSets, MIN_SETS, MAX_SETS } from "@/context/DefaultSetsContext";
import { useWeightUnit } from "@/context/UnitContext";

// Short enough to type on a phone with one hand, long enough that you can't
// produce it by tapping through.
const DELETE_WORD = "DELETE";

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
  const restIndex = nearestRestIndex(restSeconds);
  const restOption = REST_OPTIONS[restIndex];

  function stepRest(direction: 1 | -1) {
    const next = REST_OPTIONS[restIndex + direction];
    if (next) setRestSeconds(next.seconds);
  }
  const { defaultSets, setDefaultSets } = useDefaultSets();
  const { log: bodyweightLog, latest: latestWeight, record: recordWeight } = useBodyweight();
  const [sparkWidth, setSparkWidth] = useState(0);

  // Stored in lbs like every other weight; the card speaks the chosen unit.
  const shownWeight =
    latestWeight != null ? Math.round(convertWeight(latestWeight.lbs, "lbs", unit)) : null;
  // Against the oldest weigh-in on the card, which is what the line draws.
  const weightDelta =
    bodyweightLog.length > 1
      ? Math.round(convertWeight(latestWeight!.lbs - bodyweightLog[0].lbs, "lbs", unit))
      : 0;

  function logBodyweight() {
    Alert.prompt(
      "Bodyweight",
      `Today's weigh-in, in ${unit}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save",
          onPress: (value?: string) => {
            const entered = Number((value ?? "").trim());
            if (!Number.isFinite(entered) || entered <= 0) return;
            recordWeight(convertWeight(entered, unit, "lbs")).catch((e) => {
              // Don't blame the network for what is usually a rejected write —
              // `bodyweight` is its own Firestore collection and needs its own
              // security rule. The code is what says which, so surface it.
              console.warn("Couldn't save the weigh-in", e);
              const denied =
                typeof e === "object" && e !== null && "code" in e && e.code === "permission-denied";
              Alert.alert(
                "Couldn't save",
                denied
                  ? "Your account isn't allowed to store weigh-ins yet."
                  : "Check your connection and try again."
              );
            });
          },
        },
      ],
      "plain-text",
      shownWeight != null ? String(shownWeight) : "",
      "decimal-pad"
    );
  }

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

  /**
   * Make them write the word out before anything is destroyed.
   *
   * The steps either side of this are both things you can do by accident: a
   * "Delete forever" button sits exactly where a tapped-through alert puts your
   * thumb, and the password sheet after it is muscle memory. Typing is the only
   * part of the flow that can't be completed without reading it.
   *
   * Matched case-insensitively — iOS capitalises the first letter for you, and
   * failing someone who typed the right word is just a puzzle, not a safeguard.
   */
  function confirmByTyping(onConfirmed: () => void) {
    Alert.prompt(
      `Type ${DELETE_WORD} to confirm`,
      `This can't be undone. Type ${DELETE_WORD} below to continue.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: (typed?: string) => {
            if (typed?.trim().toUpperCase() !== DELETE_WORD) {
              Alert.alert("That didn't match", `Type ${DELETE_WORD} to confirm, or cancel.`);
              return;
            }
            onConfirmed();
          },
        },
      ],
      "plain-text"
    );
  }

  // Guest data lives only on this phone, so there's no account to delete and
  // no way to recover it — say so plainly before wiping.
  function confirmDiscardGuestData() {
    Alert.alert(
      "Delete all data?",
      "Every workout, template, and custom exercise saved on this phone will be permanently erased. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => confirmByTyping(() => discardGuestData()),
        },
      ]
    );
  }

  // Proving it's you, once they've proved they mean it.
  function reauthenticateAndDelete() {
    if (hasPassword) {
      Alert.prompt(
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
      );
      return;
    }
    Alert.alert(
      "Confirm it's you",
      `You'll sign in with ${socialName} one more time to confirm, then your account is permanently deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete forever", style: "destructive", onPress: () => runDeleteAccount() },
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
          onPress: () => confirmByTyping(reauthenticateAndDelete),
        },
      ]
    );
  }

  return (
    <View style={styles.safe}>
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

        <Card style={styles.bodyweightCard}>
          {/* Tapping the summary logs; the chevron expands. Two targets rather
              than one so opening the history doesn't put a keyboard up. */}
          <Pressable onPress={logBodyweight} style={({ pressed }) => pressed && { opacity: 0.8 }}>
            <View style={styles.bodyweightRow}>
              <Text style={styles.prefTitle}>Bodyweight</Text>
              <Text style={[styles.bodyweightValue, { color: theme.accentText }]}>
                {shownWeight != null ? `${shownWeight} ${unit}` : "Add"}
              </Text>
            </View>
          </Pressable>

          {/* Shown from the first weigh-in, not the second. Gating on a trend
              meant logging a weight and seeing nothing change, which reads as
              the feature being broken rather than as waiting for tomorrow. */}
          {bodyweightLog.length > 0 && (
            <Pressable
              onPress={() => router.push("/bodyweight")}
              accessibilityRole="button"
              accessibilityLabel="Bodyweight history"
              style={({ pressed }) => pressed && { opacity: 0.8 }}>
              <View
                style={styles.bodyweightRow}
                onLayout={(e) => setSparkWidth(e.nativeEvent.layout.width)}>
                <Sparkline
                  values={bodyweightLog.map((e) => e.lbs)}
                  color={theme.accent}
                  width={Math.max(0, sparkWidth - 96)}
                />
                <View style={styles.bodyweightTrailing}>
                  <Text style={styles.bodyweightDelta}>
                    {weightDelta > 0 ? `+${weightDelta}` : weightDelta} {unit}
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={Palette.textTertiary} />
                </View>
              </View>
            </Pressable>
          )}
        </Card>

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
            {/* Fixed-size swatches, so this row never reflows with text size. */}
            <View style={styles.swatchRow}>
              {THEME_LIST.map((t) => {
                const selected = t.id === themeId;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => setThemeId(t.id)}
                    hitSlop={6}
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
          {/* A stepper rather than a segmented control: seven options no longer
              fit on one row, and letting them wrap left an orphan on a second
              line. This stays one compact row whatever REST_OPTIONS grows to. */}
          <Card style={[styles.prefCard, stackPrefs && styles.prefCardStacked, styles.cardGap]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.prefTitle}>Rest timer</Text>
              <Text style={styles.prefHint}>Countdown after checking off a set</Text>
            </View>
            <Stepper
              accessibilityLabel="Rest timer"
              value={restOption.label}
              onStep={stepRest}
              canDecrement={restIndex > 0}
              canIncrement={restIndex < REST_OPTIONS.length - 1}
              style={stackPrefs ? { alignSelf: "flex-start" } : undefined}
            />
          </Card>
          <Card style={[styles.prefCard, stackPrefs && styles.prefCardStacked, styles.cardGap]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.prefTitle}>Default sets</Text>
              <Text style={styles.prefHint}>Sets a new exercise starts with</Text>
            </View>
            {/* Matches the rest timer beside it. The context clamps, so the
                stepper only has to say when it has run out of room. */}
            <Stepper
              accessibilityLabel="Default sets"
              value={String(defaultSets)}
              onStep={(d) => setDefaultSets(defaultSets + d)}
              canDecrement={defaultSets > MIN_SETS}
              canIncrement={defaultSets < MAX_SETS}
              style={stackPrefs ? { alignSelf: "flex-start" } : undefined}
            />
          </Card>
        </View>

        {!isGuest && <Button title="Sign out" variant="danger" onPress={confirmSignOut} />}

        <Pressable onPress={isGuest ? confirmDiscardGuestData : confirmDeleteAccount} hitSlop={8}>
          <Text style={styles.deleteAccount}>
            {isGuest ? "Delete all data" : "Delete account"}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
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
  bodyweightCard: {
    gap: Spacing.two,
  },
  bodyweightRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
  },
  bodyweightValue: {
    fontSize: 15,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  bodyweightTrailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  bodyweightDelta: {
    fontSize: 12,
    color: Palette.textTertiary,
    fontVariant: ["tabular-nums"],
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
    // space-between rather than a fixed gap: the swatches are a fixed size, so
    // letting the leftover width fall between them keeps all of them on one row
    // as themes are added, instead of orphaning the last onto a line of its own.
    justifyContent: "space-between",
  },
  swatchRing: {
    // 40 not 44 so seven still fit across the narrowest iPhone. hitSlop on the
    // Pressable takes the tap target back over the 44pt minimum.
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
  },
  prefCardStacked: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: Spacing.two,
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
