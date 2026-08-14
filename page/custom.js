import Engine from '../utils/workouts'
import { deviceSize } from '../utils/watch'
import { getCustomWorkout, setCustomWorkout, setPendingStart } from '../utils/storage'

var formatTime = Engine.formatTime
var SIZE = deviceSize()
var CX = SIZE.w / 2

// One field per screen — big targets. NEXT cycles through them; START begins anytime.
var FIELDS = [
  { key: 'work', label: 'WORK', min: 5, max: 900, step: 5, time: true },
  { key: 'rest', label: 'REST', min: 0, max: 900, step: 5, time: true },
  { key: 'rounds', label: 'ROUNDS', min: 1, max: 50, step: 1, time: false },
  { key: 'sets', label: 'SETS', min: 1, max: 20, step: 1, time: false }
]

function clamp(v, lo, hi) {
  if (v < lo) return lo
  if (v > hi) return hi
  return v
}

Page({
  state: { cfg: null, fi: 0, nameT: null, posT: null, valT: null, prevBtn: null, nextBtn: null, startBtn: null },

  onInit() {
    this.state.cfg = getCustomWorkout()
  },

  build() {
    var self = this
    var s = this.state

    // Gesture handling is app-wide and the last registration wins, so each page sets its
    // own policy on build. Here the default is right: swipe right returns to the menu.
    try {
      hmApp.registerGestureEvent(function () { return false })
    } catch (e) {}

    s.nameT = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 0, y: 52, w: SIZE.w, h: 44, color: 0x4aa3ff, text_size: 38,
      align_h: hmUI.align.CENTER_H, align_v: hmUI.align.CENTER_V, text: ''
    })
    s.posT = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 0, y: 100, w: SIZE.w, h: 28, color: 0x777777, text_size: 22,
      align_h: hmUI.align.CENTER_H, align_v: hmUI.align.CENTER_V, text: ''
    })
    s.valT = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 100, y: 168, w: SIZE.w - 200, h: 100, color: 0xffffff, text_size: 82,
      align_h: hmUI.align.CENTER_H, align_v: hmUI.align.CENTER_V, text: ''
    })

    // Big minus / plus circles flanking the value.
    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: 24, y: 170, w: 96, h: 96, radius: 48,
      normal_color: 0x2c2c2c, press_color: 0x484848,
      text: '-', text_size: 60, color: 0xffffff,
      click_func: function () { self.adjust(-1) }
    })
    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: SIZE.w - 120, y: 170, w: 96, h: 96, radius: 48,
      normal_color: 0x2c2c2c, press_color: 0x484848,
      text: '+', text_size: 50, color: 0xffffff,
      click_func: function () { self.adjust(1) }
    })

    // Wizard nav: PREV (left) on all but the first; NEXT (right) on all but the last;
    // START (right) only on the last field.
    var LX = 80
    var RX = SIZE.w - 212
    s.prevBtn = hmUI.createWidget(hmUI.widget.BUTTON, {
      x: LX, y: 348, w: 132, h: 62, radius: 31,
      normal_color: 0x2c2c2c, press_color: 0x484848,
      text: 'PREV', text_size: 28, color: 0xffffff,
      click_func: function () {
        if (s.fi > 0) s.fi--
        self.refresh()
      }
    })
    s.nextBtn = hmUI.createWidget(hmUI.widget.BUTTON, {
      x: RX, y: 348, w: 132, h: 62, radius: 31,
      normal_color: 0x2c2c2c, press_color: 0x484848,
      text: 'NEXT', text_size: 28, color: 0xffffff,
      click_func: function () {
        if (s.fi < FIELDS.length - 1) s.fi++
        self.refresh()
      }
    })
    s.startBtn = hmUI.createWidget(hmUI.widget.BUTTON, {
      x: RX, y: 348, w: 132, h: 62, radius: 31,
      normal_color: 0x14432a, press_color: 0x2ecc71,
      text: 'START', text_size: 28, color: 0xffffff,
      click_func: function () {
        setCustomWorkout(s.cfg)
        setPendingStart('custom') // mark this as a real user-initiated start
        try {
          hmApp.gotoPage({ file: 'page/workout', param: 'custom' })
        } catch (e) {}
      }
    })

    this.refresh()
  },

  field() {
    return FIELDS[this.state.fi]
  },

  refresh() {
    var s = this.state
    var f = this.field()
    var v = s.cfg[f.key]
    s.nameT.setProperty(hmUI.prop.MORE, { text: f.label })
    s.posT.setProperty(hmUI.prop.MORE, { text: s.fi + 1 + ' / ' + FIELDS.length })
    s.valT.setProperty(hmUI.prop.MORE, { text: f.time ? formatTime(v) : '' + v })

    var last = FIELDS.length - 1
    s.prevBtn.setProperty(hmUI.prop.VISIBLE, s.fi > 0)
    s.nextBtn.setProperty(hmUI.prop.VISIBLE, s.fi < last)
    s.startBtn.setProperty(hmUI.prop.VISIBLE, s.fi === last)
  },

  adjust(dir) {
    var s = this.state
    var f = this.field()
    s.cfg[f.key] = clamp(s.cfg[f.key] + dir * f.step, f.min, f.max)
    this.refresh()
  }
})
