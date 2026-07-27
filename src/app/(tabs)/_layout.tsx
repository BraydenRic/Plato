import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useWindowDimensions } from "react-native";

import { Palette, TabLabelMaxFontScale } from "@/constants/theme";

export default function TabLayout() {
  // The bar's height is fixed, so oversized labels get clipped rather than
  // wrapped. Above the threshold the icons carry the meaning on their own.
  const { fontScale } = useWindowDimensions();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Palette.accentText,
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
  );
}
