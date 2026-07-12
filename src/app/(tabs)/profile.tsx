import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button, Card, SectionLabel } from "@/components/ui";
import { Palette, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useRestTimer } from "@/context/RestTimerContext";
import { useWeightUnit } from "@/context/UnitContext";

const REST_OPTIONS = [
  { label: "Off", seconds: 0 },
  { label: "1:00", seconds: 60 },
  { label: "1:30", seconds: 90 },
  { label: "2:00", seconds: 120 },
  { label: "3:00", seconds: 180 },
];

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { unit, setUnit } = useWeightUnit();
  const { restSeconds, setRestSeconds } = useRestTimer();

  function confirmSignOut() {
    Alert.alert("Sign out?", "Your data stays synced to your account.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => signOut() },
    ]);
  }

  const initial = (user?.displayName ?? user?.email ?? "?").charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>

        <Card style={styles.accountCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.name}>{user?.displayName ?? "Athlete"}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
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
        </View>

        <Button title="Sign out" variant="danger" onPress={confirmSignOut} />
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
  avatarText: {
    fontSize: 22,
    fontWeight: "800",
    color: Palette.accentText,
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
