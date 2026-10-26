import { Text } from "react-native";
import { router, Stack, type Href } from "expo-router";
import { act, renderRouter, screen } from "expo-router/testing-library";

import * as RootLayoutModule from "../_layout";
import * as NativeIntent from "../+native-intent";
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

// Where links arriving while the app is open come in. The router subscribes
// here, so a test can deliver one the way iOS does.
const mockUrlListeners = new Set<(event: { url: string }) => unknown>();
jest.mock("expo-linking", () => ({
  ...jest.requireActual("expo-linking"),
  createURL: (path: string) => `plato://${path}`,
  resolveScheme: () => "plato",
  addEventListener: (_type: string, listener: (event: { url: string }) => unknown) => {
    mockUrlListeners.add(listener);
    return { remove: () => mockUrlListeners.delete(listener) };
  },
}));

/** A tap on the Live Activity with Plato already running. */
async function openLink(url: string) {
  await act(async () => {
    await Promise.all([...mockUrlListeners].map((listener) => listener({ url })));
  });
}

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
    "+native-intent": NativeIntent,
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

/** Which screen instance each root stack entry is, so a fresh copy shows up. */
function rootKeys(result: ReturnType<typeof renderRouter>): (string | undefined)[] {
  return result.getRouterState()?.routes[0]?.state?.routes.map((route) => route.key) ?? [];
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

describe("a tap on the Live Activity with Plato already open", () => {
  // The router reuses only the screen on top, so this used to push a second
  // copy of the workout inside the picker's sheet. Finishing there went back
  // to the picker, which then added sets to a finished workout.
  it("goes back to the workout under the add-exercise picker, not a second copy of it", async () => {
    const result = renderRouter(routes(), { initialUrl: "/" });
    act(() => router.push("/workout/w1"));
    act(() => router.push("/add-exercise"));
    expect(rootStack(result)).toEqual(["(tabs)", "workout/[id]", "add-exercise"]);
    const [, workout] = rootKeys(result);

    await openLink("plato:///workout/w1");

    expect(rootStack(result)).toEqual(["(tabs)", "workout/[id]"]);
    expect(rootKeys(result)[1]).toBe(workout);
  });

  it("opens the workout as before when it isn't open yet", async () => {
    const result = renderRouter(routes(), { initialUrl: "/" });

    await openLink("plato:///workout/w1");

    expect(await screen.findByText("Workout")).toBeTruthy();
    expect(rootStack(result)).toEqual(["(tabs)", "workout/[id]"]);
  });

  it("leaves the workout where it is when it is already in front", async () => {
    const result = renderRouter(routes(), { initialUrl: "/" });
    act(() => router.push("/workout/w1"));
    const [, workout] = rootKeys(result);

    await openLink("plato:///workout/w1");

    expect(rootStack(result)).toEqual(["(tabs)", "workout/[id]"]);
    expect(rootKeys(result)[1]).toBe(workout);
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
