// ============================================================
// Ù‚ÙˆØ§Ù„Ø¨ Ø£Ø³Ù†Ø§Ù† Ø­Ù‚ÙŠÙ‚ÙŠØ© (ØªØ´Ø±ÙŠØ­ÙŠØ© Ù…Ù‚ÙŠØ³Ø©) â€” ØªÙØ±Ø³Ù… ÙÙŠ Ù…Ø®Ø·Ø· Ø§Ù„ÙƒØ´Ù Ø¨Ø¯Ù„ Ø§Ù„Ø±Ø³ÙˆÙ…Ø§Øª
// Ø§Ù„Ù…ØµØ¯Ø±: React Advanced Odontogram â€” ZoltÃ¡n Dul â€” Ø±Ø®ØµØ© MIT
// https://github.com/ZoliQua/React-Advanced-Odontogram (assets/teeth-svgs/measured)
// geometry per tooth: viewBox, crown span (X), CEJ, root apex, occlusal edge (Y)
// ============================================================

// Ù„Ù…Ø¹Ø¯Ø¯ Ø§Ù„Ø¥Ø¹Ø§Ø¯Ø© ÙˆØ§Ù„Ø¯Ø±Ø¯Ø© (Ø§Ù„Ø£Ø³Ù†Ø§Ù† ØªØ·Ø±Ø¯ Ø¨Ø§Ù„Ø³Ø§Ø¯Ø© Ø§Ù„Ø«Ø§Ø¨ØªØ© Ù…Ù† Ø§Ù„Ø¯Ø±Ø¯Ø©)
export const BASE_TINT = 'sepia(0.15) saturate(0.8) brightness(0.85) contrast(1.1)'

