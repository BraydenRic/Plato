import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { ScrollView, StyleSheet } from "react-native";

import { ErrorBoundary, ThemedStatusBar } from "../_layout";
import { FontScaleCap, PALETTES } from "@/constants/theme";
import { AppearanceProvider, useAppearance } from "@/context/AppearanceContext";

/**
 * The last line of defence: a render error that no screen caught.
 *
 * Worth pinning rather than trusting, because the failure mode is silent in the
 * one direction that matters. Nothing about this looks broken in development —
 * Metro's own red box sits on top of it, so the boundary is never actually seen
 * — and in a release build the same crash is a black window and a force-quit.
 *
 * The splash assertion is the reason this file exists. A crash during startup,
 * before RootNavigator has hidden the splash, leaves it up permanently and
 * covering this screen, which puts the app back to exactly the dead state the
 * boundary was added to prevent. It is also the least obvious line in the
 * component and the easiest one for a later tidy-up to decide is redundant.
 */

const mockHideAsync = jest.fn(async () => {});

jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: () => mockHideAsync(),
}));

jest.mock("expo-router", () => ({ Stack: () => null }));
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");

// The app's own mode, as UIKit reports it back. The boundary has to read it
// from here rather than from context — see below.
let mockScheme: "light" | "dark" | null = "dark";
jest.mock("react-native/Libraries/Utilities/Appearance", () => ({
  getColorScheme: () => mockScheme,
  setColorScheme: jest.fn(),
  addChangeListener: () => ({ remove: () => {} }),
}));
jest.mock("react-native/Libraries/Utilities/useColorScheme", () => ({
  __esModule: true,
  default: () => mockScheme,
}));

const mockStatusBarStyle = jest.fn();
jest.mock("expo-status-bar", () => ({
  StatusBar: ({ style }: { style: string }) => {
    mockStatusBarStyle(style);
    return null;
  },
}));

// Stubbed to import the module at all — these reach Firebase's ESM build, which
// jest can't parse. They are siblings of the boundary in _layout, never
// dependencies of it, so replacing them costs the test nothing.
jest.mock("@/context/AuthContext", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ user: null, loading: false, isGuest: false, migrating: false }),
}));
jest.mock("@/components/bodyweight-volume-repair", () => ({ BodyweightVolumeRepair: () => null }));
jest.mock("@/components/live-activity-sync", () => ({ LiveActivitySync: () => null }));
jest.mock("@/components/watch-sync", () => ({ WatchSync: () => null }));

// No provider is mounted around any of this on purpose. The boundary renders in
// place of RootLayout rather than inside it, so there is no context to read —
// which is exactly the condition these tests need to reproduce.

beforeEach(() => {
  mockHideAsync.mockClear();
  mockStatusBarStyle.mockClear();
  mockScheme = "dark";
});

it("says the data survived, because that is the user's first question", () => {
  render(<ErrorBoundary error={new Error("boom")} retry={jest.fn()} />);

  expect(screen.getByText(/Plato hit a snag/)).toBeTruthy();
  expect(screen.getByText(/Your workouts are safe/)).toBeTruthy();
});

it("shows the underlying message, the only place a release build ever does", () => {
  render(<ErrorBoundary error={new Error("Cannot read property 'sets' of undefined")} retry={jest.fn()} />);

  expect(screen.getByText("Cannot read property 'sets' of undefined")).toBeTruthy();
});

it("hides the splash, or a startup crash stays hidden behind it", async () => {
  render(<ErrorBoundary error={new Error("boom")} retry={jest.fn()} />);

  await waitFor(() => expect(mockHideAsync).toHaveBeenCalled());
});

it("survives the splash refusing to hide", async () => {
  mockHideAsync.mockRejectedValueOnce(new Error("no splash to hide"));

  render(<ErrorBoundary error={new Error("boom")} retry={jest.fn()} />);

  // An unhandled rejection here would be a crash inside the crash handler.
  await waitFor(() => expect(mockHideAsync).toHaveBeenCalled());
  expect(screen.getByText(/Plato hit a snag/)).toBeTruthy();
});

it("offers a way back", () => {
  const retry = jest.fn();
  render(<ErrorBoundary error={new Error("boom")} retry={retry} />);

  fireEvent.press(screen.getByText("Try again"));

  expect(retry).toHaveBeenCalledTimes(1);
});

/**
 * At AX4–AX5 the reassurance alone runs to half a dozen lines, and a long
 * release-mode message on top made the content taller than the window. Centred
 * in a plain view, the overflow fell off both edges and took "Try again" — the
 * only way out — below the screen.
 */
describe("at the largest text sizes", () => {
  it("scrolls, so 'Try again' can always be reached", () => {
    render(<ErrorBoundary error={new Error("x".repeat(400))} retry={jest.fn()} />);

    const scroller = screen.UNSAFE_getByType(ScrollView);
    expect(within(scroller).getByText("Try again")).toBeTruthy();
    // Centred while it fits, without pinning the height to the window.
    const content = StyleSheet.flatten(scroller.props.contentContainerStyle);
    expect(content).toEqual(expect.objectContaining({ flexGrow: 1, justifyContent: "center" }));
    expect(content).not.toHaveProperty("flex");
  });

  it("caps the display type, as every other screen does", () => {
    render(<ErrorBoundary error={new Error("boom")} retry={jest.fn()} />);

    expect(screen.getByText("Plato hit a snag").props.maxFontSizeMultiplier).toBe(FontScaleCap.title);
    expect(screen.getByText(/Your workouts are safe/).props.maxFontSizeMultiplier).toBe(FontScaleCap.heading);
    expect(screen.getByText("Try again").props.maxFontSizeMultiplier).toBe(FontScaleCap.button);
  });
});

/**
 * The crash screen can't use `usePalette` — there is no provider left standing
 * to read a mode from. It asks UIKit instead, where AppearanceProvider has
 * already pushed the app's own choice. Get that wrong and someone running Plato
 * in light mode meets a black screen the one time they most need to trust it.
 */
describe("the crash screen's colours", () => {
  function background() {
    return StyleSheet.flatten(screen.getByTestId("crash").props.style)?.backgroundColor;
  }

  it.each([
    ["dark", PALETTES.dark.bg],
    ["light", PALETTES.light.bg],
  ] as const)("paints itself for a %s app", (scheme, expected) => {
    mockScheme = scheme;
    render(<ErrorBoundary error={new Error("boom")} retry={jest.fn()} />);
    expect(background()).toBe(expected);
  });

  it("assumes dark when UIKit has no answer", () => {
    // A crash in the first frames, before anything has been pushed down.
    mockScheme = null;
    render(<ErrorBoundary error={new Error("boom")} retry={jest.fn()} />);
    expect(background()).toBe(PALETTES.dark.bg);
  });
});

describe("the status bar", () => {
  // Inverted against the page, or the clock and battery vanish into it — the
  // one piece of chrome the app doesn't draw but does have to keep legible.
  it("goes light on a dark page and dark on a light one", async () => {
    let setPref: (p: "light" | "dark" | "system") => void;
    function Control() {
      setPref = useAppearance().setPref;
      return null;
    }
    render(
      <AppearanceProvider>
        <Control />
        <ThemedStatusBar />
      </AppearanceProvider>
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockStatusBarStyle).toHaveBeenLastCalledWith("light");

    await act(async () => {
      setPref("light");
      await Promise.resolve();
    });
    expect(mockStatusBarStyle).toHaveBeenLastCalledWith("dark");
  });
});
