/**
 * The virtual environments a space can be set in.
 *
 * Each one is data, not a picture: the map is drawn from this at runtime, so
 * adding an environment is adding an entry here rather than commissioning an
 * illustration. That also keeps every room the same weight to load.
 *
 * The palette drives the lighting. `chrome` stays out of it — the app's own
 * brand colours own the UI around the map, and only the map itself changes.
 */

export type ZoneKind = "study" | "quiet" | "social" | "break" | "ai";

export interface Zone {
  id: string;
  label: string;
  kind: ZoneKind;
  /** Grid cells, top-left origin. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Seat {
  id: string;
  zoneId: string;
  x: number;
  y: number;
  /** Seats sharing a table are neighbours for the proximity rules. */
  tableId: string;
}

export interface Environment {
  key: string;
  name: string;
  tagline: string;
  /** Map grid size, in cells. */
  cols: number;
  rows: number;
  /** CSS colours used to light the map. */
  palette: {
    floor: string;
    floorAlt: string;
    wall: string;
    glow: string;
    accent: string;
    /** Sits over everything during focus mode. */
    dim: string;
  };
  /** Ambience keys that suit this room, offered first in the picker. */
  suggests: string[];
  zones: Zone[];
  seats: Seat[];
}

/** Builds the seats around a rectangular table: one per cell along two sides. */
function tableSeats(
  tableId: string,
  zoneId: string,
  x: number,
  y: number,
  width: number
): Seat[] {
  const seats: Seat[] = [];
  for (let i = 0; i < width; i++) {
    seats.push({ id: `${tableId}-n${i}`, zoneId, tableId, x: x + i, y: y - 1 });
    seats.push({ id: `${tableId}-s${i}`, zoneId, tableId, x: x + i, y: y + 1 });
  }
  return seats;
}

const COLS = 16;
const ROWS = 11;

/** The zone layout every environment shares, so movement feels learnable. */
const BASE_ZONES: Zone[] = [
  { id: "main", label: "Tavolina kryesore", kind: "study", x: 4, y: 3, w: 8, h: 3 },
  { id: "quiet", label: "Zona e qetë", kind: "quiet", x: 0, y: 1, w: 3, h: 4 },
  { id: "social", label: "Zona sociale", kind: "social", x: 12, y: 6, w: 4, h: 4 },
  { id: "break", label: "Zona e pushimit", kind: "break", x: 0, y: 7, w: 4, h: 4 },
  { id: "ai", label: "Tavolina e AI", kind: "ai", x: 13, y: 1, w: 3, h: 3 },
];

const BASE_SEATS: Seat[] = [
  ...tableSeats("t1", "main", 5, 4, 3),
  ...tableSeats("t2", "main", 9, 4, 2),
  { id: "q0", zoneId: "quiet", tableId: "quiet", x: 1, y: 2 },
  { id: "q1", zoneId: "quiet", tableId: "quiet", x: 1, y: 3 },
  { id: "s0", zoneId: "social", tableId: "social", x: 13, y: 7 },
  { id: "s1", zoneId: "social", tableId: "social", x: 14, y: 7 },
  { id: "b0", zoneId: "break", tableId: "break", x: 1, y: 8 },
  { id: "b1", zoneId: "break", tableId: "break", x: 2, y: 9 },
];

function make(
  key: string,
  name: string,
  tagline: string,
  palette: Environment["palette"],
  suggests: string[]
): Environment {
  return {
    key,
    name,
    tagline,
    cols: COLS,
    rows: ROWS,
    palette,
    suggests,
    zones: BASE_ZONES,
    seats: BASE_SEATS,
  };
}

