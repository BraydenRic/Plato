import { fireEvent, render, screen } from "@testing-library/react-native";
import { Alert, type AlertButton } from "react-native";

import ProfileScreen from "../(tabs)/profile";

/**
 * Deleting an account is the one thing in the app that can't be undone, so the
 * gate in front of it is worth asserting rather than eyeballing.
 *
 * The steps either side of the typed word are both tappable by accident — a
 * destructive alert button lands where a thumb already is, and the password
 * sheet after it is muscle memory. Typing the word is the only part that can't
 * be completed without reading it, which is exactly why the wrong-word case
 * matters more here than the right-word one.
 */

const mockDeleteAccount = jest.fn(async () => {});
const mockDiscardGuestData = jest.fn(async () => {});
let mockIsGuest = false;

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      email: "lifter@example.com",
      displayName: "Lifter",
      emailVerified: true,
      // A password account, so re-auth is the password prompt rather than a
      // native social sheet.
      providerData: [{ providerId: "password" }],
    },
    isGuest: mockIsGuest,
    discardGuestData: mockDiscardGuestData,
    signOut: jest.fn(),
    updateDisplayName: jest.fn(),
    deleteAccount: mockDeleteAccount,
    refreshUser: jest.fn(async () => {}),
    resendVerificationEmail: jest.fn(),
  }),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));

jest.mock("@/hooks/use-bodyweight", () => ({
  useBodyweight: () => ({ log: [], loading: false, record: jest.fn(), latest: null }),
}));

jest.mock("@/context/ThemeContext", () => ({
  useThemePicker: () => ({
    themeId: "violet",
    setThemeId: jest.fn(),
    theme: {
      id: "violet",
      label: "Violet",
      accent: "#7c3aed",
      accentSoft: "rgba(124,58,237,0.12)",
      accentText: "#a78bfa",
      accentMuted: "#6d28d9",
      onAccent: "#ffffff",
      activityTint: "#7c3aed",
      iconName: null,
    },
  }),
  useTheme: () => ({ accent: "#7c3aed", accentText: "#a78bfa", accentSoft: "rgba(0,0,0,0.1)" }),
}));

jest.mock("@/context/UnitContext", () => ({
  useWeightUnit: () => ({ unit: "lbs", setUnit: jest.fn() }),
}));

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
jest.mock("@/components/bodyweight-chart", () => ({ BodyweightChart: () => null }));
jest.mock("@/components/sparkline", () => ({ Sparkline: () => null }));

let alertSpy: jest.SpyInstance;
let promptSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  mockIsGuest = false;
  // Alerts are inert here: each is recorded, and the test presses its buttons
  // itself. That's the only way to walk a chain of nested alerts.
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  promptSpy = jest.spyOn(Alert, "prompt").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** The buttons of the most recent Alert.alert whose title matches. */
function alertButtons(title: string): AlertButton[] {
  const call = [...alertSpy.mock.calls].reverse().find((c) => c[0] === title);
  if (!call) throw new Error(`No alert titled "${title}". Saw: ${alertSpy.mock.calls.map((c) => c[0]).join(", ")}`);
  return (call[2] ?? []) as AlertButton[];
}

function promptCall(title: string) {
  const call = [...promptSpy.mock.calls].reverse().find((c) => c[0] === title);
  if (!call) throw new Error(`No prompt titled "${title}". Saw: ${promptSpy.mock.calls.map((c) => c[0]).join(", ")}`);
  return { buttons: (call[2] ?? []) as AlertButton[] };
}

const press = (buttons: AlertButton[], text: string) => {
  const button = buttons.find((b) => b.text === text);
  if (!button) throw new Error(`No "${text}" button. Saw: ${buttons.map((b) => b.text).join(", ")}`);
  (button.onPress as ((value?: string) => void) | undefined)?.();
};

const type = (buttons: AlertButton[], text: string, typed: string) => {
  const button = buttons.find((b) => b.text === text);
  (button?.onPress as ((value?: string) => void) | undefined)?.(typed);
};

/** Walk from the Delete account button to the typed-word prompt. */
function reachTypedConfirmation() {
  render(<ProfileScreen />);
  fireEvent.press(screen.getByText("Delete account"));
  press(alertButtons("Delete account?"), "Continue");
  return promptCall("Type DELETE to confirm").buttons;
}

it("asks for the word before anything that deletes", () => {
  const buttons = reachTypedConfirmation();

  // Nothing destructive has been offered yet — the password sheet is still
  // behind the typed word.
  expect(promptSpy.mock.calls.map((c) => c[0])).not.toContain("Confirm your password");
  expect(buttons.map((b) => b.text)).toEqual(["Cancel", "Continue"]);
});

it.each(["", "delet", "DELETE ACCOUNT", "yes"])(
  "refuses to go on when %p is typed",
  (typed) => {
    const buttons = reachTypedConfirmation();

    type(buttons, "Continue", typed);

    expect(mockDeleteAccount).not.toHaveBeenCalled();
    expect(promptSpy.mock.calls.map((c) => c[0])).not.toContain("Confirm your password");
    expect(alertSpy.mock.calls.map((c) => c[0])).toContain("That didn't match");
  }
);

it.each(["DELETE", "delete", " Delete "])("accepts %p and moves on to re-auth", (typed) => {
  const buttons = reachTypedConfirmation();

  type(buttons, "Continue", typed);

  // Through the gate, but still not deleted — the password is the last step.
  expect(promptSpy.mock.calls.map((c) => c[0])).toContain("Confirm your password");
  expect(mockDeleteAccount).not.toHaveBeenCalled();

  press(promptCall("Confirm your password").buttons, "Delete forever");
  expect(mockDeleteAccount).toHaveBeenCalled();
});

it("gates a guest wiping their data behind the same word", () => {
  mockIsGuest = true;
  render(<ProfileScreen />);

  fireEvent.press(screen.getByText("Delete all data"));
  press(alertButtons("Delete all data?"), "Continue");

  const buttons = promptCall("Type DELETE to confirm").buttons;
  type(buttons, "Continue", "nope");
  expect(mockDiscardGuestData).not.toHaveBeenCalled();

  type(buttons, "Continue", "DELETE");
  expect(mockDiscardGuestData).toHaveBeenCalled();
});
