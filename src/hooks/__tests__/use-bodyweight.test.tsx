import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useBodyweight } from "../use-bodyweight";
import type { BodyweightEntry, Workout } from "@/types";

/**
 * Changing a weigh-in has to move two things: the log, and the volume of
 * anything logged that day, which was priced from the number being changed.
 *
 * That pairing lives here rather than at the call sites because it had already
 * come apart once — the Bodyweight screen re-priced and Profile's prompt
 * didn't, so the same weigh-in left a different volume behind depending on
 * which screen you typed it into. The last test is the one that pins it: both
 * ways in must do the same thing.
 */

const mockSetLog = jest.fn(async () => {});
const mockApply = jest.fn(async () => {});
let mockStored: BodyweightEntry[] = [];
let mockCompleted: Workout[] = [];
let mockUserId: string | null = "u1";

jest.mock("@/context/AuthContext", () => ({ useAuth: () => ({ dataUserId: mockUserId }) }));
jest.mock("@/hooks/use-workouts", () => ({
  useWorkouts: () => ({ completed: mockCompleted, active: [], loading: false }),
}));
jest.mock("@/lib/data", () => ({
  getBodyweightLog: async () => mockStored,
  setBodyweightLog: (...args: unknown[]) => mockSetLog(...(args as [])),
}));
jest.mock("@/lib/apply-volume-corrections", () => ({
  applyVolumeCorrections: (...args: unknown[]) => mockApply(...(args as [])),
}));

const AUG_4 = new Date(2026, 7, 4);
const AUG_5 = new Date(2026, 7, 5);

const pullDay = (): Workout => ({
  id: "w1",
  userId: "u1",
  name: "Pull Day",
  isTemplate: false,
  createdAt: AUG_4,
  scheduledFor: AUG_4,
  completedAt: AUG_4,
  // Priced from the 250 typo.
  totalVolume: 2500,
  exercises: [
    {
      id: "e1",
      exerciseId: "pull-up",
      exercise: {
        id: "pull-up",
        name: "Pull-Up",
        category: "Back",
        musclesWorked: ["lats"],
        description: "",
        isBodyweight: true,
      },
      orderIndex: 0,
      sets: [{ id: "s1", reps: 10, weightUnit: "bodyweight", isCompleted: true }],
    },
  ],
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUserId = "u1";
  mockCompleted = [pullDay()];
  mockStored = [
    { date: AUG_4, lbs: 250 },
    { date: AUG_5, lbs: 191 },
  ];
});

async function loaded() {
  const view = renderHook(() => useBodyweight());
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  return view;
}

it("loads the log oldest first", async () => {
  const { result } = await loaded();

  expect(result.current.log).toHaveLength(2);
  expect(result.current.latest?.lbs).toBe(191);
});

it("re-prices that day's workouts when a weigh-in is corrected", async () => {
  const { result } = await loaded();

  await act(async () => {
    await result.current.record(190, AUG_4);
  });

  // 10 pull-ups at the corrected 190, down from the 2500 the typo produced.
  await waitFor(() =>
    expect(mockApply).toHaveBeenCalledWith([{ id: "w1", totalVolume: 1900 }], expect.anything(), "u1")
  );
});

it("re-prices against what is left when a weigh-in is deleted", async () => {
  const { result } = await loaded();

  await act(async () => {
    await result.current.remove(AUG_4);
  });

  // With the 4th gone, the nearest remaining weigh-in is the 5th's 191.
  await waitFor(() =>
    expect(mockApply).toHaveBeenCalledWith([{ id: "w1", totalVolume: 1910 }], expect.anything(), "u1")
  );
});

it("writes nothing when deleting a day that has no weigh-in", async () => {
  const { result } = await loaded();

  await act(async () => {
    await result.current.remove(new Date(2026, 7, 9));
  });

  expect(mockSetLog).not.toHaveBeenCalled();
  expect(mockApply).not.toHaveBeenCalled();
});

it.each([0, -5, Number.NaN])("refuses %p as a weight", async (value) => {
  const { result } = await loaded();

  await act(async () => {
    await result.current.record(value, AUG_4);
  });

  expect(mockSetLog).not.toHaveBeenCalled();
});

it("does the same thing whichever screen the weigh-in came from", async () => {
  // Profile passes no date and gets today's; the Bodyweight screen names a day.
  // Both are the same call, so neither can drift from the other again.
  const { result } = await loaded();

  await act(async () => {
    await result.current.record(190, AUG_4);
  });
  const named = mockApply.mock.calls.length;

  await act(async () => {
    await result.current.record(189);
  });

  expect(mockApply.mock.calls.length).toBe(named + 1);
});
