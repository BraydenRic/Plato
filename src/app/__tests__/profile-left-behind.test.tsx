import { fireEvent, render, screen } from "@testing-library/react-native";

import ProfileScreen from "../(tabs)/profile";

/**
 * Moving a guest's data in can hit the account's limits. When that move
 * finished behind the app, it couldn't say so: they may have been mid-workout,
 * and nothing may pop up then. Profile says it instead, inline and quietly,
 * until it's dismissed.
 */

let mockLeftBehind: string | null = null;
const mockDismiss = jest.fn();

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { email: "lifter@example.com", displayName: "Lifter", emailVerified: true, providerData: [{ providerId: "apple.com" }] },
    isGuest: false,
    discardGuestData: jest.fn(),
    signOut: jest.fn(),
    updateDisplayName: jest.fn(),
    deleteAccount: jest.fn(),
    refreshUser: jest.fn(async () => {}),
    resendVerificationEmail: jest.fn(),
    leftBehind: mockLeftBehind,
    dismissLeftBehind: mockDismiss,
  }),
}));
jest.mock("@/hooks/use-bodyweight", () => ({
  useBodyweight: () => ({ log: [], loading: false, record: jest.fn(), remove: jest.fn(), latest: null }),
}));
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));
jest.mock("@/context/ThemeContext", () => ({
  useThemePicker: () => ({
    themeId: "violet",
    setThemeId: jest.fn(),
    theme: { id: "violet", label: "Violet", accent: "#8b5cf6", accentSoft: "rgba(0,0,0,0.1)", accentText: "#c4b5fd", accentMuted: "#c4b5fd", onAccent: "#fff", activityTint: "#8b5cf6", iconName: null },
  }),
  useTheme: () => ({ accent: "#8b5cf6", accentText: "#c4b5fd", accentSoft: "rgba(0,0,0,0.1)" }),
}));
jest.mock("@/context/UnitContext", () => ({ useWeightUnit: () => ({ unit: "lbs", setUnit: jest.fn() }) }));
jest.mock("@/context/RestTimerContext", () => ({
  useRestTimer: () => ({ restSeconds: 90, setRestSeconds: jest.fn() }),
  REST_OPTIONS: [{ seconds: 90, label: "1:30" }],
  nearestRestIndex: () => 0,
}));
jest.mock("@/context/DefaultSetsContext", () => ({
  useDefaultSets: () => ({ defaultSets: 3, setDefaultSets: jest.fn() }),
  MIN_SETS: 1,
  MAX_SETS: 10,
}));
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("@/components/sparkline", () => ({ Sparkline: () => null }));

beforeEach(() => {
  mockDismiss.mockClear();
});

it("says what couldn't come over from guest mode, and lets it be dismissed", () => {
  mockLeftBehind = "2 custom exercises and 1 template";

  render(<ProfileScreen />);

  expect(
    screen.getByText(/^2 custom exercises and 1 template from guest mode couldn't come over/)
  ).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Dismiss"));
  expect(mockDismiss).toHaveBeenCalledTimes(1);
});

it("says nothing when everything came across", () => {
  mockLeftBehind = null;

  render(<ProfileScreen />);

  expect(screen.queryByText(/couldn't come over/)).toBeNull();
  expect(screen.queryByLabelText("Dismiss")).toBeNull();
});
