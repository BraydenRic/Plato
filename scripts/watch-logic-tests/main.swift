// Tests for the watch app's pure logic (targets/watch/Models.swift and
// Logbook.swift), runnable on any machine with a Swift toolchain — no Mac or
// simulator needed. See run.sh. The SwiftUI and WatchConnectivity code can't
// be built this way; only Xcode compiles that.
//
// The snapshot fixture is what src/lib/watch-protocol.ts builds; decoding it
// here pins the contract from the Swift end. With --write-ops it also rewrites
// the ops fixture, which the TypeScript tests parse.

import Foundation

var failures = 0
func check(_ condition: Bool, _ label: String, file: String = #file, line: Int = #line) {
  if condition { print("ok   \(label)") } else { failures += 1; print("FAIL \(label) (line \(line))") }
}

let args = CommandLine.arguments
let fixtureDir = args[1]

// ── Decode the snapshot the TypeScript side builds ──────────────────────────
let snapshotData = try! Data(contentsOf: URL(fileURLWithPath: fixtureDir + "/watch-snapshot.json"))
let snapshot: WatchSnapshot
do {
  snapshot = try JSONDecoder().decode(WatchSnapshot.self, from: snapshotData)
} catch {
  print("FAIL decode snapshot: \(error)")
  exit(1)
}
check(snapshot.v == 1 && snapshot.isSignedIn, "decodes version and account")
check(snapshot.unit == "lbs" && snapshot.restSeconds == 90, "decodes settings")
check(snapshot.restEndsAt == 1792780260000, "decodes rest deadline")
let workout = snapshot.workout!
check(workout.exercises.map { $0.kind } == [.weight, .bodyweight, .timed], "decodes set kinds")
check(workout.exercises[0].sets[1].weight == 176.4, "decodes fractional weight")
check(workout.exercises[0].sets[2].weight == nil, "decodes null weight as nil")
check(workout.exercises[0].sets[0].lastReps == 5, "decodes last session reps")
check(snapshot.templates.first?.setCount == 4 && snapshot.templates.first?.exerciseCount == 2, "decodes template counts")
check(snapshot.applied == ["op-1", "op-2"], "decodes applied ids")

// ── Logic ────────────────────────────────────────────────────────────────────
let bench = workout.exercises[0]
check(Logbook.currentSetIndex(in: bench) == 1, "current set is the first not done")
// Set 2 has its own weight (176.4) but no reps: weight from itself, reps from set 1.
let d2 = Logbook.draft(for: 1, in: bench)
check(d2.weight == 176.4 && d2.reps == 5, "draft keeps the set's own weight and takes reps from the set before")
// Set 3: nothing of its own, nothing last session → previous done set (set 1, since set 2 isn't done).
let d3 = Logbook.draft(for: 2, in: bench)
check(d3.weight == 185 && d3.reps == 5, "draft falls back to the last done set in this exercise")
let pull = workout.exercises[1]
let p1 = Logbook.draft(for: 0, in: pull)
check(p1.weight == 25 && p1.reps == 8, "first set of an exercise starts from last session")
check(!Logbook.hasEarlierDoneSet(before: 0, in: pull) && Logbook.hasEarlierDoneSet(before: 1, in: bench), "knows when weight is settled")

// Overlay: log set 2 and add a set; then finish hides the workout.
var log = WatchOp(kind: .logSet, at: 1, workoutId: workout.id, exerciseId: bench.id, setId: "s2")
log.weight = 180; log.reps = 5; log.unit = "lbs"
let add = WatchOp(kind: .addSet, at: 2, workoutId: workout.id, exerciseId: bench.id, setId: "new-set")
let overlaid = Logbook.overlay([log, add], on: workout)!
check(overlaid.exercises[0].sets[1].done && overlaid.exercises[0].sets[1].weight == 180, "overlay applies a logged set")
check(overlaid.exercises[0].sets.count == 4 && overlaid.exercises[0].sets[3].id == "new-set", "overlay appends an added set")
check(Logbook.overlay([log, add, add], on: workout)!.exercises[0].sets.count == 4, "overlay adds a set only once")
var partial = log; partial.reps = 0
check(!Logbook.overlay([partial], on: workout)!.exercises[0].sets[1].done, "overlay calls zero reps partial")
let undo = WatchOp(kind: .undoSet, at: 3, workoutId: workout.id, exerciseId: bench.id, setId: "s1")
let undone = Logbook.overlay([undo], on: workout)!.exercises[0].sets[0]
check(!undone.done && undone.weight == nil && undone.reps == nil, "overlay clears an undone set")
let other = WatchOp(kind: .logSet, at: 4, workoutId: "someone-else", exerciseId: bench.id, setId: "s3")
check(Logbook.overlay([other], on: workout) == workout, "overlay ignores ops for other workouts")
let finish = WatchOp(kind: .finish, at: 5, workoutId: workout.id)
check(Logbook.overlay([finish], on: workout) == nil, "a pending finish hides the workout")

// Navigation between exercises.
check(Logbook.firstOpenExercise(in: workout) == "we-bench", "opens on the first exercise with sets left")
check(Logbook.nextOpenExercise(in: workout, after: "we-bench") == "we-pull", "moves to the next open exercise")
check(Logbook.nextOpenExercise(in: workout, after: "we-plank") == "we-bench", "wraps round to a skipped exercise")
check(Logbook.nextUp(in: workout, from: "we-plank")?.exercise.id == "we-bench", "next up skips a finished exercise")

