import { act, render } from "@testing-library/react-native";

import ReorderDayScreen from "../reorder-day";
import { sortDayWorkouts } from "@/lib/workout-utils";
import type { Workout } from "@/types";

/**
 * Two workouts on one day were listed in the order they started, with no way
 * to change it. Their order is now set here and kept in each workout's
 * orderIndex.
 */

const DAY = new Date(2026, 7, 4);
const mockUpdate = jest.fn(async () => {});
let mockActive: Workout[] = [];
let mockListProps: Record<string, any> = {};

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ day: String(new Date(2026, 7, 4).getTime()) }),
  router: { back: jest.fn() },
}));
jest.mock("@/hooks/use-workouts", () => ({
  useWorkouts: () => ({ active: mockActive, planned: [], completed: [] }),
}));
jest.mock("@/lib/data", () => ({ updateWorkout: (...args: unknown[]) => mockUpdate(...(args as [])) }));
jest.mock("@/context/ThemeContext", () => ({ useTheme: () => ({ accent: "#7c3aed", accentSoft: "#eee", accentText: "#a78bfa" }) }));
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children }));
jest.mock("react-native-draggable-flatlist", () => ({
  __esModule: true,
  default: (props: Record<string, any>) => {
    mockListProps = props;
    return props.data.map((item: unknown) => props.renderItem({ item, drag: () => {}, isActive: false }));
  },
  ScaleDecorator: ({ children }: { children: React.ReactNode }) => children,
}));

const started = (id: string, hour: number, orderIndex?: number): Workout => ({
  id,
  userId: "u1",
  name: id,
  isTemplate: false,
  exercises: [],
  createdAt: DAY,
  startedAt: new Date(2026, 7, 4, hour),
  orderIndex,
});

beforeEach(() => {
  mockUpdate.mockClear();
  mockActive = [];
});

describe("sortDayWorkouts", () => {
  it("follows the order you set, with ones never placed after them", () => {
    const ordered = sortDayWorkouts([started("unplaced", 18), started("second", 9, 1), started("first", 12, 0)]);
    expect(ordered.map((w) => w.id)).toEqual(["first", "second", "unplaced"]);
  });

  it("leaves a day never reordered exactly as Home already listed it", () => {
    expect(sortDayWorkouts([started("b", 10), started("a", 9)]).map((w) => w.id)).toEqual(["b", "a"]);
  });
});

it("lists only that day's workouts and saves the new order after a drop", async () => {
  mockActive = [started("push", 9), started("legs", 10), { ...started("other-day", 9), startedAt: new Date(2026, 7, 5, 9) }];
  render(<ReorderDayScreen />);

  const [push, legs] = mockListProps.data as Workout[];
  expect((mockListProps.data as Workout[]).map((w) => w.id)).toEqual(["push", "legs"]);

  await act(async () => {
    mockListProps.onDragEnd({ data: [legs, push] });
  });

  expect(mockUpdate).toHaveBeenCalledWith("legs", { orderIndex: 0 });
  expect(mockUpdate).toHaveBeenCalledWith("push", { orderIndex: 1 });
});
