import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Button, Card, SectionLabel } from "@/components/ui";
import { Palette, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useWeightUnit } from "@/context/UnitContext";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { unit, setUnit } = useWeightUnit();

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
        </View>

        <View>
          <SectionLabel>Sync</SectionLabel>
          <Card style={styles.syncCard}>
            <Ionicons name="cloud-done-outline" size={20} color={Palette.success} />
            <Text style={styles.syncText}>
              Workouts sync to your account. The same data appears in Plato on the web.
            </Text>
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
    paddingHorizontal: 14,
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
  syncCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  syncText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: Palette.textSecondary,
  },
});