// Formatting.
check(Logbook.weightText(185, kind: .weight) == "185", "whole weights have no decimal")
check(Logbook.weightText(102.5, kind: .weight) == "102.5", "half weights keep theirs")
check(Logbook.weightText(0, kind: .bodyweight) == "BW", "no added load reads BW")
check(Logbook.weightText(25, kind: .bodyweight) == "+25", "added load is signed")
check(Logbook.weightText(-20, kind: .bodyweight) == "\u{2212}20", "assistance uses a real minus")
check(Logbook.clock(45) == "0:45" && Logbook.clock(723) == "12:03" && Logbook.clock(3723) == "1:02:03", "clock formats")
check(Logbook.summary(of: workout.exercises[0].sets[0], kind: .weight) == "185 \u{00D7} 5", "set summary")
check(Logbook.summary(of: workout.exercises[0].sets[2], kind: .weight) == "\u{2014}", "empty set summary is a dash")
check(Logbook.templateMeta(snapshot.templates[0]) == "2 exercises \u{00B7} 4 sets", "template meta")
check(Logbook.weightStep(unit: "kg") == 2.5 && Logbook.weightStep(unit: "lbs") == 5, "crown steps")
check(Logbook.setCounts(in: workout) == (done: 2, total: 6), "set counts")

// Crown and weights.
check(Logbook.snap(187.3, step: 5) == 185 && Logbook.snap(188, step: 5) == 190, "crown snaps to the plate step")
check(Logbook.snap(83.4, step: 2.5) == 82.5, "crown snaps to 2.5 kg")
check(Logbook.snap(-7, step: 5) == -5 && Logbook.snap(-8, step: 5) == -10, "assistance snaps too")
check(Logbook.tidyWeight(176.4, unit: "lbs") == 176, "pounds are shown whole")
check(Logbook.tidyWeight(82.3, unit: "kg") == 82.5, "kilos are shown to the half")

// Number pad.
var pad = KeypadEntry(allowsDecimal: false, allowsSign: false, maxWholeDigits: 4)
check(pad.isEmpty && pad.value == nil, "pad starts empty")
for d in [2, 2, 5] { pad.press(.digit(d)) }
check(pad.value == 225 && pad.display == "225", "typing replaces the old number")
pad.press(.point)
check(pad.value == 225, "no decimal point for whole pounds")
for d in [1, 1] { pad.press(.digit(d)) }
check(pad.value == 2251, "stops at four digits")
pad.press(.digit(9))
check(pad.value == 2251, "a fifth digit is ignored")
pad.press(.delete)
check(pad.value == 225, "delete takes the last digit")
var zeros = KeypadEntry(allowsDecimal: false, allowsSign: false, maxWholeDigits: 3)
zeros.press(.digit(0)); zeros.press(.digit(8))
check(zeros.value == 8 && zeros.display == "8", "no leading zero")
var kilos = KeypadEntry(allowsDecimal: true, allowsSign: false, maxWholeDigits: 4)
kilos.press(.point)
check(kilos.display == "0.", "a point first means 0.")
for d in [5, 5] { kilos.press(.digit(d)) }
check(kilos.value == 0.5, "one decimal place only")
var bw = KeypadEntry(allowsDecimal: false, allowsSign: true, maxWholeDigits: 4)
bw.press(.sign); bw.press(.digit(2)); bw.press(.digit(0))
check(bw.value == -20 && bw.display == "\u{2212}20", "± makes assistance")
bw.press(.delete); bw.press(.delete); bw.press(.delete)
check(bw.isEmpty, "deleting everything clears the sign too")

// Dates.
check(Date(ms: 1792780200000).ms == 1792780200000, "ms round-trips")

// ── Encode ops for the TypeScript side to parse ─────────────────────────────
var ext = WatchOp(kind: .extendRest, at: 1792780210000, workoutId: workout.id); ext.seconds = 15
var start = WatchOp(kind: .startTemplate, at: 1792780210000); start.templateId = "t-push"
var timed = WatchOp(kind: .logSet, at: 1792780210000, workoutId: workout.id, exerciseId: "we-plank", setId: "k1")
timed.duration = 60; timed.unit = "lbs"
var logged = log
logged = WatchOp(kind: .logSet, at: 1792780210000, workoutId: workout.id, exerciseId: bench.id, setId: "s2")
logged.weight = 182.5; logged.reps = 5; logged.unit = "lbs"
let ops: [WatchOp] = [
  logged, timed,
  WatchOp(kind: .undoSet, at: 1792780210000, workoutId: workout.id, exerciseId: bench.id, setId: "s1"),
  WatchOp(kind: .addSet, at: 1792780210000, workoutId: workout.id, exerciseId: bench.id, setId: "B3C1A2E4-1111-4222-8333-944455556666"),
  start,
  WatchOp(kind: .finish, at: 1792780210000, workoutId: workout.id),
  ext,
  WatchOp(kind: .endRest, at: 1792780210000, workoutId: workout.id),
]
let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
// Each op is sent as its own JSON string; decoding that string is exactly what the phone does.
let strings = ops.map { String(data: try! encoder.encode($0), encoding: .utf8)! }
let array = "[\n" + strings.joined(separator: ",\n") + "\n]\n"
if args.contains("--write-ops") {
  try! array.write(toFile: fixtureDir + "/watch-ops.json", atomically: true, encoding: .utf8)
}
// Round trip: what the watch persists comes back the same.
let pendingRoundTrip = try! JSONDecoder().decode([PendingOp].self, from: try! JSONEncoder().encode(ops.map { PendingOp(op: $0, delivered: true, affectsRest: false) }))
check(pendingRoundTrip.map { $0.op } == ops, "pending ops survive being saved")

print(failures == 0 ? "\nALL PASSED" : "\n\(failures) FAILED")
exit(failures == 0 ? 0 : 1)
