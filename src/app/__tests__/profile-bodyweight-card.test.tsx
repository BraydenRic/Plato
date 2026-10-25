import { fireEvent, render, screen } from "@testing-library/react-native";
import { Alert, StyleSheet } from "react-native";

import ProfileScreen from "../(tabs)/profile";
import { FontScaleCap } from "@/constants/theme";
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
const mockRecord = jest.fn(async (_lbs: number) => {});
// RN's own test default is 2, which every test here ran at before; the
// large-text tests set their own.
let mockFontScale = 2;
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 375, height: 667, scale: 3, fontScale: mockFontScale }),
}));

jest.mock("@/hooks/use-bodyweight", () => ({
  useBodyweight: () => ({
    log: mockLog,
    loading: false,
    record: (lbs: number) => mockRecord(lbs),
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
  mockFontScale = 2;
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

describe("the weigh-in prompt", () => {
  /** Opens the prompt from the + and taps Save with `typed`. */
  function saveWeighIn(typed: string) {
    const prompt = jest.spyOn(Alert, "prompt").mockImplementation(() => {});
    fireEvent.press(screen.getByLabelText("Log today's weigh-in"));
    const buttons = prompt.mock.calls[0][2] as { text: string; onPress?: (value?: string) => void }[];
    buttons.find((b) => b.text === "Save")!.onPress!(typed);
    prompt.mockRestore();
  }

  beforeEach(() => {
    mockLog = [];
    mockRecord.mockClear();
  });

  it("takes a decimal comma, which is what the decimal pad types in much of Europe", () => {
    render(<ProfileScreen />);
    saveWeighIn("182,5");
    expect(mockRecord).toHaveBeenCalledWith(182.5);
  });

  it("still takes a decimal point", () => {
    render(<ProfileScreen />);
    saveWeighIn("182.5");
    expect(mockRecord).toHaveBeenCalledWith(182.5);
  });

  it("still ignores something that isn't a weight", () => {
    render(<ProfileScreen />);
    saveWeighIn("abc");
    expect(mockRecord).not.toHaveBeenCalled();
  });
});

describe("read aloud", () => {
  it("names the pencil that renames you", () => {
    render(<ProfileScreen />);
    expect(screen.getByRole("button", { name: "Edit name" })).toBeTruthy();
  });

  it("says which weight unit is on, not just by its fill", () => {
    render(<ProfileScreen />);
    expect(screen.getByRole("button", { name: "lbs" }).props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByRole("button", { name: "kg" }).props.accessibilityState).toEqual({ selected: false });
  });
});

describe("the bodyweight row at large text sizes", () => {
  beforeEach(() => {
    // A weigh-in from Tuesday, so the day is on the row too: the widest case.
    mockLog = [{ date: new Date(2026, 7, 4), lbs: 195 }];
  });

  const row = () => screen.getByText("Bodyweight").parent!.parent!;

  it("lays the reading beside the label at the default size", () => {
    mockFontScale = 1;
    render(<ProfileScreen />);
    expect(StyleSheet.flatten(row().props.style).flexDirection).toBe("row");
  });

  it("drops the reading under the label past a mild bump, like the Preferences cards", () => {
    // XXXL. Side by side, "Bodyweight · 195 lbs · Tuesday" ran under the +.
    mockFontScale = 1.353;
    render(<ProfileScreen />);
    expect(StyleSheet.flatten(row().props.style).flexDirection).toBe("column");
  });

  it("lets the reading wrap rather than overflow, and caps the label", () => {
    mockFontScale = 1.235;
    render(<ProfileScreen />);
    const reading = StyleSheet.flatten(screen.getByText("195 lbs").parent!.parent!.props.style);
    expect(reading).toMatchObject({ flexShrink: 1, flexWrap: "wrap" });
    expect(screen.getByText("Bodyweight").props.maxFontSizeMultiplier).toBe(FontScaleCap.heading);
  });
});
