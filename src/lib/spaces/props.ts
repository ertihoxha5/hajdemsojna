/**
 * The furniture in a room.
 *
 * A study space is recognisable because of its objects, not its floor colour:
 * a library has long tables and shelves, a café has a counter and small round
 * tables, a cabin has a fireplace. This file is what makes the eight rooms
 * feel like eight different places rather than one grid in eight tints.
 *
 * Props are data, drawn as isometric SVG at runtime. Each one sits on a grid
 * cell and is painted back-to-front by depth, so things in front genuinely
 * overlap things behind them.
 */

export type PropKind =
  | "rug"
  | "desk"
  | "deskRound"
  | "chair"
  | "shelf"
  | "sofa"
  | "beanbag"
  | "plant"
  | "plantTall"
  | "lamp"
  | "floorLamp"
  | "fireplace"
  | "counter"
  | "board"
  | "window"
  | "rack"
  | "railing"
  | "books"
  | "laptop"
  | "mug"
  | "rangeBox";

/** Which way a prop faces. Affects the drawn silhouette, not the footprint. */
export type Facing = "n" | "e" | "s" | "w";

export interface Prop {
  kind: PropKind;
  x: number;
  y: number;
  /** Footprint in cells. Defaults to 1x1. */
  w?: number;
  h?: number;
  facing?: Facing;
  /** Overrides the material colour, for accents like a coloured sofa. */
  tint?: string;
  /** Props that emit light get a glow on the floor beneath them. */
  light?: boolean;
}

/* ============================================================
   Shared pieces
   ============================================================ */

/** A long table with chairs down both sides, matching tableSeats(). */
function longTable(x: number, y: number, width: number): Prop[] {
  const props: Prop[] = [{ kind: "desk", x, y, w: width, h: 1 }];

  for (let i = 0; i < width; i++) {
    props.push({ kind: "chair", x: x + i, y: y - 1, facing: "s" });
    props.push({ kind: "chair", x: x + i, y: y + 1, facing: "n" });
  }

  // A couple of objects on the table so it reads as in use, not showroom.
  props.push({ kind: "laptop", x, y });
  if (width > 1) props.push({ kind: "mug", x: x + width - 1, y });

  return props;
}

/** The wall of shelves along the top edge. */
function shelfWall(fromX: number, toX: number, y = 0): Prop[] {
  const props: Prop[] = [];
  for (let x = fromX; x <= toX; x++) {
    props.push({ kind: "shelf", x, y });
  }
  return props;
}

/* ============================================================
   Per-room layouts
   ============================================================ */

/**
 * Every layout is built around the same zones, so movement stays learnable
 * across rooms: study tables in the middle, quiet corner left, social right,
 * break bottom-left, AI top-right.
 */
