import { render, screen } from "@testing-library/react-native";

import ProfileScreen from "../(tabs)/profile";
import type { BodyweightEntry } from "@/types";

/**
 * The card shows one number and no date, so the number has to say for itself
 * whether it is current. Left plain, a weigh-in from last Tuesday reads as this
 * morning's — and this is the only place in the app the figure appears without
 * its day attached.
 *
 * Asserted through the accessibility label as well as the visible text, because
 * the visual half of the distinction is a colour, and a colour is exactly what
 * a screen reader cannot pass on.
 */

const NOW = new Date(2026, 7, 7, 9, 0);
let mockLog: BodyweightEntry[] = [];

jest.mock("@/hooks/use-bodyweight", () => ({
  useBodyweight: () => ({
    log: mockLog,
    loading: false,
    record: jest.fn(),
    remove: jest.fn(),
    latest: mockLog.length > 0 ? mockLog[mockLog.length - 1] : null,
  }),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { email: "lifter@example.com", displayName: "Lifter", emailVerified: true, providerData: [{ providerId: "password" }] },
    isGuest: false,
    discardGuestData: jest.fn(),
    signOut: jest.fn(),
    updateDisplayName: jest.fn(),
    deleteAccount: jest.fn(),
    refreshUser: jest.fn(async () => {}),
    resendVerificationEmail: jest.fn(),
  }),
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
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

const cardLabel = () =>
  screen.getByLabelText(/Bodyweight,/).props.accessibilityLabel as string;

it("names the day when the newest weigh-in isn't today's", () => {
  mockLog = [{ date: new Date(2026, 7, 4), lbs: 195 }];

  render(<ProfileScreen />);

  // Still shown — it is the truth, just not today's truth.
  expect(screen.getByText("195 lbs")).toBeTruthy();
  expect(screen.getByText("· Tuesday")).toBeTruthy();
  expect(cardLabel()).toContain("logged Tuesday");
});

it("says nothing about the day when it is today's", () => {
  mockLog = [{ date: new Date(2026, 7, 7, 7, 15), lbs: 190 }];

  render(<ProfileScreen />);

  expect(screen.getByText("190 lbs")).toBeTruthy();
  expect(screen.queryByText(/^· /)).toBeNull();
  expect(cardLabel()).toContain("logged Today");
});

it("matches on the day, not on the hour it was logged", () => {
  // Logged at 06:00, read at 09:00. Same day, so still current.
  mockLog = [{ date: new Date(2026, 7, 7, 6, 0), lbs: 190 }];

  render(<ProfileScreen />);

  expect(screen.queryByText(/^· /)).toBeNull();
});

it("calls yesterday yesterday", () => {
  mockLog = [{ date: new Date(2026, 7, 6, 8, 0), lbs: 191 }];

  render(<ProfileScreen />);

  expect(screen.getByText("· Yesterday")).toBeTruthy();
});

it("shows a dash and no day when nothing has ever been logged", () => {
  mockLog = [];

  render(<ProfileScreen />);

  expect(screen.getByText("—")).toBeTruthy();
  expect(cardLabel()).toContain("none logged yet");
});
