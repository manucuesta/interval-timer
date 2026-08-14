import Engine from '../utils/workouts'
import { deviceSize, buzz, vibrateStop, scheduleAlarm, cancelAlarm } from '../utils/watch'
import { getCustomWorkout, getSession, setSession, clearSession } from '../utils/storage'

var PRESETS = Engine.PRESETS
var formatTime = Engine.formatTime

var SIZE = deviceSize()
var CX = SIZE.w / 2

var APPID = 26251
var PAGE = 'page/workout'

var RING_MARGIN = 6
var RING_W = 18
var BTN = 84
var GAP = 24
var SHIFT = 24 // nudge the inner content up by this many px (tunable)
var BTN_Y = 366 - SHIFT

function resolveWorkout(param) {
  if (param === 'custom') return getCustomWorkout()
  var index = parseInt(param, 10)
  if (isNaN(index) || index < 0 || index >= PRESETS.length) index = 0
  return PRESETS[index]
}

Page({
  state: {
    session: null,
    timer: null,
    ring: null,
    phaseText: null,
    timeText: null,
    roundText: null,
    setText: null,
    playBtn: null,
    pauseBtn: null
  },

  onInit(param) {
    if (param === 'resume') {
      // Relaunched by an alarm (or reopened) — continue the persisted session.
      this.state.session = getSession()
      return
    }
    // Fresh start from the menu. Drop any previous session/alarms, begin a new one.
    var prev = getSession()
    if (prev) {
      cancelAlarm(prev.alarmId)
      cancelAlarm(prev.secondBuzzAlarmId)
    }

    // Custom auto-starts (running); presets start PAUSED until the user taps play.
    var autostart = param === 'custom'
    var now = Date.now()
    this.state.session = {
      workout: resolveWorkout(param),
      startTs: now,
      paused: !autostart,
      pauseStartTs: now,
      lastBuzzedIndex: -1,
      secondBuzzPending: false,
      firstBuzzTs: 0,
      finishedBuzzed: false,
      scheduledForIndex: -1,
      alarmId: null,
      secondBuzzAlarmId: null
    }
    setSession(this.state.session)
  },

  build() {
    var self = this
    var s = this.state

    if (!s.session) {
      // Nothing to resume (e.g. already stopped) — leave.
      try {
        hmApp.goBack()
      } catch (e) {}
      return
    }

    hmUI.createWidget(hmUI.widget.ARC, {
      x: RING_MARGIN, y: RING_MARGIN, w: SIZE.w - RING_MARGIN * 2, h: SIZE.h - RING_MARGIN * 2,
      start_angle: -90, end_angle: 270, color: 0x2a2a2a, line_width: RING_W
    })
    s.ring = hmUI.createWidget(hmUI.widget.ARC, {
      x: RING_MARGIN, y: RING_MARGIN, w: SIZE.w - RING_MARGIN * 2, h: SIZE.h - RING_MARGIN * 2,
      start_angle: -90, end_angle: 270, color: 0x2ecc71, line_width: RING_W
    })
    s.phaseText = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 0, y: 118 - SHIFT, w: SIZE.w, h: 48, color: 0xffffff, text_size: 40,
      align_h: hmUI.align.CENTER_H, align_v: hmUI.align.CENTER_V, text: ''
    })
    s.timeText = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 0, y: 168 - SHIFT, w: SIZE.w, h: 116, color: 0xffffff, text_size: 100,
      align_h: hmUI.align.CENTER_H, align_v: hmUI.align.CENTER_V, text: '0:00'
    })
    s.roundText = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 0, y: 286 - SHIFT, w: SIZE.w, h: 34, color: 0xcccccc, text_size: 30,
      align_h: hmUI.align.CENTER_H, align_v: hmUI.align.CENTER_V, text: ''
    })
    s.setText = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 0, y: 320 - SHIFT, w: SIZE.w, h: 26, color: 0x888888, text_size: 22,
      align_h: hmUI.align.CENTER_H, align_v: hmUI.align.CENTER_V, text: ''
    })

    // Two stacked buttons toggled by visibility — an image BUTTON's src can't be swapped
    // at runtime, so we show/hide play vs pause instead.
    var toggleX = CX - BTN - GAP / 2
    s.pauseBtn = hmUI.createWidget(hmUI.widget.BUTTON, {
      x: toggleX, y: BTN_Y, w: BTN, h: BTN,
      normal_src: 'icons/pause_normal.png', press_src: 'icons/pause_press.png',
      click_func: function () { self.togglePause() }
    })
    s.playBtn = hmUI.createWidget(hmUI.widget.BUTTON, {
      x: toggleX, y: BTN_Y, w: BTN, h: BTN,
      normal_src: 'icons/play_normal.png', press_src: 'icons/play_press.png',
      click_func: function () { self.togglePause() }
    })
    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: CX + GAP / 2, y: BTN_Y, w: BTN, h: BTN,
      normal_src: 'icons/stop_normal.png', press_src: 'icons/stop_press.png',
      click_func: function () { self.stop() }
    })

    this.updateToggle()
    this.update()
    this.startTimer()
  },

  // Show play when paused/finished, pause when running.
  updateToggle() {
    var s = this.state
    var showPlay = !s.session || s.session.paused || s.session.finishedBuzzed
    s.playBtn.setProperty(hmUI.prop.VISIBLE, showPlay)
    s.pauseBtn.setProperty(hmUI.prop.VISIBLE, !showPlay)
  },

  startTimer() {
    var self = this
    if (this.state.timer) return
    this.state.timer = timer.createTimer(1000, 1000, function () {
      self.update()
    })
  },

  clearTimer() {
    if (this.state.timer) {
      try { timer.stopTimer(this.state.timer) } catch (e) {}
      this.state.timer = null
    }
  },

  // Single source of truth: recompute state from timestamps, buzz new intervals
  // (de-duplicated), keep the next alarm scheduled, and render.
  update() {
    var s = this.state.session
    if (!s) return

    var now = Date.now()
    var effectiveNow = s.paused ? s.pauseStartTs : now
    var elapsed = (effectiveNow - s.startTs) / 1000
    var st = Engine.stateAtElapsed(s.workout, elapsed)

    if (st.finished) {
      if (!s.finishedBuzzed) {
        buzz()
        s.finishedBuzzed = true
      }
      cancelAlarm(s.alarmId)
      cancelAlarm(s.secondBuzzAlarmId)
      s.alarmId = null
      s.secondBuzzAlarmId = null
      setSession(s)
      this.showFinished()
      this.clearTimer()
      return
    }

    if (!s.paused) {
      var changed = false
      if (st.index > s.lastBuzzedIndex) {
        buzz() // first buzz at the start of a new interval
        s.lastBuzzedIndex = st.index
        s.firstBuzzTs = now
        s.secondBuzzPending = true
        // Dedicated wake-up ~1s later so the second buzz also fires in the background.
        cancelAlarm(s.secondBuzzAlarmId)
        s.secondBuzzAlarmId = scheduleAlarm(APPID, PAGE, 1, 'resume')
        changed = true
      } else if (s.secondBuzzPending && now - s.firstBuzzTs >= 700) {
        buzz() // second buzz ~1s later
        s.secondBuzzPending = false
        cancelAlarm(s.secondBuzzAlarmId)
        s.secondBuzzAlarmId = null
        changed = true
      }
      // One wake-up at the end of the current interval so the buzz fires even with the
      // screen off / app suspended.
      if (s.scheduledForIndex !== st.index) {
        cancelAlarm(s.alarmId)
        s.alarmId = scheduleAlarm(APPID, PAGE, Math.ceil(st.remaining), 'resume')
        s.scheduledForIndex = st.index
        changed = true
      }
      if (changed) setSession(s)
    }

    this.renderState(st)
  },

  renderState(st) {
    var s = this.state
    s.timeText.setProperty(hmUI.prop.MORE, { text: formatTime(Math.max(0, Math.ceil(st.remaining))) })
    s.phaseText.setProperty(hmUI.prop.MORE, { text: st.label.toUpperCase(), color: st.color })
    s.roundText.setProperty(hmUI.prop.MORE, {
      text: st.round > 0 ? 'Round ' + st.round + ' / ' + st.totalRounds : ''
    })
    s.setText.setProperty(hmUI.prop.MORE, {
      text: st.totalSets > 1 && st.set > 0 ? 'Set ' + st.set + ' / ' + st.totalSets : ''
    })
    var frac = st.duration > 0 ? st.remaining / st.duration : 0
    if (frac < 0) frac = 0
    if (frac > 1) frac = 1
    s.ring.setProperty(hmUI.prop.MORE, { end_angle: -90 + 360 * frac, color: st.color })
  },

  togglePause() {
    var s = this.state.session
    if (!s) return
    var now = Date.now()

    if (!s.paused) {
      s.paused = true
      s.pauseStartTs = now
      s.secondBuzzPending = false
      cancelAlarm(s.alarmId)
      cancelAlarm(s.secondBuzzAlarmId)
      s.alarmId = null
      s.secondBuzzAlarmId = null
      s.scheduledForIndex = -1
      vibrateStop()
    } else {
      // Shift the timeline forward by however long we were paused.
      s.startTs += now - s.pauseStartTs
      s.paused = false
    }
    setSession(s)
    this.updateToggle()
    this.update()
  },

  showFinished() {
    var s = this.state
    s.phaseText.setProperty(hmUI.prop.MORE, { text: 'DONE', color: 0x2ecc71 })
    s.timeText.setProperty(hmUI.prop.MORE, { text: '0:00' })
    s.roundText.setProperty(hmUI.prop.MORE, { text: 'Workout complete' })
    s.setText.setProperty(hmUI.prop.MORE, { text: '' })
    s.ring.setProperty(hmUI.prop.MORE, { end_angle: 270, color: 0x2ecc71 })
    this.updateToggle()
  },

  stop() {
    var s = this.state.session
    if (s) {
      cancelAlarm(s.alarmId)
      cancelAlarm(s.secondBuzzAlarmId)
    }
    clearSession()
    this.state.session = null
    this.clearTimer()
    vibrateStop()
    try { hmApp.goBack() } catch (e) {}
  },

  onDestroy() {
    // Do NOT cancel the alarm here — screen-off may destroy this page, and the pending alarm
    // is what keeps the interval buzzes going. Stop is what ends the workout + cancels it.
    this.clearTimer()
    vibrateStop()
  }
})
