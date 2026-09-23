/**
 * The student's character.
 *
 * Deliberately a handful of enumerated choices rather than sliders: the point
 * is to be recognisable at 28 pixels across a map, not to be a likeness. Every
 * combination is drawn from the same SVG in src/components/spaces/avatar.tsx,
 * so a character costs nothing to load and reads clearly at any size.
 *
 * Stored as JSON on UserProfile.avatar and built once — a student who has
 * already made their character never sees the builder again.
 */

export interface Avatar {
  body: number;
  skin: number;
  hair: number;
  hairColor: number;
  shirt: number;
  trousers: number;
  shoes: number;
  accessory: number;
  backpack: number;
}

export const SKIN_TONES = [
  "#f2d3b8",
  "#e6bb96",
  "#cf9b6f",
  "#a9714b",
  "#7d5034",
  "#54341f",
];

export const HAIR_COLORS = [
  "#2b2320",
  "#4a3226",
  "#7b4b28",
  "#c08b4a",
  "#e3c98d",
  "#8d8d96",
  "#b5543f",
  "#5b4b8a",
];

export const SHIRT_COLORS = [
  "#5b7cfa",
  "#e8734a",
  "#3fb98a",
  "#d94f70",
  "#8a6ff0",
  "#3aa8c1",
  "#e0b13f",
  "#4b5563",
];

export const TROUSER_COLORS = [
  "#37415a",
  "#22304a",
  "#4b3f35",
  "#2f3b34",
  "#5a3d4a",
  "#3b3b44",
];

export const SHOE_COLORS = ["#2b2f3a", "#6b4a33", "#d8d8dd", "#b03a3a"];

/** Counts of the shape variants the SVG knows how to draw. */
export const BODY_COUNT = 3;
export const HAIR_COUNT = 8;
/** 0 means none. */
export const ACCESSORY_COUNT = 5;
export const BACKPACK_COUNT = 4;

export const ACCESSORY_LABELS = [
  "Asnjë",
  "Syze",
  "Kufje",
  "Kapelë",
  "Shall",
];

export const BACKPACK_LABELS = ["Asnjë", "Çantë", "Shpinë", "Tub"];

export const BODY_LABELS = ["E hollë", "Mesatare", "E gjerë"];

export function defaultAvatar(): Avatar {
  return {
    body: 1,
    skin: 1,
    hair: 0,
    hairColor: 0,
    shirt: 0,
    trousers: 0,
    shoes: 0,
    accessory: 0,
    backpack: 0,
  };
}

const RANGES: Record<keyof Avatar, number> = {
  body: BODY_COUNT,
  skin: SKIN_TONES.length,
  hair: HAIR_COUNT,
  hairColor: HAIR_COLORS.length,
  shirt: SHIRT_COLORS.length,
  trousers: TROUSER_COLORS.length,
  shoes: SHOE_COLORS.length,
  accessory: ACCESSORY_COUNT,
  backpack: BACKPACK_COUNT,
};

/**
 * Reads an avatar from storage.
 *
 * Anything unrecognised falls back to the default rather than throwing: a
 * malformed row should give a student a plain character, never a broken page.
 */
export function parseAvatar(raw: string | null | undefined): Avatar {
  const base = defaultAvatar();
  if (!raw) return base;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return base;
  }
  if (!parsed || typeof parsed !== "object") return base;

  const input = parsed as Record<string, unknown>;
  const out = { ...base };

  for (const key of Object.keys(RANGES) as (keyof Avatar)[]) {
    const value = input[key];
    if (typeof value !== "number" || !Number.isInteger(value)) continue;
    // Wrap rather than clamp, so an out-of-range index from an older build
    // still resolves to a real variant instead of always variant 0.
    out[key] = ((value % RANGES[key]) + RANGES[key]) % RANGES[key];
  }

  return out;
}

export function serialiseAvatar(avatar: Avatar): string {
  return JSON.stringify(avatar);
}

/** A stable avatar for a user who has not built one, derived from their id. */
export function avatarFromSeed(seed: string): Avatar {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }

  const pick = (range: number, shift: number) =>
    Math.floor(hash / Math.pow(range, shift)) % range;

  return {
    body: pick(BODY_COUNT, 0),
    skin: pick(SKIN_TONES.length, 1),
    hair: pick(HAIR_COUNT, 0),
    hairColor: pick(HAIR_COLORS.length, 1),
    shirt: pick(SHIRT_COLORS.length, 0),
    trousers: pick(TROUSER_COLORS.length, 1),
    shoes: pick(SHOE_COLORS.length, 0),
    accessory: 0,
    backpack: 0,
  };
}