export const PROPS: Record<string, Prop[]> = {
  biblioteka: [
    ...shelfWall(4, 11),
    { kind: "window", x: 2, y: 0 },
    { kind: "window", x: 13, y: 0 },

    { kind: "rug", x: 4, y: 3, w: 8, h: 3 },
    ...longTable(5, 4, 3),
    ...longTable(9, 4, 2),

    // quiet corner
    { kind: "shelf", x: 0, y: 1 },
    { kind: "deskRound", x: 2, y: 2 },
    { kind: "chair", x: 1, y: 2, facing: "e" },
    { kind: "chair", x: 1, y: 3, facing: "e" },
    { kind: "floorLamp", x: 0, y: 4, light: true },
    { kind: "books", x: 2, y: 1 },

    // social
    { kind: "sofa", x: 13, y: 7, w: 2, h: 1, facing: "n", tint: "#4a5578" },
    { kind: "deskRound", x: 13, y: 8 },
    { kind: "plantTall", x: 15, y: 6 },

    // break
    { kind: "beanbag", x: 1, y: 8 },
    { kind: "beanbag", x: 2, y: 9 },
    { kind: "plant", x: 0, y: 7 },

    // AI desk
    { kind: "desk", x: 14, y: 2, w: 2, h: 1 },
    { kind: "lamp", x: 14, y: 2, light: true },

    { kind: "plant", x: 3, y: 6 },
    { kind: "plantTall", x: 12, y: 2 },
  ],

  kafe: [
    { kind: "counter", x: 4, y: 0, w: 5, h: 1 },
    { kind: "window", x: 1, y: 0 },
    { kind: "window", x: 14, y: 0 },
    { kind: "shelf", x: 10, y: 0 },
    { kind: "shelf", x: 11, y: 0 },

    { kind: "rug", x: 4, y: 3, w: 8, h: 3, tint: "#6b4a33" },
    ...longTable(5, 4, 3),
    ...longTable(9, 4, 2),

    { kind: "deskRound", x: 2, y: 2 },
    { kind: "chair", x: 1, y: 2, facing: "e" },
    { kind: "chair", x: 1, y: 3, facing: "e" },
    { kind: "plant", x: 0, y: 1 },

    { kind: "sofa", x: 13, y: 7, w: 2, h: 1, facing: "n", tint: "#8a5a3c" },
    { kind: "deskRound", x: 13, y: 8 },
    { kind: "mug", x: 13, y: 8 },

    { kind: "beanbag", x: 1, y: 8 },
    { kind: "beanbag", x: 2, y: 9 },
    { kind: "plantTall", x: 0, y: 9 },

    { kind: "desk", x: 14, y: 2, w: 2, h: 1 },
    { kind: "lamp", x: 14, y: 2, light: true },
    { kind: "floorLamp", x: 3, y: 6, light: true },
    { kind: "plantTall", x: 12, y: 1 },
  ],

  klasa: [
    { kind: "board", x: 5, y: 0, w: 6, h: 1 },
    { kind: "window", x: 1, y: 0 },
    { kind: "window", x: 2, y: 0 },
    { kind: "window", x: 13, y: 0 },
    { kind: "window", x: 14, y: 0 },

    ...longTable(5, 4, 3),
    ...longTable(9, 4, 2),

    { kind: "deskRound", x: 2, y: 2 },
    { kind: "chair", x: 1, y: 2, facing: "e" },
    { kind: "chair", x: 1, y: 3, facing: "e" },

    { kind: "sofa", x: 13, y: 7, w: 2, h: 1, facing: "n", tint: "#6b7a90" },
    { kind: "plant", x: 15, y: 6 },

    { kind: "beanbag", x: 1, y: 8 },
    { kind: "beanbag", x: 2, y: 9 },
    { kind: "plant", x: 0, y: 9 },

    { kind: "desk", x: 14, y: 2, w: 2, h: 1 },
    { kind: "shelf", x: 11, y: 0 },
  ],

  tarraca: [
    { kind: "railing", x: 0, y: 0, w: 16, h: 1 },
    { kind: "plantTall", x: 3, y: 1 },
    { kind: "plantTall", x: 12, y: 1 },
    { kind: "plant", x: 7, y: 1 },

    { kind: "rug", x: 4, y: 3, w: 8, h: 3, tint: "#3d5a52" },
    ...longTable(5, 4, 3),
    ...longTable(9, 4, 2),

    { kind: "deskRound", x: 2, y: 2 },
    { kind: "chair", x: 1, y: 2, facing: "e" },
    { kind: "chair", x: 1, y: 3, facing: "e" },
    { kind: "plantTall", x: 0, y: 1 },

    { kind: "sofa", x: 13, y: 7, w: 2, h: 1, facing: "n", tint: "#3f7a68" },
    { kind: "deskRound", x: 13, y: 8 },

    { kind: "beanbag", x: 1, y: 8 },
    { kind: "beanbag", x: 2, y: 9 },
    { kind: "floorLamp", x: 0, y: 7, light: true },

    { kind: "desk", x: 14, y: 2, w: 2, h: 1 },
    { kind: "lamp", x: 14, y: 2, light: true },
  ],

  shi: [
    { kind: "window", x: 3, y: 0, w: 4, h: 1 },
    { kind: "window", x: 9, y: 0, w: 4, h: 1 },
    { kind: "shelf", x: 0, y: 0 },
    { kind: "shelf", x: 1, y: 0 },

    { kind: "rug", x: 4, y: 3, w: 8, h: 3, tint: "#3a4256" },
    ...longTable(5, 4, 3),
    ...longTable(9, 4, 2),

    { kind: "deskRound", x: 2, y: 2 },
    { kind: "chair", x: 1, y: 2, facing: "e" },
    { kind: "chair", x: 1, y: 3, facing: "e" },
    { kind: "floorLamp", x: 0, y: 4, light: true },
    { kind: "books", x: 2, y: 1 },

    { kind: "sofa", x: 13, y: 7, w: 2, h: 1, facing: "n", tint: "#44506e" },
    { kind: "plantTall", x: 15, y: 6 },

    { kind: "beanbag", x: 1, y: 8 },
    { kind: "beanbag", x: 2, y: 9 },
    { kind: "plant", x: 0, y: 7 },

    { kind: "desk", x: 14, y: 2, w: 2, h: 1 },
    { kind: "lamp", x: 14, y: 2, light: true },
    { kind: "plant", x: 3, y: 6 },
  ],

  kasolle: [
    { kind: "fireplace", x: 7, y: 0, w: 2, h: 1, light: true },
    { kind: "shelf", x: 4, y: 0 },
    { kind: "shelf", x: 5, y: 0 },
    { kind: "shelf", x: 10, y: 0 },
    { kind: "window", x: 1, y: 0 },
    { kind: "window", x: 14, y: 0 },

    { kind: "rug", x: 4, y: 3, w: 8, h: 3, tint: "#7a4a2e" },
    ...longTable(5, 4, 3),
    ...longTable(9, 4, 2),

    { kind: "deskRound", x: 2, y: 2 },
    { kind: "chair", x: 1, y: 2, facing: "e" },
    { kind: "chair", x: 1, y: 3, facing: "e" },
    { kind: "floorLamp", x: 0, y: 4, light: true },

    { kind: "sofa", x: 13, y: 7, w: 2, h: 1, facing: "n", tint: "#8a4f34" },
    { kind: "deskRound", x: 13, y: 8 },
    { kind: "mug", x: 13, y: 8 },

    { kind: "beanbag", x: 1, y: 8 },
    { kind: "beanbag", x: 2, y: 9 },
    { kind: "plant", x: 0, y: 9 },
    { kind: "books", x: 2, y: 1 },

    { kind: "desk", x: 14, y: 2, w: 2, h: 1 },
    { kind: "lamp", x: 14, y: 2, light: true },
  ],

  minimal: [
    // Almost nothing, on purpose. The room is the feature.
    ...longTable(5, 4, 3),
    ...longTable(9, 4, 2),
    { kind: "deskRound", x: 2, y: 2 },
    { kind: "chair", x: 1, y: 2, facing: "e" },
    { kind: "chair", x: 1, y: 3, facing: "e" },
    { kind: "plant", x: 0, y: 9 },
    { kind: "desk", x: 14, y: 2, w: 2, h: 1 },
    { kind: "sofa", x: 13, y: 7, w: 2, h: 1, facing: "n", tint: "#9a9aa2" },
    { kind: "beanbag", x: 1, y: 8 },
    { kind: "beanbag", x: 2, y: 9 },
  ],

  lab: [
    { kind: "rack", x: 3, y: 0 },
    { kind: "rack", x: 4, y: 0 },
    { kind: "rack", x: 11, y: 0 },
    { kind: "rack", x: 12, y: 0 },
    { kind: "board", x: 6, y: 0, w: 4, h: 1, tint: "#2b2450" },

    { kind: "rug", x: 4, y: 3, w: 8, h: 3, tint: "#2a2350" },
    ...longTable(5, 4, 3),
    ...longTable(9, 4, 2),

    { kind: "deskRound", x: 2, y: 2 },
    { kind: "chair", x: 1, y: 2, facing: "e" },
    { kind: "chair", x: 1, y: 3, facing: "e" },
    { kind: "lamp", x: 1, y: 2, light: true },

    { kind: "sofa", x: 13, y: 7, w: 2, h: 1, facing: "n", tint: "#4a3f8a" },
    { kind: "plantTall", x: 15, y: 6 },

    { kind: "beanbag", x: 1, y: 8 },
    { kind: "beanbag", x: 2, y: 9 },
    { kind: "floorLamp", x: 0, y: 7, light: true },

    { kind: "desk", x: 14, y: 2, w: 2, h: 1 },
    { kind: "lamp", x: 14, y: 2, light: true },
    { kind: "rack", x: 0, y: 0 },
  ],
};

export function propsFor(environmentKey: string): Prop[] {
  return PROPS[environmentKey] ?? PROPS.biblioteka;
}
