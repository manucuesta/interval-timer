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
