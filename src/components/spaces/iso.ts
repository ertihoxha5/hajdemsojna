/**
 * Isometric projection for the study map.
 *
 * A 2:1 diamond grid — the standard game isometric — because it reads as a
 * room you are looking into rather than a floor plan seen from directly
 * above, and it lets furniture have visible height and cast shadow.
 *
 * Grid (x, y) runs back-left to front-right. Screen coordinates are in SVG
 * user units; the whole scene is scaled by the viewBox, so nothing here needs
 * to know the pixel size of the element.
 */

/** Half-width and half-height of one floor tile. */
export const TILE_W = 32;
export const TILE_H = 16;

/** How tall one "storey" of a prop is, in screen units. */
export const UNIT_H = 22;

export interface Point {
  x: number;
  y: number;
}

/** Grid cell centre to screen position. */
export function iso(gx: number, gy: number): Point {
  return {
    x: (gx - gy) * TILE_W,
    y: (gx + gy) * TILE_H,
  };
}

/**
 * The reverse, for click-to-move.
 *
 * Rounds to the nearest cell centre, so clicking anywhere inside a diamond
 * selects that diamond rather than the bounding box it sits in.
 */
export function unIso(sx: number, sy: number): Point {
  const gx = (sx / TILE_W + sy / TILE_H) / 2;
  const gy = (sy / TILE_H - sx / TILE_W) / 2;
  return { x: Math.round(gx), y: Math.round(gy) };
}

/**
 * The bounds the whole grid occupies, so the viewBox can be computed rather
 * than guessed. Padded for furniture that stands above its tile.
 */
export function sceneBounds(cols: number, rows: number) {
  const left = iso(0, rows - 1).x - TILE_W;
  const right = iso(cols - 1, 0).x + TILE_W;
  const top = iso(0, 0).y - UNIT_H * 3;
  const bottom = iso(cols - 1, rows - 1).y + TILE_H * 2 + UNIT_H;

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

/**
 * Painter's-algorithm depth.
 *
 * Anything further back is drawn first. Ties are broken so that a prop and an
 * avatar on the same cell put the avatar in front, otherwise a student
 * sitting at a desk would be hidden behind it.
 */
export function depth(gx: number, gy: number, layer = 0): number {
  return (gx + gy) * 10 + layer;
}

/** The four corners of one floor tile, as an SVG points string. */
export function tilePoints(gx: number, gy: number): string {
  const c = iso(gx, gy);
  return [
    `${c.x},${c.y - TILE_H}`,
    `${c.x + TILE_W},${c.y}`,
    `${c.x},${c.y + TILE_H}`,
    `${c.x - TILE_W},${c.y}`,
  ].join(" ");
}

/* ============================================================
   Shading
   ============================================================ */

/**
 * Light comes from the upper left in every room, so all the furniture agrees
 * about where the shadows fall. These multipliers are applied to a base
 * colour to get the three visible faces of a box.
 */
export const FACE = {
  top: 1,
  left: 0.74,
  right: 0.55,
} as const;

/** Multiplies a hex colour towards black. */
export function shade(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean.padEnd(6, "0").slice(0, 6);

  const channel = (i: number) => {
    const value = parseInt(full.slice(i, i + 2), 16);
    return Math.max(0, Math.min(255, Math.round(value * amount)));
  };

  const hexOf = (n: number) => n.toString(16).padStart(2, "0");
  return `#${hexOf(channel(0))}${hexOf(channel(2))}${hexOf(channel(4))}`;
}
