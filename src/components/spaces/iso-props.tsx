"use client";

import type { Prop } from "@/lib/spaces/props";
import { FACE, TILE_H, TILE_W, UNIT_H, iso, shade } from "./iso";

/**
 * The furniture, drawn.
 *
 * Every solid object is the same primitive — an isometric box with a lit top,
 * a mid-tone left face and a dark right face — so the whole room agrees about
 * where the light is coming from. Anything more elaborate is that box plus a
 * few details on top.
 *
 * Colours are materials rather than theme tokens: wood stays wood in every
 * room. The environment palette tints the floor and the light, which is what
 * actually makes a café feel different from a library.
 */

const WOOD = "#8a5a36";
const WOOD_DARK = "#5f3d24";
const METAL = "#8d94a6";
const FABRIC = "#5b6b8f";
const LEAF = "#4f9d69";
const LEAF_DARK = "#3b7a51";
const POT = "#b4653f";
const PAPER = "#eae4d6";
const SCREEN = "#7fd4ff";

/** One isometric box: the workhorse every solid prop is built from. */
function Box({
  gx,
  gy,
  w = 1,
  h = 1,
  height,
  color,
  lift = 0,
}: {
  gx: number;
  gy: number;
  w?: number;
  h?: number;
  /** Height in screen units. */
  height: number;
  color: string;
  /** Raises the box off the floor, for table tops and shelves. */
  lift?: number;
}) {
  // The four floor corners of the footprint.
  const back = iso(gx, gy);
  const right = iso(gx + w, gy);
  const front = iso(gx + w, gy + h);
  const left = iso(gx, gy + h);

  const top = -height - lift;
  const base = -lift;

  const p = (pt: { x: number; y: number }, dy: number) =>
    `${pt.x},${pt.y + dy}`;

  return (
    <g>
      {/* top face */}
      <polygon
        points={[p(back, top), p(right, top), p(front, top), p(left, top)].join(" ")}
        fill={shade(color, FACE.top)}
      />
      {/* left face, towards the viewer's lower left */}
      <polygon
        points={[p(left, top), p(front, top), p(front, base), p(left, base)].join(" ")}
        fill={shade(color, FACE.left)}
      />
      {/* right face */}
      <polygon
        points={[p(front, top), p(right, top), p(right, base), p(front, base)].join(" ")}
        fill={shade(color, FACE.right)}
      />
    </g>
  );
}

/** A soft ellipse on the floor, so props do not look like they float. */
function Shadow({ gx, gy, w = 1, h = 1 }: { gx: number; gy: number; w?: number; h?: number }) {
  const c = iso(gx + w / 2, gy + h / 2);
  return (
    <ellipse
      cx={c.x}
      cy={c.y}
      rx={TILE_W * Math.max(w, h) * 0.6}
      ry={TILE_H * Math.max(w, h) * 0.6}
      fill="rgba(0,0,0,0.28)"
    />
  );
}