export const ENVIRONMENTS: Environment[] = [
  make(
    "biblioteka",
    "Biblioteka e Natës",
    "Tavolina të gjata, rafte librash, llamba të ngrohta.",
    {
      floor: "#1b2136",
      floorAlt: "#212842",
      wall: "#141829",
      glow: "#f5b661",
      accent: "#6f8ff7",
      dim: "rgba(8, 11, 22, 0.42)",
    },
    ["rain", "lofi", "keyboard"]
  ),
  make(
    "kafe",
    "Cozy Café",
    "Drita të ngrohta, tavolina të vogla, zhurmë e butë filxhanash.",
    {
      floor: "#33241c",
      floorAlt: "#3d2b21",
      wall: "#241812",
      glow: "#ffb765",
      accent: "#e08b4c",
      dim: "rgba(18, 11, 7, 0.38)",
    },
    ["coffee", "lofi"]
  ),
  make(
    "klasa",
    "Klasa Moderne",
    "Tabelë e bardhë, dritë dite, pa shpërqendrime.",
    {
      floor: "#e8ecf3",
      floorAlt: "#dfe5ef",
      wall: "#cdd6e4",
      glow: "#ffffff",
      accent: "#4b7bec",
      dim: "rgba(30, 41, 59, 0.22)",
    },
    ["none", "whitenoise"]
  ),
  make(
    "tarraca",
    "Rooftop Study",
    "Qyteti poshtë, qielli në mbrëmje, bimë rreth e rrotull.",
    {
      floor: "#2a2f45",
      floorAlt: "#333852",
      wall: "#1d2133",
      glow: "#ffa8a8",
      accent: "#7ee0c0",
      dim: "rgba(12, 15, 28, 0.38)",
    },
    ["forest", "lofi"]
  ),
  make(
    "shi",
    "Rainy Apartment",
    "Apartament i errët, shi në dritare.",
    {
      floor: "#232a38",
      floorAlt: "#2a3243",
      wall: "#181d28",
      glow: "#8fb3d9",
      accent: "#5b8fc9",
      dim: "rgba(10, 14, 20, 0.45)",
    },
    ["rain", "lofi"]
  ),
  make(
    "kasolle",
    "Cabin Fireplace",
    "Kasolle druri, zjarr në oxhak, borë jashtë.",
    {
      floor: "#33251b",
      floorAlt: "#3c2c20",
      wall: "#221811",
      glow: "#ff9a4d",
      accent: "#d97742",
      dim: "rgba(20, 12, 6, 0.4)",
    },
    ["fireplace", "forest"]
  ),
  make(
    "minimal",
    "Minimal Focus Room",
    "Bosh me qëllim. Asgjë që të tërheq vëmendjen.",
    {
      floor: "#f4f4f5",
      floorAlt: "#ebebed",
      wall: "#dededf",
      glow: "#ffffff",
      accent: "#71717a",
      dim: "rgba(24, 24, 27, 0.18)",
    },
    ["none", "whitenoise", "ocean"]
  ),
  make(
    "lab",
    "Digital Lab",
    "Ambient futurist, drita neoni, ekrane.",
    {
      floor: "#1a1630",
      floorAlt: "#221c3d",
      wall: "#120f22",
      glow: "#a98bff",
      accent: "#4cc9f0",
      dim: "rgba(8, 6, 18, 0.45)",
    },
    ["keyboard", "whitenoise", "lofi"]
  ),
];

export const DEFAULT_ENVIRONMENT = "biblioteka";

export function environmentFor(key: string): Environment {
  return (
    ENVIRONMENTS.find((e) => e.key === key) ??
    ENVIRONMENTS.find((e) => e.key === DEFAULT_ENVIRONMENT)!
  );
}

/* ============================================================
   Ambience
   ============================================================ */

export interface Ambience {
  key: string;
  name: string;
  /** Null for "Pa muzikë" — silence is a real choice, not a missing file. */
  file: string | null;
}

/**
 * Ambience is personal by default. A shared room does not mean a shared pair
 * of headphones: one student concentrates to rain and another to nothing, and
 * forcing them to agree helps neither. The host can opt into syncing it.
 */
export const AMBIENCES: Ambience[] = [
  { key: "none", name: "Pa muzikë", file: null },
  { key: "lofi", name: "Lo-Fi Study", file: "/ambience/lofi.mp3" },
  { key: "rain", name: "Shi", file: "/ambience/rain.mp3" },
  { key: "fireplace", name: "Oxhak", file: "/ambience/fireplace.mp3" },
  { key: "coffee", name: "Kafene", file: "/ambience/coffee.mp3" },
  { key: "forest", name: "Pyll", file: "/ambience/forest.mp3" },
  { key: "ocean", name: "Dallgë", file: "/ambience/ocean.mp3" },
  { key: "keyboard", name: "Tastierë", file: "/ambience/keyboard.mp3" },
  { key: "whitenoise", name: "White Noise", file: "/ambience/whitenoise.mp3" },
];

export function ambienceFor(key: string): Ambience {
  return AMBIENCES.find((a) => a.key === key) ?? AMBIENCES[0];
}

/* ============================================================
   Session presets
   ============================================================ */

export interface SessionPreset {
  key: string;
  name: string;
  note: string;
  studyMinutes: number;
  breakMinutes: number;
  rounds: number;
}

export const SESSION_PRESETS: SessionPreset[] = [
  { key: "classic", name: "25 / 5", note: "Pomodoro klasik", studyMinutes: 25, breakMinutes: 5, rounds: 4 },
  { key: "deep", name: "50 / 10", note: "Fokus i thellë", studyMinutes: 50, breakMinutes: 10, rounds: 5 },
  { key: "long", name: "90 / 20", note: "Sesion i gjatë", studyMinutes: 90, breakMinutes: 20, rounds: 3 },
];

/** Total wall-clock length of a configured session, in minutes. */
export function sessionTotalMinutes(
  studyMinutes: number,
  breakMinutes: number,
  rounds: number
): number {
  // The last round has no break after it — the session ends when the work does.
  return studyMinutes * rounds + breakMinutes * Math.max(0, rounds - 1);
}
