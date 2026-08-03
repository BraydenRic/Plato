import { ActivityIndicator, Text } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { Button, Card, Chip, Divider, EmptyState, Field, SectionLabel, Stepper } from "../ui";

// Pulls in expo-font's native loader, which has no place in a unit test.
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");


/**
 * The shared primitives every screen is built from. These are the pieces where
 * a regression is invisible in a type check but obvious in the hand — a button
 * that still fires while it's mid-request, a spinner that never replaces its
 * label — so the tests are about behaviour under state, not appearance.
 */

describe("Button", () => {
  it("shows its title", () => {
    render(<Button title="Finish workout" />);
    expect(screen.getByText("Finish workout")).toBeTruthy();
  });

  it("calls onPress when tapped", () => {
    const onPress = jest.fn();
    render(<Button title="Save" onPress={onPress} />);
    fireEvent.press(screen.getByText("Save"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("swaps the label for a spinner while loading", () => {
    render(<Button title="Signing in" loading />);
    expect(screen.queryByText("Signing in")).toBeNull();
    expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it("ignores presses while loading, so a request can't be fired twice", () => {
    const onPress = jest.fn();
    render(<Button title="Save" loading onPress={onPress} testID="btn" />);
    fireEvent.press(screen.getByTestId("btn"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("ignores presses while disabled", () => {
    const onPress = jest.fn();
    render(<Button title="Save" disabled onPress={onPress} />);
    fireEvent.press(screen.getByText("Save"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it.each(["primary", "secondary", "ghost", "danger"] as const)(
    "renders the %s variant with its title intact",
    (variant) => {
      render(<Button title="Action" variant={variant} />);
      expect(screen.getByText("Action")).toBeTruthy();
    }
  );

  it("still renders when handed a function style, which it cannot merge", () => {
    // The Pressable style callback and a caller-supplied function style can't
    // both win; the component drops the latter rather than crashing.
    render(<Button title="Action" style={() => ({ margin: 4 })} />);
    expect(screen.getByText("Action")).toBeTruthy();
  });
});

describe("Chip", () => {
  it("shows its label", () => {
    render(<Chip label="Chest" />);
    expect(screen.getByText("Chest")).toBeTruthy();
  });

  it("calls onPress when tapped", () => {
    const onPress = jest.fn();
    render(<Chip label="Chest" onPress={onPress} />);
    fireEvent.press(screen.getByText("Chest"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("renders in both the active and inactive states", () => {
    const { rerender } = render(<Chip label="Chest" />);
    expect(screen.getByText("Chest")).toBeTruthy();
    rerender(<Chip label="Chest" active />);
    expect(screen.getByText("Chest")).toBeTruthy();
  });

  it("is inert without an onPress", () => {
    render(<Chip label="Chest" />);
    expect(() => fireEvent.press(screen.getByText("Chest"))).not.toThrow();
  });
});

describe("Field", () => {
  it("passes its value and placeholder through", () => {
    render(<Field value="185" placeholder="Weight" onChangeText={() => {}} />);
    expect(screen.getByPlaceholderText("Weight").props.value).toBe("185");
  });

  it("reports typing to onChangeText", () => {
    const onChangeText = jest.fn();
    render(<Field placeholder="Weight" onChangeText={onChangeText} />);
    fireEvent.changeText(screen.getByPlaceholderText("Weight"), "225");
    expect(onChangeText).toHaveBeenCalledWith("225");
  });

  it("forwards a ref, which the keypad bar needs to focus the next input", () => {
    const ref = { current: null };
    render(<Field ref={ref} placeholder="Weight" />);
    expect(ref.current).not.toBeNull();
  });
});

describe("EmptyState", () => {
  it("shows both the title and the message", () => {
    render(<EmptyState title="No workouts yet" message="Start one to see it here." />);
    expect(screen.getByText("No workouts yet")).toBeTruthy();
    expect(screen.getByText("Start one to see it here.")).toBeTruthy();
  });
});

describe("layout primitives", () => {
  it("Card renders whatever it wraps", () => {
    render(
      <Card>
        <Text>inside</Text>
      </Card>
    );
    expect(screen.getByText("inside")).toBeTruthy();
  });

  it("SectionLabel renders its children", () => {
    render(<SectionLabel>Preferences</SectionLabel>);
    expect(screen.getByText("Preferences")).toBeTruthy();
  });

  it("Divider renders without needing any props", () => {
    expect(() => render(<Divider />)).not.toThrow();
  });
});

describe("Stepper", () => {
  /**
   * Replaces a segmented control wherever the option list outgrew its row, so
   * the parts that matter are the bounds (a stepper that steps past the end of
   * its list hands the caller an index that isn't there) and the accessibility
   * contract, since the two buttons are icons with no text of their own.
   */

  function setup(overrides: Partial<React.ComponentProps<typeof Stepper>> = {}) {
    const onStep = jest.fn();
    render(
      <Stepper
        accessibilityLabel="Rest timer"
        value="1:30"
        onStep={onStep}
        canDecrement
        canIncrement
        testID="stepper"
        {...overrides}
      />
    );
    return onStep;
  }

  it("shows the current value", () => {
    setup();
    expect(screen.getByText("1:30")).toBeTruthy();
  });

  it("steps up and down", () => {
    const onStep = setup();
    fireEvent.press(screen.getByTestId("stepper-increment"));
    expect(onStep).toHaveBeenCalledWith(1);
    fireEvent.press(screen.getByTestId("stepper-decrement"));
    expect(onStep).toHaveBeenCalledWith(-1);
  });

  it("won't step below the first option", () => {
    const onStep = setup({ canDecrement: false });
    fireEvent.press(screen.getByTestId("stepper-decrement"));
    expect(onStep).not.toHaveBeenCalled();
  });

  it("won't step past the last option", () => {
    const onStep = setup({ canIncrement: false });
    fireEvent.press(screen.getByTestId("stepper-increment"));
    expect(onStep).not.toHaveBeenCalled();
  });

  it("presents itself to VoiceOver as one adjustable control", () => {
    setup();
    const control = screen.getByLabelText("Rest timer");
    // Without this the two icon buttons are announced as unlabelled buttons.
    expect(control.props.accessibilityRole).toBe("adjustable");
    expect(control.props.accessibilityValue).toEqual({ text: "1:30" });
  });

  it("responds to the VoiceOver adjust gesture, not just taps", () => {
    const onStep = setup();
    const control = screen.getByLabelText("Rest timer");
    fireEvent(control, "accessibilityAction", { nativeEvent: { actionName: "increment" } });
    expect(onStep).toHaveBeenCalledWith(1);
    fireEvent(control, "accessibilityAction", { nativeEvent: { actionName: "decrement" } });
    expect(onStep).toHaveBeenCalledWith(-1);
  });
});
