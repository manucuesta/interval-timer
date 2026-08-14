/*
 * Interval engine — pure logic, no watch APIs.
 * Safe to require() from plain Node for testing and from Zepp OS pages.
 *
 * A workout config:
 *   {
 *     name: 'Tabata',
 *     prepare: 5,          // countdown before the first work phase (s), 0 to skip
 *     work: 20,             // work interval (s)
 *     rest: 10,             // rest between rounds (s), 0 to skip
 *     rounds: 8,            // rounds per set
 *     sets: 1,              // number of sets (round-blocks)
 *     restBetweenSets: 0,   // longer rest between sets (s), 0 to skip
 *     cooldown: 0           // final cooldown (s), 0 to skip
 *   }
 */

var PHASE = {
  PREPARE: 'prepare',
  WORK: 'work',
  REST: 'rest',
  REST_SET: 'rest_set',
  COOLDOWN: 'cooldown'
}

// Colors used by the running screen (0xRRGGBB).
var PHASE_COLOR = {
  prepare: 0xf5a623, // amber
  work: 0x2ecc71, // green
  rest: 0x3498db, // blue
  rest_set: 0x9b59b6, // purple
  cooldown: 0x95a5a6 // grey
}

var PHASE_LABEL = {
  prepare: 'Get Ready',
  work: 'Work',
  rest: 'Rest',
  rest_set: 'Set Rest',
  cooldown: 'Cooldown'
}

function normalize(w) {
  return {
    name: w.name || 'Workout',
    prepare: Math.max(0, w.prepare || 0),
    work: Math.max(1, w.work || 1),
    rest: Math.max(0, w.rest || 0),
    rounds: Math.max(1, w.rounds || 1),
    sets: Math.max(1, w.sets || 1),
    restBetweenSets: Math.max(0, w.restBetweenSets || 0),
    cooldown: Math.max(0, w.cooldown || 0)
  }
}

// Expand a workout config into a flat, ordered list of timed phases.
function buildPhases(config) {
  var w = normalize(config)
  var phases = []

  if (w.prepare) {
    phases.push(makePhase(PHASE.PREPARE, w.prepare, 0, 0, w))
  }

  for (var s = 1; s <= w.sets; s++) {
    for (var r = 1; r <= w.rounds; r++) {
      phases.push(makePhase(PHASE.WORK, w.work, r, s, w))

      // Every round is work + rest, including the final one — a full round is worked
      // and rested, so the workout ends only after the last rest has elapsed.
      if (w.rest) phases.push(makePhase(PHASE.REST, w.rest, r, s, w))

      if (r === w.rounds && s !== w.sets && w.restBetweenSets) {
        phases.push(makePhase(PHASE.REST_SET, w.restBetweenSets, r, s, w))
      }
    }
  }

  if (w.cooldown) {
    phases.push(makePhase(PHASE.COOLDOWN, w.cooldown, 0, 0, w))
  }

  return phases
}

function makePhase(type, duration, round, set, w) {
  return {
    type: type,
    duration: duration,
    label: PHASE_LABEL[type],
    color: PHASE_COLOR[type],
    round: round, // 0 when not applicable (prepare/cooldown)
    set: set,
    totalRounds: w.rounds,
    totalSets: w.sets
  }
}

function totalDuration(phases) {
  var t = 0
  for (var i = 0; i < phases.length; i++) t += phases[i].duration
  return t
}

/*
 * A running instance. Drive it with tick(dt) once per second (dt defaults to 1).
 * tick() returns { finished, events, remaining, index } where events is an array
 * of { type: 'transition', from, to } and/or { type: 'finished', from }.
 */
function createRun(config) {
  var phases = buildPhases(config)
  var total = totalDuration(phases)
  var idx = 0
  var remaining = phases.length ? phases[0].duration : 0
  var elapsed = 0
  var finished = phases.length === 0

  function current() {
    if (finished || !phases.length) return null
    var p = phases[idx]
    return {
      type: p.type,
      label: p.label,
      color: p.color,
      round: p.round,
      set: p.set,
      totalRounds: p.totalRounds,
      totalSets: p.totalSets,
      duration: p.duration,
      remaining: remaining,
      index: idx
    }
  }

  function tick(dt) {
    dt = dt || 1
    var events = []
    if (finished) return { finished: true, events: events, remaining: 0, index: idx }

    remaining -= dt
    elapsed += dt

    while (remaining <= 0 && !finished) {
      var from = phases[idx]
      if (idx + 1 < phases.length) {
        idx++
        remaining = phases[idx].duration + remaining // carry any overshoot
        events.push({ type: 'transition', from: from, to: phases[idx] })
      } else {
        finished = true
        remaining = 0
        events.push({ type: 'finished', from: from })
      }
    }

    return { finished: finished, events: events, remaining: remaining, index: idx }
  }

  return {
    phases: phases,
    total: total,
    current: current,
    tick: tick,
    isFinished: function () {
      return finished
    },
    elapsed: function () {
      return elapsed
    }
  }
}

// Pure timestamp -> state. Given how many seconds have elapsed since the workout
// began, return the current phase and the seconds remaining in it. Used so the timer
// stays correct across app suspend/resume and alarm relaunches.
function stateAtElapsed(config, elapsed) {
  var phases = buildPhases(config)
  var total = totalDuration(phases)
  if (elapsed < 0) elapsed = 0
  if (!phases.length || elapsed >= total) {
    return { finished: true, index: phases.length - 1, remaining: 0, total: total, phases: phases }
  }
  var acc = 0
  for (var i = 0; i < phases.length; i++) {
    var end = acc + phases[i].duration
    if (elapsed < end) {
      var p = phases[i]
      return {
        finished: false,
        index: i,
        type: p.type,
        label: p.label,
        color: p.color,
        round: p.round,
        set: p.set,
        totalRounds: p.totalRounds,
        totalSets: p.totalSets,
        duration: p.duration,
        remaining: end - elapsed,
        total: total,
        phases: phases
      }
    }
    acc = end
  }
  return { finished: true, index: phases.length - 1, remaining: 0, total: total, phases: phases }
}

// Built-in presets.
var PRESETS = [
  { name: 'Tabata', prepare: 5, work: 20, rest: 10, rounds: 8, sets: 1, restBetweenSets: 0, cooldown: 0 },
  { name: 'HIIT 40/20', prepare: 5, work: 40, rest: 20, rounds: 10, sets: 1, restBetweenSets: 0, cooldown: 30 },
  { name: 'Boxing 3x5', prepare: 5, work: 180, rest: 60, rounds: 5, sets: 1, restBetweenSets: 0, cooldown: 0 },
  { name: 'EMOM 10', prepare: 5, work: 60, rest: 0, rounds: 10, sets: 1, restBetweenSets: 0, cooldown: 0 }
]

// Format seconds as M:SS.
function formatTime(sec) {
  sec = Math.max(0, Math.round(sec))
  var m = Math.floor(sec / 60)
  var s = sec % 60
  return m + ':' + (s < 10 ? '0' + s : '' + s)
}

module.exports = {
  PHASE: PHASE,
  PHASE_COLOR: PHASE_COLOR,
  PHASE_LABEL: PHASE_LABEL,
  PRESETS: PRESETS,
  normalize: normalize,
  buildPhases: buildPhases,
  totalDuration: totalDuration,
  createRun: createRun,
  stateAtElapsed: stateAtElapsed,
  formatTime: formatTime
}
