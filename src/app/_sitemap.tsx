/**
 * Takes the sitemap's address so expo-router's built-in one is never shown.
 *
 * That screen is a development tool, and in a release build it crashed the app
 * outright: it reads window.location.origin, which nothing sets outside Metro.
 * Any plato://_sitemap link reached it. A file of our own at this path
 * replaces the generated one, and behaves like any other unknown link.
 */
export { default } from "./+not-found";
