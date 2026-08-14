/*
 * Tiny JSON key/value store backed by hmFS (Zepp OS 1.0 file system).
 * Used to remember the last-used preset between launches.
 */

function str2ab(str) {
  var buf = new ArrayBuffer(str.length * 2) // 2 bytes per UTF-16 char
  var view = new Uint16Array(buf)
  for (var i = 0; i < str.length; i++) view[i] = str.charCodeAt(i)
  return buf
}

var FILE = 'interval_timer_state.json'

export function loadState() {
  try {
    var stat = hmFS.stat(FILE)
    var fsStat = stat[0]
    var err = stat[1]
    if (err !== 0 || !fsStat || !fsStat.size) return {}
    var size = fsStat.size
    var unit = new Uint16Array(new ArrayBuffer(size))
    var file = hmFS.open(FILE, hmFS.O_RDONLY | hmFS.O_CREAT)
    hmFS.seek(file, 0, hmFS.SEEK_SET)
    hmFS.read(file, unit.buffer, 0, size)
    hmFS.close(file)
    var val = String.fromCharCode.apply(null, unit)
    return val ? JSON.parse(val) : {}
  } catch (e) {
    return {}
  }
}

export function saveState(obj) {
  try {
    var file = hmFS.open(FILE, hmFS.O_RDWR | hmFS.O_CREAT | hmFS.O_TRUNC)
    var buf = str2ab(JSON.stringify(obj || {}))
    hmFS.write(file, buf, 0, buf.byteLength)
    hmFS.close(file)
  } catch (e) {}
}

export function getLastPresetIndex() {
  var s = loadState()
  return typeof s.lastPresetIndex === 'number' ? s.lastPresetIndex : 0
}

export function setLastPresetIndex(index) {
  var s = loadState()
  s.lastPresetIndex = index
  saveState(s)
}

var CUSTOM_DEFAULT = {
  name: 'Custom',
  prepare: 5,
  work: 30,
  rest: 15,
  rounds: 8,
  sets: 1,
  restBetweenSets: 0,
  cooldown: 0
}

export function getCustomWorkout() {
  var s = loadState()
  var c = s.custom || {}
  return {
    name: 'Custom',
    prepare: CUSTOM_DEFAULT.prepare,
    work: typeof c.work === 'number' ? c.work : CUSTOM_DEFAULT.work,
    rest: typeof c.rest === 'number' ? c.rest : CUSTOM_DEFAULT.rest,
    rounds: typeof c.rounds === 'number' ? c.rounds : CUSTOM_DEFAULT.rounds,
    sets: typeof c.sets === 'number' ? c.sets : CUSTOM_DEFAULT.sets,
    restBetweenSets: typeof c.restBetweenSets === 'number' ? c.restBetweenSets : CUSTOM_DEFAULT.restBetweenSets,
    cooldown: typeof c.cooldown === 'number' ? c.cooldown : CUSTOM_DEFAULT.cooldown
  }
}

export function setCustomWorkout(cfg) {
  var s = loadState()
  s.custom = cfg
  saveState(s)
}

// A tiny separate "a workout is active" flag file. Removed on Stop — the definitive gate
// that stops a relaunch from resuming/rescheduling after Stop, independent of the session write.
var ACTIVE_FILE = 'interval_timer_active'

export function setActive() {
  try {
    var f = hmFS.open(ACTIVE_FILE, hmFS.O_RDWR | hmFS.O_CREAT | hmFS.O_TRUNC)
    var buf = str2ab('1')
    hmFS.write(f, buf, 0, buf.byteLength)
    hmFS.close(f)
  } catch (e) {}
}

export function clearActive() {
  try {
    hmFS.remove(ACTIVE_FILE)
  } catch (e) {}
}

export function isActive() {
  try {
    var stat = hmFS.stat(ACTIVE_FILE)
    return stat[1] === 0
  } catch (e) {
    return false
  }
}

// A one-shot "the user just chose a workout in the menu" flag. Set right before navigating to
// the workout page; consumed by its onInit. This is what distinguishes a real user start from
// an OS/alarm relaunch (which restores the app with the original launch param but sets no flag).
var PENDING_FILE = 'interval_timer_pending'

export function setPendingStart(val) {
  try {
    var f = hmFS.open(PENDING_FILE, hmFS.O_RDWR | hmFS.O_CREAT | hmFS.O_TRUNC)
    var buf = str2ab(String(val))
    hmFS.write(f, buf, 0, buf.byteLength)
    hmFS.close(f)
  } catch (e) {}
}

export function getPendingStart() {
  try {
    var stat = hmFS.stat(PENDING_FILE)
    if (stat[1] !== 0 || !stat[0] || !stat[0].size) return null
    var size = stat[0].size
    var unit = new Uint16Array(new ArrayBuffer(size))
    var f = hmFS.open(PENDING_FILE, hmFS.O_RDONLY)
    hmFS.seek(f, 0, hmFS.SEEK_SET)
    hmFS.read(f, unit.buffer, 0, size)
    hmFS.close(f)
    return String.fromCharCode.apply(null, unit) || null
  } catch (e) {
    return null
  }
}

export function clearPendingStart() {
  try {
    hmFS.remove(PENDING_FILE)
  } catch (e) {}
}

// Active workout session — persisted so an alarm relaunch can rebuild the timer state.
export function getSession() {
  var s = loadState()
  return s.session || null
}

export function setSession(session) {
  var s = loadState()
  s.session = session
  saveState(s)
}

export function clearSession() {
  var s = loadState()
  s.session = null
  saveState(s)
}
