import { Text } from "react-native";
import { router, Stack, type Href } from "expo-router";
import { act, renderRouter, screen } from "expo-router/testing-library";

import * as RootLayoutModule from "../_layout";
import NotFound from "../+not-found";
import Sitemap from "../_sitemap";

/**
 * Links from outside the app, against the real root layout and the real router.
 *
 * Each of these used to strand someone with no way out short of force-quitting:
 *
 *  - The Live Activity cold-launches plato:///workout/<id> when iOS has ended
 *    Plato in the background. Nothing sat under that screen, so its back
 *    buttons — Finish's included — went nowhere.
 *  - A link matching no screen landed on expo-router's own not-found screen,
 *    mounted outside the root layout, so the splash it holds up never hid.
 *  - plato://_sitemap reached a dev screen that crashes release builds.
 */

const mockHideAsync = jest.fn(async () => {});
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: () => mockHideAsync(),
}));
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");

let mockAuth = { user: null, loading: false, isGuest: true, migrating: false };
jest.mock("@/context/AuthContext", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => mockAuth,
}));
jest.mock("@/components/bodyweight-volume-repair", () => ({ BodyweightVolumeRepair: () => null }));
jest.mock("@/components/live-activity-sync", () => ({ LiveActivitySync: () => null }));
jest.mock("@/components/watch-sync", () => ({ WatchSync: () => null }));

// Every other screen the real layout names, as a blank, so the router has all
// of them to place.
const OTHER_SCREENS = [
  "history",
  "bodyweight",
  "add-exercise",
  "start-cardio",
  "create-exercise",
  "reorder-templates",
  "reorder-day",
  "exercise/[id]",
  "verify-email",
];

function routes() {
  return {
    _layout: RootLayoutModule,
    "(tabs)/_layout": () => <Stack screenOptions={{ headerShown: false }} />,
    "(tabs)/index": () => <Text>Home</Text>,
    "workout/[id]": () => <Text>Workout</Text>,
    "sign-in": () => <Text>Sign in</Text>,
    "+not-found": NotFound,
    _sitemap: Sitemap,
    ...Object.fromEntries(OTHER_SCREENS.map((name) => [name, () => null])),
  };
}

/** The screens on the root stack, bottom to top. */
function rootStack(result: ReturnType<typeof renderRouter>): string[] {
  return result.getRouterState()?.routes[0]?.state?.routes.map((route) => route.name) ?? [];
}

beforeEach(() => {
  mockAuth = { user: null, loading: false, isGuest: true, migrating: false };
  mockHideAsync.mockClear();
});

describe("a cold start from the Live Activity", () => {
  it("puts the tabs under the workout, so leaving it goes somewhere", async () => {
    const result = renderRouter(routes(), { initialUrl: "/workout/w1" });
    expect(await screen.findByText("Workout")).toBeTruthy();
    expect(rootStack(result)).toEqual(["(tabs)", "workout/[id]"]);

    act(() => router.back());

    expect(await screen.findByText("Home")).toBeTruthy();
  });

  it("still shows sign-in to someone signed out", async () => {
    mockAuth = { ...mockAuth, isGuest: false };
    renderRouter(routes(), { initialUrl: "/workout/w1" });
    expect(await screen.findByText("Sign in")).toBeTruthy();
  });
});

describe("a link that matches no screen", () => {
  it.each(["/workout", "/workouts", "/a/b/c"])("%s lands on Home, with the splash gone", async (url) => {
    const result = renderRouter(routes(), { initialUrl: url });

    expect(await screen.findByText("Home")).toBeTruthy();
    expect(rootStack(result)).toEqual(["(tabs)"]);
    expect(mockHideAsync).toHaveBeenCalled();
  });

  it("lands on sign-in for someone signed out", async () => {
    mockAuth = { ...mockAuth, isGuest: false };
    renderRouter(routes(), { initialUrl: "/workouts" });
    expect(await screen.findByText("Sign in")).toBeTruthy();
  });

  it("leaves someone already in the app where they were", async () => {
    renderRouter(routes(), { initialUrl: "/" });
    act(() => router.push("/workout/w1"));
    // Not a route on purpose: the typed routes would refuse it otherwise.
    act(() => router.navigate("/nowhere" as Href));

    expect(await screen.findByText("Workout")).toBeTruthy();
  });
});

it("never shows the built-in sitemap, which crashes release builds", async () => {
  const result = renderRouter(routes(), { initialUrl: "/_sitemap" });

  expect(await screen.findByText("Home")).toBeTruthy();
  expect(rootStack(result)).toEqual(["(tabs)"]);
});

/** What the resume bar relies on: see active-workout-bar. */
it("opens one workout screen for a double tap that navigates", async () => {
  const result = renderRouter(routes(), { initialUrl: "/" });

  act(() => {
    router.navigate("/workout/w1");
    router.navigate("/workout/w1");
  });

  expect(await screen.findByText("Workout")).toBeTruthy();
  expect(rootStack(result)).toEqual(["(tabs)", "workout/[id]"]);
});
