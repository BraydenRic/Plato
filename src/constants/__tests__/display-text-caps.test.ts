import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

/**
 * Every large piece of text has to say how far it may grow.
 *
 * Body text scales all the way with iOS's text size, which is the point of it.
 * Display text can't: at the largest accessibility size a 28pt title lands past
 * 100pt, and single words — "Workouts", "Statistics", "Romanian" — no longer fit
 * on a line and split mid-word. Every one of those had to be found by running
 * the app at that size, because nothing on screen looks wrong at the size it's
 * built at. This makes the next one fail here instead.
 *
 * It reads the source rather than rendering, which is unusual and worth it:
 * what's being checked is a property of how each element is written — does a
 * big style travel with a `maxFontSizeMultiplier` — and a test renderer has no
 * layout, so it could never see a word split anyway.
 */

const SRC = join(__dirname, "..", "..");
/** From here up, a style is display type and needs a cap. */
const DISPLAY_SIZE = 20;

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : tsxFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

/** Names of styles in this file whose fontSize is display-sized. */
function displayStyles(source: string): string[] {
  const names: string[] = [];
  for (const m of source.matchAll(/\n {2}(\w+): \{([^{}]*?)\n {2}\}/g)) {
    const size = /fontSize: (\d+)/.exec(m[2]);
    if (size && Number(size[1]) >= DISPLAY_SIZE) names.push(m[1]);
  }
  return names;
}

/** The whole opening tag that starts at `start`, braces and all. */
function openingTag(source: string, start: number): string {
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (ch === ">" && depth === 0) return source.slice(start, i + 1);
  }
  return source.slice(start);
}

const uncapped: string[] = [];
for (const file of tsxFiles(join(SRC, "app")).concat(tsxFiles(join(SRC, "components")))) {
  const source = readFileSync(file, "utf8");
  for (const style of displayStyles(source)) {
    for (const use of source.matchAll(new RegExp(`styles\\.${style}\\b`, "g"))) {
      const tagStart = Math.max(
        source.lastIndexOf("<Text", use.index),
        source.lastIndexOf("<TextInput", use.index)
      );
      if (tagStart === -1) continue;
      const tag = openingTag(source, tagStart);
      // Only a use inside this tag counts — a style reached from a View is
      // not text and has nothing to cap.
      if (tagStart + tag.length < use.index!) continue;
      if (!tag.includes("maxFontSizeMultiplier")) {
        uncapped.push(`${file.slice(SRC.length + 1)}: styles.${style}`);
      }
    }
  }
}

it("caps every display-sized piece of text", () => {
  expect(uncapped).toEqual([]);
});

it("is looking at real screens, not an empty set", () => {
  // If the style scan ever stops matching, the test above would pass by
  // finding nothing. The titles alone are well over a dozen.
  const found = tsxFiles(join(SRC, "app")).flatMap((f) => displayStyles(readFileSync(f, "utf8")));
  expect(found.length).toBeGreaterThan(12);
});
