import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { LiveActivitySync } from "@/components/live-activity-sync";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { RestTimerProvider } from "@/context/RestTimerContext";
import { DefaultSetsProvider } from "@/context/DefaultSetsContext";
import { UnitProvider } from "@/context/UnitContext";
import { Palette } from "@/constants/theme";

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  // Keep the splash visible until Firebase restores the session,
  // so signed-in users never flash the sign-in screen.
  if (loading) return <View style={{ flex: 1, backgroundColor: Palette.bg }} />;

  // Email/password accounts stay locked out until the address is verified —
  // otherwise anyone could claim someone else's email. Apple/Google emails
  // arrive already verified, so those users never see the gate.
  const needsVerification =
    !!user &&
    user.providerData.some((p) => p.providerId === "password") &&
    !user.emailVerified;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Palette.bg },
      }}>
      <Stack.Protected guard={!!user && !needsVerification}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="workout/[id]" />
        <Stack.Screen name="history" />
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

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <UnitProvider>
          <RestTimerProvider>
            <DefaultSetsProvider>
              <StatusBar style="light" />
              <LiveActivitySync />
              <RootNavigator />
            </DefaultSetsProvider>
          </RestTimerProvider>
        </UnitProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
