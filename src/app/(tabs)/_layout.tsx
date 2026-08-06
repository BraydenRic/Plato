import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View, useWindowDimensions } from "react-native";

import { ActiveWorkoutBar } from "@/components/active-workout-bar";
import { Palette, TabLabelMaxFontScale } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

export default function TabLayout() {
  // The bar's height is fixed, so oversized labels get clipped rather than
  // wrapped. Above the threshold the icons carry the meaning on their own.
  const { fontScale } = useWindowDimensions();
  const theme = useTheme();

  return (
    /*
      The top safe-area inset is owned by the strip above the tabs, not by each
      of the four tab screens — which is why none of them wraps itself in a
      SafeAreaView any more, and why adding one back would double the padding.

      It had to move because the resume bar sits above all of them and paints
      into the status bar area itself, so exactly one thing can hold that inset
      and which thing it is changes as the bar comes and goes. SafeAreaView
      reads the real device insets natively, so a screen inside one cannot be
      told the top has already been spent.
    */
    <View style={styles.root}>
      <ActiveWorkoutBar />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.accentText,
          tabBarInactiveTintColor: Palette.textTertiary,
          tabBarShowLabel: fontScale <= TabLabelMaxFontScale,
          tabBarStyle: {
            backgroundColor: Palette.surface,
            borderTopColor: Palette.border,
          },
          sceneStyle: { backgroundColor: Palette.bg },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: "Workouts",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "barbell" : "barbell-outline"} color={color} size={24} />
            ),
          }}
        />
        <Tabs.Screen
          name="exercises"
          options={{
            title: "Exercises",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "library" : "library-outline"} color={color} size={24} />
            ),
          }}
        />
        <Tabs.Screen
          name="stats"
          options={{
            title: "Stats",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "stats-chart" : "stats-chart-outline"} color={color} size={24} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "person-circle" : "person-circle-outline"} color={color} size={24} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Palette.bg,
  },
});
