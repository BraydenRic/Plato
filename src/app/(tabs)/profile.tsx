import Ionicons from "@expo/vector-icons/Ionicons";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button, Card, SectionLabel } from "@/components/ui";
import { Palette, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useRestTimer } from "@/context/RestTimerContext";
import { useDefaultSets, MIN_SETS, MAX_SETS } from "@/context/DefaultSetsContext";
import { useWeightUnit } from "@/context/UnitContext";

// 1–5 sets, the range offered for a newly added exercise.
const SET_OPTIONS = Array.from({ length: MAX_SETS - MIN_SETS + 1 }, (_, i) => MIN_SETS + i);

const REST_OPTIONS = [
  { label: "Off", seconds: 0 },
  { label: "1:00", seconds: 60 },
  { label: "1:30", seconds: 90 },
  { label: "2:00", seconds: 120 },
  { label: "3:00", seconds: 180 },
];

export default function ProfileScreen() {
  const { user, signOut, updateDisplayName, deleteAccount } = useAuth();
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
          <View style={styles.avatar}>
            <Image
              source={require("../../../assets/images/plato-logo.png")}
              style={styles.avatarLogo}
              contentFit="contain"
              tintColor={Palette.accentText}
            />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.name}>{user?.displayName ?? "Athlete"}</Text>
            <Text style={styles.email} numberOfLines={1}>
              {user?.email}
            </Text>
          </View>
          <Pressable onPress={editName} hitSlop={10} style={styles.editButton}>
            <Ionicons name="pencil" size={16} color={Palette.textSecondary} />
          </Pressable>
        </Card>

        <View>
          <SectionLabel>Preferences</SectionLabel>
          <Card style={styles.prefCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.prefTitle}>Weight unit</Text>
              <Text style={styles.prefHint}>Used for new sets and displayed volumes</Text>
            </View>
            <View style={styles.segment}>
              {(["lbs", "kg"] as const).map((u) => (
                <Pressable
                  key={u}
                  onPress={() => setUnit(u)}
                  style={[styles.segmentItem, unit === u && styles.segmentActive]}>
                  <Text style={[styles.segmentText, unit === u && styles.segmentTextActive]}>{u}</Text>
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
                  style={[styles.segmentItem, restSeconds === o.seconds && styles.segmentActive]}>
                  <Text
                    style={[
                      styles.segmentText,
                      restSeconds === o.seconds && styles.segmentTextActive,
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
                  style={[styles.segmentItem, defaultSets === n && styles.segmentActive]}>
                  <Text
                    style={[styles.segmentText, defaultSets === n && styles.segmentTextActive]}>
                    {n}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card>
        </View>

        <Button title="Sign out" variant="danger" onPress={confirmSignOut} />

        <Pressable onPress={confirmDeleteAccount} hitSlop={8}>
          <Text style={styles.deleteAccount}>Delete account</Text>
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
  avatar: {
    width: 52,
    height: 52,
    borderRadius: Radius.full,
    backgroundColor: Palette.accentSoft,
    borderWidth: 1,
    borderColor: Palette.accent,
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
  segment: {
    flexDirection: "row",
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
  segmentActive: {
    backgroundColor: Palette.accent,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "600",
    color: Palette.textSecondary,
  },
  segmentTextActive: {
    color: "#fff",
  },
});
