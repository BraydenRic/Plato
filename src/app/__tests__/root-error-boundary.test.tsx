import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { ErrorBoundary } from "../_layout";

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

// Stubbed to import the module at all — these reach Firebase's ESM build, which
// jest can't parse. They are siblings of the boundary in _layout, never
// dependencies of it, so replacing them costs the test nothing.
jest.mock("@/context/AuthContext", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ user: null, loading: false, isGuest: false, migrating: false }),
}));
jest.mock("@/components/bodyweight-volume-repair", () => ({ BodyweightVolumeRepair: () => null }));
jest.mock("@/components/live-activity-sync", () => ({ LiveActivitySync: () => null }));

// ThemeContext is deliberately NOT mocked. The boundary renders in place of
// RootLayout, so ThemeProvider is not mounted around it, and Button calls
// useTheme() regardless — this is what proves the default value carries it.

beforeEach(() => {
  mockHideAsync.mockClear();
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
