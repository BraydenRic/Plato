import { useNavigationContainerRef } from "expo-router";
import { useEffect } from "react";

/**
 * Links from outside the app, seen before the router acts on them.
 *
 * The Live Activity opens plato:///workout/<id>. The router only reuses a
 * screen that is already on top, so a tap while the add-exercise picker was
 * open pushed a second copy of the workout inside the picker's sheet. Finish
 * there went back to the picker, which then added sets to a finished workout,
 * and the original copy was still waiting underneath. When the workout is
 * already open under something, the tap now goes back to it instead.
 */

/** The app's navigation, once the root layout has mounted. */
let navigation: ReturnType<typeof useNavigationContainerRef> | null = null;

/**
 * Lets redirectSystemPath see what is open. Called once, from the root layout:
 * expo-router hands this file nothing but the link, and only a component can
 * ask for the navigation.
 */
export function useNavigationForLinks() {
  const ref = useNavigationContainerRef();
  useEffect(() => {
    navigation = ref;
    return () => {
      navigation = null;
    };
  }, [ref]);
}

/** The id in a link to a workout: plato:///workout/<id>, or the bare path. */
function workoutIdIn(path: string): string | null {
  const match = /^(?:[a-z][a-z0-9+.-]*:)?\/*workout\/([^/?#]+)\/?(?:[?#]|$)/i.exec(path);
  return match ? decodeURIComponent(match[1]) : null;
}

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string {
  try {
    // A cold start has nothing open yet to land on twice.
    if (initial || !navigation?.isReady()) return path;
    const id = workoutIdIn(path);
    if (!id) return path;

    const root = navigation.getRootState();
    const stack = root.routes[root.index]?.state;
    if (!stack) return path;
    const top = stack.index ?? stack.routes.length - 1;
    const open = stack.routes.findLastIndex(
      (route) => route.name === "workout/[id]" && (route.params as { id?: string } | undefined)?.id === id
    );
    // Not open, or already in front: the link does the right thing alone.
    if (open === -1 || open >= top) return path;

    // Close whatever is over it, so the link finds the workout in front and
    // reuses it. Dispatched here and now rather than through router.dismiss,
    // which waits for a render: by then the link has already been acted on.
    navigation.dispatch({ type: "POP", payload: { count: top - open }, target: stack.key });
    return path;
  } catch {
    // Never lose the tap: anything unexpected gets the plain link.
    return path;
  }
}
