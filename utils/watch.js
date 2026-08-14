/*
 * Thin, defensive wrappers around Zepp OS 1.0 device globals.
 * Everything is guarded with try/catch so an API mismatch degrades gracefully
 * (e.g. no vibration) instead of crashing the workout.
 */

// Device screen size. GTR 3 Pro is 480x480; fall back to that if the call fails.
export function deviceSize() {
  try {
    var info = hmSetting.getDeviceInfo()
    if (info && info.width && info.height) {
      return { w: info.width, h: info.height }
    }
  } catch (e) {}
  return { w: 480, h: 480 }
}

var _vib = null
function vibrator() {
  if (_vib) return _vib
  try {
    _vib = hmSensor.createSensor(hmSensor.id.VIBRATE)
  } catch (e) {
    _vib = null
  }
  return _vib
}

// One fixed-duration buzz — scene 28 (~600ms, stops itself). NOT a "continuous" scene
// (1/5), which vibrate until manually stopped and buzzed for the whole interval.
export function buzz() {
  var v = vibrator()
  if (!v) return
  try {
    if (v.stop) v.stop()
    v.scene = 28
    if (v.start) v.start()
  } catch (e) {}
}

export function vibrateStop() {
  var v = vibrator()
  if (!v) return
  try {
    if (v.stop) v.stop()
  } catch (e) {}
}

// System alarm at `delaySec` from now. If `file` is given the alarm launches that page
// (which wakes the screen); if `file` is omitted it's a file-less alarm — the experiment is
// whether that still buzzes but WITHOUT waking the display.
export function scheduleAlarm(appId, file, delaySec, param) {
  try {
    var opts = { appid: appId, delay: Math.max(1, Math.round(delaySec)) }
    if (file) {
      opts.file = file
      opts.param = param || ''
    }
    return hmApp.alarmNew(opts)
  } catch (e) {
    return null
  }
}

export function cancelAlarm(alarmId) {
  if (alarmId === null || alarmId === undefined) return
  try {
    hmApp.alarmCancel(alarmId)
  } catch (e) {}
}