export const TOOTH_META = {
  11: { x: 0, w: 39.7, h: 80.3, cl: 2.593, cr: 37.176, cej: 39.812, nl: 10.922, nr: 30.242, apex: 4.73, occl: 72.29 },
  12: { x: 0, w: 39.7, h: 78.5, cl: 6.729, cr: 32.992, cej: 40.991, nl: 12.706, nr: 28.12, apex: 4.88, occl: 70.5 },
  13: { x: 0, w: 40.3, h: 85.0, cl: 5.172, cr: 34.31, cej: 47.126, nl: 8.084, nr: 30.02, apex: 7.29, occl: 77.0 },
  14: { x: 0, w: 39.8, h: 88.7, cl: 5.351, cr: 33.993, cej: 51.775, nl: 9.638, nr: 29.048, apex: 14.84, occl: 80.7 },
  15: { x: 0, w: 39.8, h: 81.3, cl: 6.465, cr: 32.871, cej: 46.897, nl: 10.151, nr: 28.559, apex: 8.49, occl: 73.36 },
  16: { x: -1.3, w: 44.6, h: 86.5, cl: 0.459, cr: 41.421, cej: 49.045, nl: 6.721, nr: 34.52, apex: 14.5, occl: 78.55 },
  17: { x: 0, w: 42.9, h: 85.9, cl: 2.572, cr: 39.383, cej: 47.909, nl: 7.835, nr: 33.469, apex: 14.14, occl: 77.88 },
  18: { x: 0, w: 42.9, h: 84.7, cl: 3.615, cr: 38.297, cej: 47.193, nl: 8.075, nr: 33.223, apex: 13.99, occl: 76.76 },
  31: { x: 0, w: 39.7, h: 76.8, cl: 9.776, cr: 29.89, cej: 41.424, nl: 14.161, nr: 26.387, apex: 4.92, occl: 68.8 },
  32: { x: 0, w: 39.7, h: 77.3, cl: 8.749, cr: 30.95, cej: 41.707, nl: 13.746, nr: 26.889, apex: 4.91, occl: 69.3 },
  33: { x: 0, w: 40.3, h: 83.9, cl: 6.052, cr: 33.42, cej: 46.44, nl: 8.69, nr: 29.488, apex: 7.16, occl: 75.9 },
  34: { x: 0, w: 39.8, h: 82.1, cl: 5.585, cr: 33.569, cej: 46.668, nl: 8.561, nr: 29.867, apex: 8.28, occl: 74.15 },
  35: { x: 0, w: 39.8, h: 81.9, cl: 4.88, cr: 34.285, cej: 45.788, nl: 9.597, nr: 28.933, apex: 8.32, occl: 73.95 },
  36: { x: -3.3, w: 48.6, h: 88.4, cl: -1.548, cr: 43.422, cej: 55.725, nl: 5.48, nr: 35.719, apex: 16.4, occl: 80.44 },
  37: { x: -2.3, w: 46.6, h: 87.3, cl: -0.504, cr: 42.45, cej: 53.435, nl: 5.642, nr: 35.528, apex: 15.77, occl: 79.29 },
  38: { x: -1.3, w: 44.6, h: 85.4, cl: 0.575, cr: 41.385, cej: 50.636, nl: 5.681, nr: 35.486, apex: 14.97, occl: 77.47 },
  // Ø£Ø³Ù†Ø§Ù† Ù„Ø¨Ù†ÙŠØ©
  51: { x: 0, w: 39.7, h: 66.3, cl: 6.816, cr: 32.861, cej: 33.94, nl: 12.88, nr: 27.856, apex: 4.11, occl: 58.29 },
  52: { x: 0, w: 39.7, h: 64.9, cl: 9.592, cr: 30.069, cej: 34.906, nl: 14.353, nr: 26.145, apex: 4.26, occl: 56.88 },
  53: { x: 0, w: 40.3, h: 70.6, cl: 8.148, cr: 31.347, cej: 37.101, nl: 10.906, nr: 27.573, apex: 5.9, occl: 62.59 },
  54: { x: 0, w: 39.8, h: 71.4, cl: 5.045, cr: 34.262, cej: 44.448, nl: 9.383, nr: 29.24, apex: 12.82, occl: 63.43 },
  55: { x: 0, w: 42.9, h: 72.6, cl: 4.46, cr: 37.535, cej: 41.071, nl: 9.324, nr: 32.062, apex: 12.28, occl: 64.66 },
  71: { x: 0, w: 39.7, h: 63.4, cl: 11.797, cr: 27.878, cej: 35.704, nl: 15.546, nr: 24.78, apex: 4.31, occl: 55.39 },
  72: { x: 0, w: 39.7, h: 64.0, cl: 10.797, cr: 28.882, cej: 35.529, nl: 15.012, nr: 25.402, apex: 4.36, occl: 56.01 },
  73: { x: 0, w: 40.3, h: 68.5, cl: 9.292, cr: 30.146, cej: 35.877, nl: 11.768, nr: 26.743, apex: 5.75, occl: 60.51 },
  74: { x: 0, w: 42.9, h: 72.4, cl: 5.549, cr: 36.432, cej: 45.313, nl: 10.105, nr: 31.317, apex: 13.48, occl: 64.46 },
  75: { x: -1.1, w: 44.2, h: 73.1, cl: 1.057, cr: 40.925, cej: 41.387, nl: 6.917, nr: 34.316, apex: 12.4, occl: 65.17 },
}

// Ø§Ù„Ù‚ÙˆØ§Ù„Ø¨ Ù…Ø±Ø³ÙˆÙ…Ø© Ù„Ù„Ø±Ø¨Ø¹ Ø§Ù„Ø¹Ù„ÙˆÙŠ Ø§Ù„Ø£ÙŠÙ…Ù† (11-18) ÙˆØ§Ù„Ø³ÙÙ„ÙŠ Ø§Ù„Ø£ÙŠØ³Ø± (31-38)
// ÙˆÙƒÙ„ Ø³Ù† Ø¢Ø®Ø± = Ù…Ø±Ø¢Ø© Ù‚Ø§Ù„Ø¨ Ù†Ø¸ÙŠØ±Ù‡ Ø¹Ø¨Ø± Ù…Ù†ØªØµÙ Ø§Ù„ÙÙƒ (Ù†ÙØ³ Ø§ØµØ·Ù„Ø§Ø­ Ø§Ù„Ù…ØµØ¯Ø±)
const TEMPLATE_OF = {}
for (const n of [11, 12, 13, 14, 15, 16, 17, 18]) {
  TEMPLATE_OF[n] = { tpl: n, mirror: false }
  TEMPLATE_OF[n + 10] = { tpl: n, mirror: true } // 21-28 â† 11-18
}
for (const n of [31, 32, 33, 34, 35, 36, 37, 38]) {
  TEMPLATE_OF[n] = { tpl: n, mirror: false }
  TEMPLATE_OF[n - 10] = { tpl: n, mirror: true } // 41-48 â† 31-38
}
for (const n of [51, 52, 53, 54, 55]) {
  TEMPLATE_OF[n] = { tpl: n, mirror: false }
  TEMPLATE_OF[n + 10] = { tpl: n, mirror: true } // 61-65 â† 51-55
}
for (const n of [71, 72, 73, 74, 75]) {
  TEMPLATE_OF[n] = { tpl: n, mirror: false }
  TEMPLATE_OF[n + 10] = { tpl: n, mirror: true } // 81-85 â† 71-75
}

