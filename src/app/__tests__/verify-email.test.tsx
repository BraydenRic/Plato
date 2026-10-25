import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

import VerifyEmailScreen from "../verify-email";

/**
 * "I've tapped the link" is pressed straight after coming back from Mail, so
 * the check usually finds the address verified. The root guard then swaps
 * this screen for the app, but the press handler carries on regardless, and
 * it used to finish by saying "Not verified yet" over the app it had just
 * opened.
 */

const mockRefreshUser = jest.fn(async () => false);

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { email: "lifter@example.com" },
    signOut: jest.fn(),
    refreshUser: mockRefreshUser,
    resendVerificationEmail: jest.fn(),
  }),
}));

// Pulls in expo-font's native loader, which has no place in a unit test.
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");

let alert: jest.SpyInstance;

beforeEach(() => {
  mockRefreshUser.mockReset();
  alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("says nothing once the check finds the address verified", async () => {
  mockRefreshUser.mockResolvedValue(true);
  render(<VerifyEmailScreen />);

  fireEvent.press(screen.getByText("I've tapped the link"));

  await waitFor(() => expect(mockRefreshUser).toHaveBeenCalled());
  // Let the handler run to its end before checking it stayed quiet.
  await act(async () => {});
  expect(alert).not.toHaveBeenCalled();
});

it("says so when the link hasn't been tapped yet", async () => {
  mockRefreshUser.mockResolvedValue(false);
  render(<VerifyEmailScreen />);

  fireEvent.press(screen.getByText("I've tapped the link"));

  await waitFor(() => expect(alert).toHaveBeenCalledWith("Not verified yet", expect.any(String)));
});
