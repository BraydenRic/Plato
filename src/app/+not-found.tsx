import { useCallback } from "react";
import { useFocusEffect, useRouter } from "expo-router";

/**
 * Where a plato:// link that matches no screen lands — plato://workout with no
 * id, a typo, an old path — and it steps straight back out.
 *
 * Without this file expo-router used its own not-found screen, which it mounts
 * beside the root layout rather than inside it. On a cold start that meant
 * RootLayout never mounted, so nothing ever hid the splash it holds up: the app
 * sat on the logo until force-quit. Being a route of our own puts it inside the
 * layout, behind its providers and guards.
 *
 * Back where there's somewhere to go back to: a link arriving while the app is
 * open leaves the user wherever they were, and a cold start has the tabs
 * underneath (the root layout's anchor). Home otherwise. Focus rather than a
 * plain effect, because on a cold start this screen mounts before navigation
 * is ready to be asked anything.
 */
export default function NotFound() {
  const router = useRouter();
  useFocusEffect(
    useCallback(() => {
      if (router.canGoBack()) router.back();
      else router.replace("/");
    }, [router])
  );
  return null;
}