export const templateFor = (no) => TEMPLATE_OF[no] || { tpl: 11, mirror: false }

// Ù‡Ø¯Ù Ø§Ù„Ù‚ÙŠØ§Ø³ ÙÙŠ Ø¥Ø­Ø¯Ø§Ø«ÙŠØ§Øª Ø§Ù„Ù…Ø®Ø·Ø·: Ø£Ø¹Ù„Ù‰ Ø­Ø§ÙØ© Ø§Ù„Ø¥Ø·Ø¨Ø§Ù‚ Ø¹Ù†Ø¯ -19 ÙˆØ£Ù‚ØµÙ‰ Ø·ÙˆÙ„ Ù„Ù„Ø³Ù† 66 ÙˆØ­Ø¯Ø©
const CROWN_TOP = -19
const TARGET_CROWN_W = 40
const MAX_TOOTH_H = 66

/**
 * Ù‡Ù†Ø¯Ø³Ø© ØµÙˆØ±Ø© Ø§Ù„Ø³Ù† Ø§Ù„Ø­Ù‚ÙŠÙ‚ÙŠØ©: Ù…Ø³Ø§Ø± Ø§Ù„Ù‚Ø§Ù„Ø¨ + ØªØ­ÙˆÙŠÙ„Ù‡ + Ø­Ø¯ÙˆØ¯ Ø§Ù„ØªØ§Ø¬ ÙˆØ§Ù„Ø¬Ø°ÙˆØ±
 * (ØªÙØ³ØªØ®Ø¯Ù… Ù„Ø±Ø³Ù… ØªØ£Ø«ÙŠØ±Ø§Øª Ø§Ù„Ø¹Ù„Ø§Ø¬ Ø¨Ù…Ø­Ø§Ø°Ø§Ø© ØªØ´Ø±ÙŠØ­ÙŠØ© ØµØ­ÙŠØ­Ø©)
 */
export function toothGeometry(no) {
  const { tpl, mirror } = templateFor(no)
  const m = TOOTH_META[tpl]
  const span = m.occl - m.apex // Ø§Ù„Ø·ÙˆÙ„ Ø§Ù„ÙƒÙ„ÙŠ Ù„Ù„Ø³Ù† (ØªØ§Ø¬ + Ø¬Ø°ÙˆØ±)
  const crownW = m.cr - m.cl
  const k = Math.min(TARGET_CROWN_W / crownW, MAX_TOOTH_H / span)
  const cx = (m.cl + m.cr) / 2
  const sx = k * (mirror ? -1 : 1)
  return {
    href: `/teeth/${tpl}.svg`,
    rect: { x: m.x, y: 0, width: m.w, height: m.h },
    transform: `translate(${-sx * cx},${k * m.occl + CROWN_TOP}) scale(${sx},${-k})`,
    crownTop: CROWN_TOP,
    crownBottom: CROWN_TOP + (m.occl - m.cej) * k,
    rootBottom: CROWN_TOP + span * k,
    crownHalfW: (crownW * k) / 2,
    rootHalfW: ((m.nr - m.nl) * k) / 2,
    k,
  }
}
