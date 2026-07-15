import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Button } from "@/components/ui";
import { Palette, Radius, Spacing } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";

// Blocks email/password accounts out of the app until the address is
// verified, so signing up with someone else's email gets you nothing. The
// root layout routes here whenever the signed-in user still needs it.
export default function VerifyEmailScreen() {
  const { user, signOut, refreshUser, resendVerificationEmail } = useAuth();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);

  // Clicking the link happens in the mail app, so nothing re-renders us —
  // poll quietly and the root guard swaps to the app the moment it's done.
  useEffect(() => {
    const poll = setInterval(() => refreshUser().catch(() => {}), 5000);
    return () => clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkNow() {
    setChecking(true);
    try {
      await refreshUser();
      // Still mounted means the guard didn't flip — the link hasn't been
      // clicked yet (or the click didn't register server-side).
      Alert.alert(
        "Not verified yet",
        "Tap the link in the email first, then try again. Check spam if it isn't there."
      );
    } catch {
      Alert.alert("Couldn't check", "Check your connection and try again.");
    } finally {
      setChecking(false);
    }
  }

  async function resend() {
    setResending(true);
    try {
      await resendVerificationEmail();
      Alert.alert("Sent", `A fresh link is on its way to ${user?.email}.`);
    } catch {
      Alert.alert("Couldn't send", "Wait a minute, then try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="mail-unread-outline" size={34} color={Palette.accentText} />
        </View>
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.body}>
          We sent a verification link to{"\n"}
          <Text style={styles.email}>{user?.email}</Text>
        </Text>
        <Text style={styles.hint}>
          Tap the link in that email, then come back — this screen moves on
          automatically.
        </Text>

        <View style={styles.actions}>
          <Button title="I've tapped the link" onPress={checkNow} loading={checking} />
          <Button
            title="Resend email"
            variant="secondary"
            onPress={resend}
            loading={resending}
          />
        </View>

        <Pressable onPress={() => signOut()} hitSlop={8} style={styles.signOutRow}>
          <Text style={styles.signOutText}>
            Wrong email? <Text style={styles.signOutLink}>Sign out</Text>
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.bg,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    padding: Spacing.four,
    gap: Spacing.three,
  },
  iconWrap: {
    alignSelf: "center",
    width: 72,
    height: 72,
    borderRadius: Radius.xl,
    backgroundColor: Palette.accentSoft,
    borderWidth: 1,
    borderColor: Palette.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.two,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: Palette.text,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  body: {
    fontSize: 15,
    color: Palette.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  email: {
    color: Palette.text,
    fontWeight: "600",
  },
  hint: {
    fontSize: 13,
    color: Palette.textTertiary,
    textAlign: "center",
    lineHeight: 19,
  },
  actions: {
    gap: Spacing.three,
    marginTop: Spacing.three,
  },
  signOutRow: {
    alignItems: "center",
    marginTop: Spacing.two,
  },
  signOutText: {
    fontSize: 14,
    color: Palette.textTertiary,
  },
  signOutLink: {
    color: Palette.accentText,
    fontWeight: "600",
  },
});
