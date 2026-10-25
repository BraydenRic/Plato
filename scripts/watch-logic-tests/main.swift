// Tests for the watch app's pure logic (targets/watch/Models.swift,
// Logbook.swift and CardioMath.swift), runnable on any machine with a Swift toolchain — no Mac or
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

// ── A snapshot with a cardio session in it ──────────────────────────────────
let cardioData = try! Data(contentsOf: URL(fileURLWithPath: fixtureDir + "/watch-snapshot-cardio.json"))
if let cardioSnapshot = try? JSONDecoder().decode(WatchSnapshot.self, from: cardioData) {
  let c = cardioSnapshot.workout?.cardio
  check(c?.kind == "run" && c?.indoor == false && c?.watch == true && c?.startOpId == "start-1", "decodes a session's cardio")
  check(c?.pausedAtMs == 1792779000000 && c?.pausedSeconds == 30, "decodes a session's pause")
  let ended = cardioSnapshot.endedCardio ?? []
  check(ended.count == 2 && ended[0].id == "w-old" && ended[0].startOpId == "start-0" && ended[0].kind == "walk" && !ended[0].discard,
        "decodes a session ended on the phone")
  check(ended[1].startOpId == nil && ended[1].startedAt == 1792775000000 && ended[1].discard, "decodes one thrown away, with no start op")
} else {
  check(false, "decodes the cardio snapshot")
}
check(snapshot.workout?.cardio == nil && snapshot.endedCardio == [], "an ordinary workout has no cardio")

// ── Cardio ───────────────────────────────────────────────────────────────────
// The names are the contract with src/lib/cardio-session.ts.
check(CardioKind.allCases.map { $0.name(indoor: false) } == [
  "Outdoor Run", "Outdoor Walk", "Hike", "Outdoor Cycle", "Open Water Swim", "Indoor Row", "Elliptical", "Stair Stepper",
], "outdoor names match the phone's")
check(CardioKind.allCases.map { $0.name(indoor: true) } == [
  "Indoor Run", "Indoor Walk", "Hike", "Indoor Cycle", "Pool Swim", "Indoor Row", "Elliptical", "Stair Stepper",
], "indoor names match the phone's")
check(CardioKind.row.places == [true] && CardioKind.swim.places == [true, false], "places, the usual first")

var curve = CurveRecorder()
curve.record(metres: 5, seconds: 2)
check(curve.metres == [0], "a few metres isn't a new point")
// One km at 4:00, then one at 5:00, read every 100 m.
for i in 1...10 { curve.record(metres: Double(i) * 100, seconds: Double(i) * 24) }
for i in 1...10 { curve.record(metres: 1000 + Double(i) * 100, seconds: 240 + Double(i) * 30) }
check(curve.splits(unitMetres: 1000) == [240, 300], "live splits match the phone's")
check(curve.splits(unitMetres: 500) == [120, 120, 150, 150], "a long stretch can cross more than one split")
curve.record(metres: 2100, seconds: 10)
check(curve.lastSeconds == 540, "time never runs backwards")
curve.close(metres: 2104, seconds: 545)
check(curve.lastMetres == 2104 && curve.lastSeconds == 545, "closing adds the true total, however close")
curve.close(metres: 2104, seconds: 600)
check(curve.metres.count == 23, "closing twice adds nothing")
var long = CurveRecorder()
for i in 1...3000 { long.record(metres: Double(i) * 10, seconds: Double(i) * 3) }
let thinned = long.flat(limit: 1500)
check(thinned.count / 2 <= 1500, "thinned to the limit")
check(thinned[0] == 0 && thinned[thinned.count - 2] == 30000 && thinned[thinned.count - 1] == 9000, "first and last kept")
check(CurveRecorder().flat() == [0, 0], "an empty record is just the start")
var precise = CurveRecorder()
precise.record(metres: 123.456789, seconds: 40.04999)
check(precise.flat() == [0, 0, 123.5, 40], "sent to a tenth, so a long run fits in one message")

check(CardioFormat.distance(3.1 * CardioFormat.mile, kind: .run, weightUnit: "lbs") == "3.10", "miles to two places")
check(CardioFormat.distance(5000, kind: .run, weightUnit: "kg") == "5.00", "kilometres to two places")
check(CardioFormat.distance(1000, kind: .swim, weightUnit: "kg") == "1000", "metres in the pool, whole")
check(CardioFormat.rate(metres: 5000, seconds: 1500, kind: .run, weightUnit: "kg") == "5:00 /KM", "pace per km")
check(CardioFormat.rate(metres: 5000, seconds: 1500, kind: .run, weightUnit: "lbs") == "8:03 /MI", "pace per mile, as the phone says it")
check(CardioFormat.rate(metres: 10 * CardioFormat.mile, seconds: 3600, kind: .bike, weightUnit: "lbs") == "10.0 MPH", "speed on a bike")
check(CardioFormat.rate(metres: 1000, seconds: 1200, kind: .swim, weightUnit: "kg") == "2:00 /100M", "pace per 100 in the pool")
check(CardioFormat.rate(metres: 5, seconds: 60, kind: .run, weightUnit: "kg") == nil, "no pace from a few metres")

// ── Encode ops for the TypeScript side to parse ─────────────────────────────
var ext = WatchOp(kind: .extendRest, at: 1792780210000, workoutId: workout.id); ext.seconds = 15
var start = WatchOp(kind: .startTemplate, at: 1792780210000); start.templateId = "t-push"
var timed = WatchOp(kind: .logSet, at: 1792780210000, workoutId: workout.id, exerciseId: "we-plank", setId: "k1")
timed.duration = 60; timed.unit = "lbs"
var logged = log
logged = WatchOp(kind: .logSet, at: 1792780210000, workoutId: workout.id, exerciseId: bench.id, setId: "s2")
logged.weight = 182.5; logged.reps = 5; logged.unit = "lbs"
var cardioStart = WatchOp(kind: .startCardio, at: 1792780210000)
cardioStart.session = "run"; cardioStart.indoor = false; cardioStart.fromPhone = false
var cardioPause = WatchOp(kind: .pauseCardio, at: 1792780210000)
cardioPause.startOpId = cardioStart.opId; cardioPause.session = "run"; cardioPause.startedAt = 1792779000000
var cardioFinish = WatchOp(kind: .finishCardio, at: 1792780210000, workoutId: "w-run")
cardioFinish.startOpId = cardioStart.opId; cardioFinish.session = "run"; cardioFinish.indoor = false
cardioFinish.startedAt = 1792779000000; cardioFinish.duration = 1500; cardioFinish.distance = 5000
cardioFinish.activeCalories = 320; cardioFinish.avgHeartRate = 151; cardioFinish.maxHeartRate = 171
cardioFinish.healthId = "6F1C3C6A-2D2E-4D7B-9B1A-1E2F3A4B5C6D"; cardioFinish.curve = [0, 0, 2500, 750, 5000, 1500]
let ops: [WatchOp] = [
  logged, timed, cardioStart, cardioPause, cardioFinish,
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
