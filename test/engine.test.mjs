/* Plain-Node test for the interval engine.
 * Run from the project root:  node test/engine.test.mjs
 * Named as .mjs so Node treats it as ESM (CommonJS interop pulls the engine's
 * module.exports) and so the Zepp OS bundler ignores it during `zeus build`.
 */
import * as E from '../utils/workouts.js'

let failures = 0
function assert(cond, msg) {
  if (cond) {
    console.log('  ok  - ' + msg)
  } else {
    failures++
    console.log('  FAIL- ' + msg)
  }
}
function eq(a, b, msg) {
  assert(a === b, msg + '  (got ' + a + ', want ' + b + ')')
}

console.log('formatTime')
eq(E.formatTime(0), '0:00', 'zero')
eq(E.formatTime(9), '0:09', 'pads seconds')
eq(E.formatTime(75), '1:15', 'minute + seconds')
eq(E.formatTime(600), '10:00', 'ten minutes')

console.log('buildPhases: Tabata (prepare 10, 20/10 x8)')
const tabata = { name: 'Tabata', prepare: 10, work: 20, rest: 10, rounds: 8, sets: 1, cooldown: 0 }
const p = E.buildPhases(tabata)
eq(p.length, 1 + 8 + 8, 'phase count')
eq(p[0].type, 'prepare', 'first is prepare')
eq(p[1].type, 'work', 'then work')
eq(p[2].type, 'rest', 'then rest')
eq(p[p.length - 1].type, 'rest', 'last phase is rest (final round is work + rest)')
eq(E.totalDuration(p), 10 + 8 * 20 + 8 * 10, 'total duration')

console.log('buildPhases: sets with restBetweenSets')
const multi = { name: 'M', prepare: 0, work: 30, rest: 15, rounds: 3, sets: 2, restBetweenSets: 60, cooldown: 20 }
const pm = E.buildPhases(multi)
// per set: 3 work + 3 rest = 6; one set-rest between the sets; then cooldown
eq(pm.length, 6 + 1 + 6 + 1, 'phase count with sets')
eq(pm.filter((x) => x.type === 'rest_set').length, 1, 'exactly one set-rest (not after final set)')
eq(pm[pm.length - 1].type, 'cooldown', 'ends with cooldown')
eq(E.totalDuration(pm), 2 * (3 * 30 + 3 * 15) + 60 + 20, 'total duration with sets')

console.log('createRun: tick sequence on a tiny workout')
// phases: prepare(2), work(3), rest(1), work(3), rest(1) => 10s
const tiny = { name: 'T', prepare: 2, work: 3, rest: 1, rounds: 2, sets: 1, cooldown: 0 }
const run = E.createRun(tiny)
eq(run.total, 10, 'tiny total 10s')
eq(run.current().type, 'prepare', 'starts in prepare')
eq(run.current().remaining, 2, 'prepare remaining 2')

const transitions = []
for (let i = 0; i < 10; i++) {
  run.tick(1).events.forEach((ev) => {
    if (ev.type === 'transition') transitions.push(ev.from.type + '->' + ev.to.type)
    if (ev.type === 'finished') transitions.push(ev.from.type + '->END')
  })
}
eq(transitions.join(','), 'prepare->work,work->rest,rest->work,work->rest,rest->END', 'transition order')
assert(run.isFinished(), 'run is finished after total seconds')

console.log('createRun: overshoot carry (dt larger than remaining)')
const run2 = E.createRun({ name: 'O', prepare: 0, work: 2, rest: 0, rounds: 3, sets: 1 })
const r2 = run2.tick(5)
eq(r2.index, 2, 'jumped to third work phase')
eq(r2.remaining, 1, '1s remaining after 5s of 6s')
eq(r2.events.length, 2, 'two transitions crossed')

console.log('stateAtElapsed: Tabata timeline')
// prepare 10, then work20/rest10 x8 (no trailing rest). boundaries: 10,30,40,60,...
const tab = { name: 'Tabata', prepare: 10, work: 20, rest: 10, rounds: 8, sets: 1 }
eq(E.stateAtElapsed(tab, 0).type, 'prepare', 'at 0s -> prepare')
eq(E.stateAtElapsed(tab, 5).remaining, 5, 'at 5s -> 5s left in prepare')
eq(E.stateAtElapsed(tab, 10).type, 'work', 'at 10s -> work (round 1)')
eq(E.stateAtElapsed(tab, 10).index, 1, 'at 10s -> phase index 1')
eq(E.stateAtElapsed(tab, 29).type, 'work', 'at 29s -> still work')
eq(E.stateAtElapsed(tab, 30).type, 'rest', 'at 30s -> rest')
eq(E.stateAtElapsed(tab, 30).round, 1, 'at 30s -> round 1 rest')
const done = E.stateAtElapsed(tab, 100000)
assert(done.finished === true, 'huge elapsed -> finished')

console.log('')
if (failures) {
  console.log('RESULT: ' + failures + ' failure(s)')
  process.exit(1)
} else {
  console.log('RESULT: all tests passed')
}
