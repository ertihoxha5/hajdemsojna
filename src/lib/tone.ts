/**
 * Subject colour tones — the app's categorical palette.
 *
 * Five fixed slots, assigned in order and never cycled or reshuffled: a subject
 * keeps its colour wherever it appears. Both columns are validated against their
 * own surface (lightness band, chroma floor, CVD separation, normal-vision
 * separation, contrast) rather than the dark set being an automatic flip of the
 * light one. Colour is always paired with the subject's name, so identity never
 * depends on hue alone.
 */
export const TONES = [
  { key: "indigo", fg: "#5a54f3", bg: "rgba(90,84,243,0.10)", ring: "rgba(90,84,243,0.30)" },
  { key: "teal", fg: "#0f9488", bg: "rgba(15,148,136,0.11)", ring: "rgba(15,148,136,0.30)" },
  { key: "amber", fg: "#c2740a", bg: "rgba(194,116,10,0.11)", ring: "rgba(194,116,10,0.30)" },
  { key: "rose", fg: "#d0456c", bg: "rgba(208,69,108,0.10)", ring: "rgba(208,69,108,0.30)" },
  { key: "magenta", fg: "#a21caf", bg: "rgba(162,28,175,0.10)", ring: "rgba(162,28,175,0.30)" },
];

export const TONES_DARK = [
  { fg: "#8681ff", bg: "rgba(134,129,255,0.16)", ring: "rgba(134,129,255,0.38)" },
  { fg: "#13a190", bg: "rgba(19,161,144,0.16)", ring: "rgba(19,161,144,0.38)" },
  { fg: "#c98424", bg: "rgba(201,132,36,0.16)", ring: "rgba(201,132,36,0.38)" },
  { fg: "#d8557a", bg: "rgba(216,85,122,0.16)", ring: "rgba(216,85,122,0.38)" },
  { fg: "#b23bc0", bg: "rgba(178,59,192,0.16)", ring: "rgba(178,59,192,0.38)" },
];

export function tone(i: number, dark = false) {
  const idx = ((i % TONES.length) + TONES.length) % TONES.length;
  return dark ? TONES_DARK[idx] : TONES[idx];
}

