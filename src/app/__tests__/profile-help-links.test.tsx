import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Alert, Linking, StyleSheet } from "react-native";

import ProfileScreen from "../(tabs)/profile";
import { PRIVACY_POLICY_URL, SUPPORT_EMAIL } from "@/constants/links";

/**
 * Apple wants the privacy policy linked from inside the app, not only from
 * the listing (guideline 5.1.1), and a way to get in touch (1.5). Profile's
 * Help card has both, and each opens outside Plato.
 */

const mockUpdateDisplayName = jest.fn(async (_name: string) => {});
jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { email: "lifter@example.com", displayName: "Lifter", emailVerified: true, providerData: [{ providerId: "apple.com" }] },
    isGuest: false,
    discardGuestData: jest.fn(),
    signOut: jest.fn(),
    updateDisplayName: mockUpdateDisplayName,
    deleteAccount: jest.fn(),
    refreshUser: jest.fn(async () => {}),
    resendVerificationEmail: jest.fn(),
    leftBehind: null,
    dismissLeftBehind: jest.fn(),
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
    theme: { id: "violet", label: "Violet", accent: "#8b5cf6", accentSoft: "rgba(0,0,0,0.1)", accentText: "#c4b5fd", onAccent: "#fff", activityTint: "#8b5cf6", iconName: null },
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
// An installed build: EAS's number in the app's Info.plist, app.json's "1" in the config.
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "1.2.0", ios: { buildNumber: "1" } }, platform: { ios: { buildNumber: "73" } } },
}));
jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("@/components/sparkline", () => ({ Sparkline: () => null }));

let openURL: jest.SpyInstance;
let alert: jest.SpyInstance;

beforeEach(() => {
  // React Native's Jest setup already mocks openURL, and spying on a mock
  // hands back that same one, so its calls would carry over between tests.
  openURL = jest.spyOn(Linking, "openURL").mockClear().mockResolvedValue(true);
  alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("opens the privacy policy where the listing points", () => {
  render(<ProfileScreen />);
  fireEvent.press(screen.getByRole("link", { name: "Privacy policy" }));
  expect(openURL).toHaveBeenCalledWith(PRIVACY_POLICY_URL);
});

it("starts an email to support, with the build and iOS version filled in", () => {
  render(<ProfileScreen />);
  expect(screen.getByText(SUPPORT_EMAIL)).toBeTruthy();

  fireEvent.press(screen.getByRole("link", { name: "Contact support" }));

  expect(openURL).toHaveBeenCalledTimes(1);
  const url: string = openURL.mock.calls[0][0];
  expect(url.startsWith(`mailto:${SUPPORT_EMAIL}?subject=Plato%20support&body=`)).toBe(true);
  expect(decodeURIComponent(url.split("&body=")[1])).toMatch(/^\n\n\nPlato \S+ \(\S+\) · iOS /);
});

it("says where to write when there's no mail app to open", async () => {
  openURL.mockRejectedValueOnce(new Error("No mail account"));
  render(<ProfileScreen />);

  await act(async () => {
    fireEvent.press(screen.getByRole("link", { name: "Contact support" }));
  });

  expect(alert).toHaveBeenCalledWith("Couldn't open Mail", `Email us at ${SUPPORT_EMAIL}.`);
});

// The rows grow taller rather than cutting text off: nothing caps their lines,
// and the text takes the room between the icons, so it wraps there at the
// largest sizes and on the narrowest phones alike.
it("never cuts the rows' text off, at any text size or width", () => {
  render(<ProfileScreen />);
  for (const text of ["Contact support", SUPPORT_EMAIL, "Privacy policy", "What Plato keeps, and where"]) {
    const node = screen.getByText(text);
    expect(node.props.numberOfLines).toBeUndefined();
    expect(StyleSheet.flatten(node.parent!.parent!.props.style)).toMatchObject({ flex: 1 });
  }
});

// EAS hands the build number out at build time, so the config's copy stays at
// app.json's "1". The installed app's own number is the one support needs.
it("says which build this is by the installed app's number, not the config's", () => {
  render(<ProfileScreen />);
  expect(screen.getByText("Version 1.2.0 (73)")).toBeTruthy();

  fireEvent.press(screen.getByRole("link", { name: "Contact support" }));
  expect(decodeURIComponent(openURL.mock.calls[0][0].split("&body=")[1])).toContain("Plato 1.2.0 (73)");
});

// The system prompt has no length limit, so Profile cuts the name to the cap
// the name fields have, and by character, so an emoji at the cut stays whole.
it("cuts a long name at 60 characters without splitting an emoji", async () => {
  const prompt = jest.spyOn(Alert, "prompt").mockImplementation(() => {});
  render(<ProfileScreen />);
  fireEvent.press(screen.getByRole("button", { name: "Edit name" }));

  const buttons = prompt.mock.calls[0][2] as { text: string; onPress?: (value?: string) => Promise<void> }[];
  await act(async () => {
    await buttons.find((b) => b.text === "Save")!.onPress!("a".repeat(59) + "💪💪");
  });
  expect(mockUpdateDisplayName).toHaveBeenCalledWith("a".repeat(59) + "💪");
});