export function PropShape({ prop, accent }: { prop: Prop; accent: string }) {
  const { kind, x, y } = prop;
  const w = prop.w ?? 1;
  const h = prop.h ?? 1;
  const tint = prop.tint;

  switch (kind) {
    /* ── Floor ─────────────────────────────────────── */

    case "rug": {
      const back = iso(x, y);
      const right = iso(x + w, y);
      const front = iso(x + w, y + h);
      const left = iso(x, y + h);
      return (
        <polygon
          points={[
            `${back.x},${back.y}`,
            `${right.x},${right.y}`,
            `${front.x},${front.y}`,
            `${left.x},${left.y}`,
          ].join(" ")}
          fill={tint ?? "#6a4a3a"}
          opacity={0.55}
        />
      );
    }

    /* ── Tables ────────────────────────────────────── */

    case "desk":
      return (
        <g>
          <Shadow gx={x} gy={y} w={w} h={h} />
          {/* legs, just visible under the top */}
          <Box gx={x + 0.08} gy={y + 0.08} w={0.14} h={0.14} height={UNIT_H * 0.5} color={WOOD_DARK} />
          <Box gx={x + w - 0.22} gy={y + h - 0.22} w={0.14} h={0.14} height={UNIT_H * 0.5} color={WOOD_DARK} />
          <Box gx={x} gy={y} w={w} h={h} height={UNIT_H * 0.18} color={tint ?? WOOD} lift={UNIT_H * 0.5} />
        </g>
      );

    case "deskRound": {
      const c = iso(x + 0.5, y + 0.5);
      return (
        <g>
          <Shadow gx={x} gy={y} />
          <Box gx={x + 0.42} gy={y + 0.42} w={0.16} h={0.16} height={UNIT_H * 0.5} color={WOOD_DARK} />
          <ellipse
            cx={c.x}
            cy={c.y - UNIT_H * 0.58}
            rx={TILE_W * 0.62}
            ry={TILE_H * 0.62}
            fill={shade(tint ?? WOOD, FACE.top)}
          />
          <ellipse
            cx={c.x}
            cy={c.y - UNIT_H * 0.5}
            rx={TILE_W * 0.62}
            ry={TILE_H * 0.62}
            fill={shade(tint ?? WOOD, FACE.right)}
          />
        </g>
      );
    }

    /* ── Seating ───────────────────────────────────── */

    case "chair": {
      // The back sits on the side the chair faces away from.
      const facing = prop.facing ?? "n";
      const backOffset: Record<string, [number, number, number, number]> = {
        n: [0.18, 0.72, 0.64, 0.16],
        s: [0.18, 0.12, 0.64, 0.16],
        e: [0.12, 0.18, 0.16, 0.64],
        w: [0.72, 0.18, 0.16, 0.64],
      };
      const [bx, by, bw, bh] = backOffset[facing];

      return (
        <g>
          <Shadow gx={x + 0.2} gy={y + 0.2} w={0.6} h={0.6} />
          <Box gx={x + 0.18} gy={y + 0.18} w={0.64} h={0.64} height={UNIT_H * 0.34} color={tint ?? FABRIC} />
          <Box gx={x + bx} gy={y + by} w={bw} h={bh} height={UNIT_H * 0.55} color={shade(tint ?? FABRIC, 0.85)} lift={UNIT_H * 0.34} />
        </g>
      );
    }

    case "sofa":
      return (
        <g>
          <Shadow gx={x} gy={y} w={w} h={h} />
          <Box gx={x} gy={y} w={w} h={h * 0.8} height={UNIT_H * 0.38} color={tint ?? FABRIC} />
          {/* back */}
          <Box gx={x} gy={y} w={w} h={0.2} height={UNIT_H * 0.62} color={shade(tint ?? FABRIC, 0.88)} lift={UNIT_H * 0.38} />
          {/* arms */}
          <Box gx={x} gy={y} w={0.18} h={h * 0.8} height={UNIT_H * 0.5} color={shade(tint ?? FABRIC, 0.92)} lift={UNIT_H * 0.38} />
          <Box gx={x + w - 0.18} gy={y} w={0.18} h={h * 0.8} height={UNIT_H * 0.5} color={shade(tint ?? FABRIC, 0.92)} lift={UNIT_H * 0.38} />
        </g>
      );

    case "beanbag": {
      const c = iso(x + 0.5, y + 0.5);
      return (
        <g>
          <Shadow gx={x + 0.15} gy={y + 0.15} w={0.7} h={0.7} />
          <ellipse cx={c.x} cy={c.y - UNIT_H * 0.16} rx={TILE_W * 0.58} ry={TILE_H * 0.7} fill={shade(tint ?? "#6d5b8a", FACE.left)} />
          <ellipse cx={c.x} cy={c.y - UNIT_H * 0.3} rx={TILE_W * 0.5} ry={TILE_H * 0.6} fill={shade(tint ?? "#6d5b8a", FACE.top)} />
        </g>
      );
    }

    /* ── Walls and storage ─────────────────────────── */

    case "shelf":
      return (
        <g>
          <Box gx={x} gy={y} w={w} h={0.34} height={UNIT_H * 2.1} color={tint ?? WOOD_DARK} />
          {/* rows of book spines, which is what makes it read as a bookshelf */}
          {[0.5, 1.05, 1.6].map((level, row) => (
            <g key={level}>
              {[0.08, 0.26, 0.44, 0.62, 0.8].map((slot, i) => {
                const p = iso(x + slot, y + 0.1);
                const hue = ["#c0563f", "#3f6cc0", "#4f9d69", "#c8a24a", "#8a5ab0"][
                  (i + row) % 5
                ];
                return (
                  <rect
                    key={slot}
                    x={p.x - 3}
                    y={p.y - UNIT_H * level - 11}
                    width={6}
                    height={11}
                    rx={1}
                    fill={shade(hue, 0.9)}
                  />
                );
              })}
            </g>
          ))}
        </g>
      );

    case "books": {
      const p = iso(x + 0.5, y + 0.5);
      return (
        <g>
          <Shadow gx={x + 0.3} gy={y + 0.3} w={0.4} h={0.4} />
          <rect x={p.x - 9} y={p.y - 12} width={18} height={5} rx={1} fill="#c0563f" />
          <rect x={p.x - 8} y={p.y - 17} width={16} height={5} rx={1} fill="#3f6cc0" />
          <rect x={p.x - 7} y={p.y - 22} width={14} height={5} rx={1} fill="#c8a24a" />
        </g>
      );
    }

    case "rack":
      return (
        <g>
          <Box gx={x} gy={y} w={w} h={0.4} height={UNIT_H * 2.3} color={tint ?? "#2a2740"} />
          {[0.35, 0.75, 1.15, 1.55, 1.95].map((level) => {
            const p = iso(x + 0.5, y + 0.14);
            return (
              <rect
                key={level}
                x={p.x - 12}
                y={p.y - UNIT_H * level}
                width={24}
                height={3}
                rx={1.5}
                fill={SCREEN}
                opacity={0.65}
              />
            );
          })}
        </g>
      );

    /* ── Fixtures ──────────────────────────────────── */

    case "counter":
      return (
        <g>
          <Box gx={x} gy={y} w={w} h={0.55} height={UNIT_H * 1.1} color={tint ?? WOOD_DARK} />
          <Box gx={x - 0.05} gy={y - 0.05} w={w + 0.1} h={0.65} height={UNIT_H * 0.12} color="#2f2620" lift={UNIT_H * 1.1} />
          {/* a coffee machine, so it is obviously a café counter */}
          <Box gx={x + w - 1.1} gy={y + 0.05} w={0.5} h={0.4} height={UNIT_H * 0.7} color={METAL} lift={UNIT_H * 1.22} />
        </g>
      );

    case "board":
      return (
        <g>
          <Box gx={x} gy={y} w={w} h={0.18} height={UNIT_H * 1.9} color={tint ?? "#d7dbe3"} />
          {[0.6, 1.0, 1.4].map((level, i) => {
            const p = iso(x + 0.35, y + 0.05);
            return (
              <rect
                key={level}
                x={p.x}
                y={p.y - UNIT_H * level}
                width={34 - i * 9}
                height={2.5}
                rx={1.25}
                fill={tint ? SCREEN : "#8f9aab"}
                opacity={0.8}
              />
            );
          })}
        </g>
      );

    case "window": {
      const back = iso(x, y);
      const right = iso(x + w, y);
      const top = UNIT_H * 2.4;
      return (
        <g>
          <polygon
            points={[
              `${back.x},${back.y - top}`,
              `${right.x},${right.y - top}`,
              `${right.x},${right.y - UNIT_H * 0.5}`,
              `${back.x},${back.y - UNIT_H * 0.5}`,
            ].join(" ")}
            fill={accent}
            opacity={0.3}
          />
          <polygon
            points={[
              `${back.x},${back.y - top}`,
              `${right.x},${right.y - top}`,
              `${right.x},${right.y - UNIT_H * 0.5}`,
              `${back.x},${back.y - UNIT_H * 0.5}`,
            ].join(" ")}
            fill="none"
            stroke={shade(WOOD_DARK, 1.1)}
            strokeWidth={2.5}
          />
        </g>
      );
    }

    case "railing": {
      const back = iso(x, y);
      const right = iso(x + w, y);
      return (
        <g>
          <line
            x1={back.x}
            y1={back.y - UNIT_H * 1.1}
            x2={right.x}
            y2={right.y - UNIT_H * 1.1}
            stroke={METAL}
            strokeWidth={3}
          />
          {Array.from({ length: w }, (_, i) => {
            const p = iso(x + i + 0.5, y);
            return (
              <line
                key={i}
                x1={p.x}
                y1={p.y}
                x2={p.x}
                y2={p.y - UNIT_H * 1.1}
                stroke={METAL}
                strokeWidth={1.6}
                opacity={0.8}
              />
            );
          })}
        </g>
      );
    }

    case "fireplace": {
      const c = iso(x + w / 2, y + 0.2);
      return (
        <g>
          <Box gx={x} gy={y} w={w} h={0.5} height={UNIT_H * 2.2} color="#5a4a42" />
          {/* the opening, and the fire inside it */}
          <rect
            x={c.x - 20}
            y={c.y - UNIT_H * 1.5}
            width={40}
            height={26}
            rx={4}
            fill="#1a120c"
          />
          <ellipse cx={c.x} cy={c.y - UNIT_H * 0.7} rx={15} ry={10} fill="#ff8a3d" opacity={0.95} />
          <ellipse cx={c.x} cy={c.y - UNIT_H * 0.75} rx={8} ry={6} fill="#ffd27a" />
        </g>
      );
    }

    /* ── Lights and detail ─────────────────────────── */

    case "lamp": {
      const p = iso(x + 0.5, y + 0.5);
      return (
        <g>
          <rect x={p.x - 1.5} y={p.y - UNIT_H * 1.05} width={3} height={UNIT_H * 0.45} fill={METAL} />
          <polygon
            points={`${p.x - 9},${p.y - UNIT_H * 1.05} ${p.x + 9},${p.y - UNIT_H * 1.05} ${p.x + 6},${p.y - UNIT_H * 1.45} ${p.x - 6},${p.y - UNIT_H * 1.45}`}
            fill="#e8c979"
          />
        </g>
      );
    }

    case "floorLamp": {
      const p = iso(x + 0.5, y + 0.5);
      return (
        <g>
          <Shadow gx={x + 0.35} gy={y + 0.35} w={0.3} h={0.3} />
          <rect x={p.x - 1.5} y={p.y - UNIT_H * 2.4} width={3} height={UNIT_H * 2.4} fill={METAL} />
          <polygon
            points={`${p.x - 11},${p.y - UNIT_H * 2.4} ${p.x + 11},${p.y - UNIT_H * 2.4} ${p.x + 7},${p.y - UNIT_H * 2.95} ${p.x - 7},${p.y - UNIT_H * 2.95}`}
            fill="#e8c979"
          />
        </g>
      );
    }

    case "plant":
    case "plantTall": {
      const tall = kind === "plantTall";
      const p = iso(x + 0.5, y + 0.5);
      const potH = tall ? UNIT_H * 0.6 : UNIT_H * 0.45;

      return (
        <g>
          <Shadow gx={x + 0.3} gy={y + 0.3} w={0.4} h={0.4} />
          <Box gx={x + 0.32} gy={y + 0.32} w={0.36} h={0.36} height={potH} color={POT} />
          {/* foliage as overlapping blobs, which reads better than a texture */}
          <circle cx={p.x} cy={p.y - potH - (tall ? 26 : 14)} r={tall ? 15 : 11} fill={LEAF} />
          <circle cx={p.x - 9} cy={p.y - potH - (tall ? 18 : 9)} r={tall ? 11 : 8} fill={LEAF_DARK} />
          <circle cx={p.x + 9} cy={p.y - potH - (tall ? 20 : 10)} r={tall ? 10 : 7} fill={LEAF_DARK} />
          {tall && <circle cx={p.x + 2} cy={p.y - potH - 40} r={9} fill={LEAF} />}
        </g>
      );
    }

    case "laptop": {
      const p = iso(x + 0.5, y + 0.5);
      const top = p.y - UNIT_H * 0.72;
      return (
        <g>
          <polygon
            points={`${p.x - 10},${top} ${p.x},${top + 5} ${p.x + 10},${top} ${p.x},${top - 5}`}
            fill="#3a3f4b"
          />
          <polygon
            points={`${p.x - 9},${top - 1} ${p.x - 1},${top - 5} ${p.x - 1},${top - 16} ${p.x - 9},${top - 12}`}
            fill={SCREEN}
            opacity={0.85}
          />
        </g>
      );
    }

    case "mug": {
      const p = iso(x + 0.5, y + 0.5);
      const top = p.y - UNIT_H * 0.78;
      return (
        <g>
          <ellipse cx={p.x + 12} cy={top} rx={4} ry={2.4} fill="#e8e2d8" />
          <rect x={p.x + 8} y={top - 6} width={8} height={6} fill="#f3efe7" />
          <ellipse cx={p.x + 12} cy={top - 6} rx={4} ry={2.4} fill="#6b4a33" />
        </g>
      );
    }

    case "rangeBox":
    default:
      return (
        <g>
          <Shadow gx={x} gy={y} w={w} h={h} />
          <Box gx={x} gy={y} w={w} h={h} height={UNIT_H} color={tint ?? PAPER} />
        </g>
      );
  }
}
