import { fireEvent, render, screen } from "@testing-library/react-native";

import SignInScreen from "../sign-in";

/**
 * The sign-in screen's two exits for someone without an account: entering guest
 * mode on a first run, and backing out when a guest opened this screen from
 * Profile to claim their data. The `upgrade` param is the only thing telling
 * those apart, and they need opposite behaviour, so the branch is worth pinning.
 *
 * Everything the screen touches to authenticate is mocked — the point here is
 * the routing and the affordances, not Firebase.
 */

const mockContinueAsGuest = jest.fn(async () => {});
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams: { upgrade?: string } = {};
let mockIsGuest = false;

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack, push: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    signIn: jest.fn(),
    signUp: jest.fn(),
    signInWithGoogle: jest.fn(),
    canUseGoogle: false,
    signInWithApple: jest.fn(),
    canUseApple: false,
    resetPassword: jest.fn(),
    isGuest: mockIsGuest,
    continueAsGuest: mockContinueAsGuest,
  }),
}));

jest.mock("expo-apple-authentication", () => ({
  AppleAuthenticationButton: () => null,
  AppleAuthenticationButtonType: { SIGN_IN: 0 },
  AppleAuthenticationButtonStyle: { WHITE: 0 },
  isAvailableAsync: jest.fn(async () => false),
}));

jest.mock("expo-image", () => ({ Image: () => null }));

// Pulls in expo-font's native loader, which has no place in a unit test.
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");

// firebase/app ships ESM that jest won't transform, and the screen only needs
// the error class to recognise auth failures — none of which these tests raise.
jest.mock("firebase/app", () => ({
  FirebaseError: class FirebaseError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockIsGuest = false;
});

describe("the guest exit on a first run", () => {
  it("offers to continue as a guest", () => {
    render(<SignInScreen />);
    expect(screen.getByText("Continue as guest")).toBeTruthy();
  });

  it("says where the data lives, so skipping the account is an informed choice", () => {
    render(<SignInScreen />);
    expect(screen.getByText(/Workouts save on this phone/)).toBeTruthy();
  });

  it("enters guest mode when tapped", () => {
    render(<SignInScreen />);
    fireEvent.press(screen.getByText("Continue as guest"));
    expect(mockContinueAsGuest).toHaveBeenCalledTimes(1);
  });

  it("does not offer a way to back out, since there is nothing behind it", () => {
    render(<SignInScreen />);
    expect(screen.queryByText("Not now")).toBeNull();
  });
});

describe("a guest arriving from Profile to claim their data", () => {
  beforeEach(() => {
    mockParams = { upgrade: "1" };
    mockIsGuest = true;
  });

  it("offers a way back to the app they are already using", () => {
    render(<SignInScreen />);
    expect(screen.getByText("Not now")).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText("Not now"));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("does not offer guest mode again to someone already in it", () => {
    render(<SignInScreen />);
    expect(screen.queryByText("Continue as guest")).toBeNull();
  });

  it("promises the data comes with them", () => {
    render(<SignInScreen />);
    expect(screen.getByText(/moves into your account/)).toBeTruthy();
  });

  it("stays put rather than bouncing to the app, unlike a plain guest", () => {
    render(<SignInScreen />);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe("a guest who lands here without meaning to", () => {
  it("is stepped back into the app, since entering guest mode does not navigate", () => {
    mockIsGuest = true;
    mockParams = {};
    render(<SignInScreen />);
    expect(mockReplace).toHaveBeenCalledWith("/");
  });
});
