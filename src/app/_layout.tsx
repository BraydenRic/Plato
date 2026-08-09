import { Stack, type ErrorBoundaryProps } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { BodyweightVolumeRepair } from "@/components/bodyweight-volume-repair";
import { LiveActivitySync } from "@/components/live-activity-sync";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { RestTimerProvider } from "@/context/RestTimerContext";
import { SetTimerProvider } from "@/context/SetTimerContext";
import { DefaultSetsProvider } from "@/context/DefaultSetsContext";
import { UnitProvider } from "@/context/UnitContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { PALETTES, Radius, Spacing } from "@/constants/theme";
import {
  AppearanceProvider,
  makeStyles,
  modeWithoutProvider,
  usePalette,
  useMode,
} from "@/context/AppearanceContext";

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
 *    so every `use*` in here would read a default rather than the user's real
 *    setting. That is why the colours come from `modeWithoutProvider()` and the
 *    button is a plain Pressable: the shared `Button` reads three contexts and
 *    would come out dark on a white crash screen. Nothing here may call
 *    useAuth(), which has no meaningful default at all.
 *  - The splash screen having been hidden. RootNavigator hides it once Firebase
 *    reports in, and a crash before that leaves it up forever — covering this
 *    screen completely and turning a recoverable error back into a dead app. So
 *    hide it here too; it's idempotent, and by this point there is nothing left
 *    to keep waiting for.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const c = PALETTES[modeWithoutProvider()];
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <View testID="crash" style={[styles.crash, { backgroundColor: c.bg }]}>
      <Text style={[styles.crashTitle, { color: c.text }]}>Plato hit a snag</Text>
      <Text style={[styles.crashBody, { color: c.textSecondary }]}>
        Your workouts are safe — this is the screen failing to draw, not your data.
      </Text>
      {/* Selectable so it can be pasted into a bug report; this is the only
          place the actual cause is ever visible in a release build. */}
      <Text style={[styles.crashDetail, { color: c.textTertiary }]} selectable>
        {error.message}
      </Text>
      <Pressable
        onPress={retry}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.crashButton,
          { backgroundColor: c.surfaceRaised, borderColor: c.border },
          pressed && { opacity: 0.75 },
        ]}>
        <Text style={[styles.crashButtonText, { color: c.text }]}>Try again</Text>
      </Pressable>
    </View>
  );
}

// Plain StyleSheet, not `makeStyles`: the hook it returns reads the mode from
// context, and this screen has none. Only the layout lives here; the colours
// arrive inline above.
const styles = StyleSheet.create({
  crash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  crashTitle: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  crashBody: { fontSize: 15, lineHeight: 21, textAlign: "center" },
  crashDetail: { fontSize: 12, lineHeight: 17, textAlign: "center" },
  crashButton: {
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginTop: Spacing.two,
  },
  crashButtonText: { fontSize: 16, fontWeight: "600", letterSpacing: 0.2 },
});

// Shown while guest data is uploading into a freshly signed-in account. The
// upload is sequential and can take a while on a long history, and the tabs
// would otherwise be mounted against a cloud account that is still filling up —
// so a guest signing in would watch their whole history appear to vanish and
// trickle back. Holding the app here for the duration says what's happening.
function MigratingScreen() {
  const styles = useStyles();
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
  const palette = usePalette();
  const { user, loading, isGuest, migrating } = useAuth();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  // Keep the splash visible until Firebase restores the session,
  // so signed-in users never flash the sign-in screen.
  if (loading) return <View style={{ flex: 1, backgroundColor: palette.bg }} />;

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
        contentStyle: { backgroundColor: palette.bg },
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

const useStyles = makeStyles((c) => ({
  migrating: {
    flex: 1,
    backgroundColor: c.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  migratingTitle: {
    color: c.text,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  migratingBody: {
    color: c.textSecondary,
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },
}));

// The clock and battery have to invert with the page or they vanish into it.
// Split out because it needs the mode, and RootLayout is what mounts the
// provider that has it.
export function ThemedStatusBar() {
  return <StatusBar style={useMode() === "dark" ? "light" : "dark"} />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Outermost of the providers: light/dark and the accent are properties of
          the device, not of an account, so the sign-in screen and the migrating
          screen — both of which render before there is a user — are themed too.
          Appearance goes above Theme because a theme resolves to one of its two
          accent sets by mode, so it has to be able to read one. */}
      <AppearanceProvider>
        <ThemeProvider>
          <AuthProvider>
            <UnitProvider>
              <RestTimerProvider>
                {/* Above the navigator so a running set stopwatch survives
                    leaving the workout screen, which unmounts it. */}
                <SetTimerProvider>
                  <DefaultSetsProvider>
                    <ThemedStatusBar />
                    <LiveActivitySync />
                    <BodyweightVolumeRepair />
                    <RootNavigator />
                  </DefaultSetsProvider>
                </SetTimerProvider>
              </RestTimerProvider>
            </UnitProvider>
          </AuthProvider>
        </ThemeProvider>
      </AppearanceProvider>
    </GestureHandlerRootView>
  );
}
