import Engine from '../utils/workouts'
import { deviceSize } from '../utils/watch'
import { setLastPresetIndex, getSession } from '../utils/storage'

var PRESETS = Engine.PRESETS
var SIZE = deviceSize()

var CUSTOM_COLOR = 0x4aa3ff
var PRESET_COLOR = 0x2ecc71
var ITEM_H = 112
var PAD = 18 // equal space from name→top border and summary→bottom border

function summarize(p) {
  var s = p.work + '/' + (p.rest || 0) + ' ×' + p.rounds
  if (p.sets > 1) s += ' · ' + p.sets + ' sets'
  return s
}

// Full-width, native-Alarm-style rows (no side margin, no radius). Two full-height
// text_views positioned purely by align_v (name top, summary bottom) — NO y-offset, which
// is what keeps the top-edge row from blanking while scrolling.
function itemConfig(typeId, nameColor) {
  return {
    type_id: typeId,
    item_bg_color: 0x1c1c1e,
    item_bg_radius: 0,
    text_view: [
      { x: 0, y: PAD, w: SIZE.w, h: ITEM_H - PAD * 2, key: 'name', color: nameColor, text_size: 30, align_h: hmUI.align.CENTER_H, align_v: hmUI.align.TOP },
      { x: 0, y: PAD, w: SIZE.w, h: ITEM_H - PAD * 2, key: 'summary', color: 0x9a9a9a, text_size: 22, align_h: hmUI.align.CENTER_H, align_v: hmUI.align.BOTTOM }
    ],
    text_view_count: 2,
    item_height: ITEM_H
  }
}

Page({
  // Run before build() so the menu is never drawn during a workout: if a session is still
  // in progress (a background alarm cold-launched the app to its home page), redirect into
  // the workout immediately.
  onInit() {
    var session = getSession()
    if (session && !session.finishedBuzzed) {
      this._redirecting = true
      try {
        hmApp.gotoPage({ file: 'page/workout', param: 'resume' })
      } catch (e) {}
    }
  },

  build() {
    if (this._redirecting) return

    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 0, y: 26, w: SIZE.w, h: 32,
      color: 0x777777, text_size: 24,
      align_h: hmUI.align.CENTER_H, align_v: hmUI.align.CENTER_V,
      text: 'WORKOUTS'
    })

    var rows = [{ kind: 'custom' }]
    PRESETS.forEach(function (p, i) {
      rows.push({ kind: 'preset', i: i })
    })

    var data = rows.map(function (r) {
      if (r.kind === 'custom') return { name: 'Custom', summary: 'Set your own' }
      return { name: PRESETS[r.i].name, summary: summarize(PRESETS[r.i]) }
    })

    var typeCfg = [
      { start: 0, end: 1, type_id: 1 },
      { start: 1, end: rows.length, type_id: 2 }
    ]
    var itemConfigs = [itemConfig(1, CUSTOM_COLOR), itemConfig(2, PRESET_COLOR)]

    // Viewport bottom kept above the bezel: at max scroll the last row settles here, with
    // real (off-pixel) black space below it — no spacer row needed.
    var top = 66
    var bottom = 416
    hmUI.createWidget(hmUI.widget.SCROLL_LIST, {
      x: 0,
      y: top,
      w: SIZE.w,
      h: bottom - top,
      item_space: 4,
      item_config: itemConfigs,
      item_config_count: itemConfigs.length,
      data_array: data,
      data_count: data.length,
      data_type_config: typeCfg,
      data_type_config_count: typeCfg.length,
      on_page: 1,
      item_click_func: function (list, index) {
        var r = rows[index]
        if (!r) return
        if (r.kind === 'custom') {
          try {
            hmApp.gotoPage({ file: 'page/custom' })
          } catch (e) {}
          return
        }
        setLastPresetIndex(r.i)
        try {
          hmApp.gotoPage({ file: 'page/workout', param: '' + r.i })
        } catch (e) {}
      }
    })
  }
})
