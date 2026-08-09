import { Stack, type ErrorBoundaryProps } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { BodyweightVolumeRepair } from "@/components/bodyweight-volume-repair";
import { LiveActivitySync } from "@/components/live-activity-sync";
import { Button } from "@/components/ui";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { RestTimerProvider } from "@/context/RestTimerContext";
import { SetTimerProvider } from "@/context/SetTimerContext";
import { DefaultSetsProvider } from "@/context/DefaultSetsContext";
import { UnitProvider } from "@/context/UnitContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { Palette, Spacing } from "@/constants/theme";

SplashScreen.preventAutoHideAsync();

/**
 * Catches a render error anywhere in the app that no screen caught first.
 *
 * Only the workout screen had one of these, so a crash on any other screen took
 * the whole tree down — and with nothing left mounted that means a black window
 * the user can only escape by force-quitting. This turns every one of those into
 * a screen that says something and offers a way back.
 *
 * Two things it must not depend on, because the subtree that would provide them
 * is exactly what just failed:
 *
 *  - Context. This renders *instead of* RootLayout's providers, not inside them,
 *    so `useTheme()` here reads ThemeContext's default rather than the user's
 *    accent. Button does the same and stays readable on the default, which is
 *    why it's safe to use. Nothing here may call useAuth(), which has no
 *    meaningful default.
 *  - The splash screen having been hidden. RootNavigator hides it once Firebase
 *    reports in, and a crash before that leaves it up forever — covering this
 *    screen completely and turning a recoverable error back into a dead app. So
 *    hide it here too; it's idempotent, and by this point there is nothing left
 *    to keep waiting for.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <View style={styles.crash}>
      <Text style={styles.crashTitle}>Plato hit a snag</Text>
      <Text style={styles.crashBody}>
        Your workouts are safe — this is the screen failing to draw, not your data.
      </Text>
      {/* Selectable so it can be pasted into a bug report; this is the only
          place the actual cause is ever visible in a release build. */}
      <Text style={styles.crashDetail} selectable>
        {error.message}
      </Text>
      <Button title="Try again" variant="secondary" onPress={retry} style={styles.crashButton} />
    </View>
  );
}

// Shown while guest data is uploading into a freshly signed-in account. The
// upload is sequential and can take a while on a long history, and the tabs
// would otherwise be mounted against a cloud account that is still filling up —
// so a guest signing in would watch their whole history appear to vanish and
// trickle back. Holding the app here for the duration says what's happening.
function MigratingScreen() {
  const theme = useTheme();
  return (
    <View style={styles.migrating}>
      <ActivityIndicator color={theme.accent} />
      <Text style={styles.migratingTitle}>Moving your workouts</Text>
      <Text style={styles.migratingBody}>
        Saving everything you logged on this device into your account. This only happens once.
      </Text>
    </View>
  );
}

function RootNavigator() {
  const { user, loading, isGuest, migrating } = useAuth();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  // Keep the splash visible until Firebase restores the session,
  // so signed-in users never flash the sign-in screen.
  if (loading) return <View style={{ flex: 1, backgroundColor: Palette.bg }} />;

  if (migrating) return <MigratingScreen />;

  // Email/password accounts stay locked out until the address is verified —
  // otherwise anyone could claim someone else's email. Apple/Google emails
  // arrive already verified, so those users never see the gate.
  const needsVerification =
    !!user &&
    user.providerData.some((p) => p.providerId === "password") &&
    !user.emailVerified;

  // Guests get the whole app with no account at all. The sign-in screen stays
  // mounted for them (see the !user guard below) so "Create an account" from
  // Profile can push to it without dropping them out of the app first.
  //
  // Once an account exists it takes over completely, even while guest data is
  // still uploading — otherwise a lingering guest flag would let an unverified
  // signup walk straight past the verification gate.
  const canUseApp = user ? !needsVerification : isGuest;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Palette.bg },
      }}>
      <Stack.Protected guard={canUseApp}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="workout/[id]" />
        <Stack.Screen name="history" />
        <Stack.Screen name="bodyweight" />
        <Stack.Screen name="add-exercise" options={{ presentation: "modal" }} />
        <Stack.Screen name="create-exercise" options={{ presentation: "modal" }} />
        <Stack.Screen name="reorder-templates" options={{ presentation: "modal" }} />
        <Stack.Screen name="exercise/[id]" options={{ presentation: "modal" }} />
      </Stack.Protected>
      <Stack.Protected guard={needsVerification}>
        <Stack.Screen name="verify-email" />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  crash: {
    flex: 1,
    backgroundColor: Palette.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  crashTitle: {
    color: Palette.text,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  crashBody: {
    color: Palette.textSecondary,
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },
  crashDetail: {
    color: Palette.textTertiary,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
  crashButton: {
    alignSelf: "stretch",
    marginTop: Spacing.two,
  },
  migrating: {
    flex: 1,
    backgroundColor: Palette.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  migratingTitle: {
    color: Palette.text,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  migratingBody: {
    color: Palette.textSecondary,
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Outermost of the providers: the accent is a property of the device, not
          of an account, so the sign-in screen and the migrating screen — both of
          which render before there is a user — are themed too. */}
      <ThemeProvider>
        <AuthProvider>
          <UnitProvider>
            <RestTimerProvider>
              {/* Above the navigator so a running set stopwatch survives leaving
                  the workout screen, which unmounts it. */}
              <SetTimerProvider>
                <DefaultSetsProvider>
                  <StatusBar style="light" />
                  <LiveActivitySync />
                  <BodyweightVolumeRepair />
                  <RootNavigator />
                </DefaultSetsProvider>
              </SetTimerProvider>
            </RestTimerProvider>
          </UnitProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
