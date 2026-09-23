"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Environment, Seat } from "@/lib/spaces/environments";
import { propsFor, type Prop } from "@/lib/spaces/props";
import { ACTIVITY_BADGE, ACTIVITY_LABEL, type Activity } from "@/lib/spaces/presence";
import type { Avatar } from "@/lib/avatar";
import { AvatarFigure } from "./avatar-figure";
import {
  TILE_H,
  TILE_W,
  UNIT_H,
  depth,
  iso,
  sceneBounds,
  shade,
  tilePoints,
  unIso,
} from "./iso";
import { PropShape } from "./iso-props";
import { cx } from "@/components/ui";

/**
 * The shared room, drawn as an isometric scene.
 *
 * Everything — floor, furniture, people — goes into one list, is sorted by
 * how far back it sits, and is painted in that order. That is what makes a
 * student standing in front of a bookshelf actually occlude it, which is the
 * difference between a room and a diagram.
 *
 * The scene is one SVG with a computed viewBox, so it scales to any width
 * without a single hard-coded pixel size and stays crisp on every screen.
 *
 * Movement is optimistic: the avatar steps the instant a key is pressed and
 * the server hears about it afterwards.
 */

export interface MapMember {
  userId: string;
  name: string;
  role: "owner" | "cohost" | "member";
  avatar: Avatar;
  x: number;
  y: number;
  seatId: string | null;
  activity: Activity;
  studySubject: string;
  studyTopic: string;
  studyGoal: string;
  goalDone: boolean;
  focusSeconds: number;
  focusPoints: number;
  isMe: boolean;
}

interface Props {
  environment: Environment;
  members: MapMember[];
  meId: string;
  focusMode: boolean;
  reducedMotion: boolean;
  onMove: (x: number, y: number, seatId: string | null) => void;
}

/** One thing to paint, with the depth that decides when. */
interface Drawable {
  key: string;
  z: number;
  node: React.ReactNode;
}

export function StudyMap({
  environment,
  members,
  meId,
  focusMode,
  reducedMotion,
  onMove,
}: Props) {
  const me = members.find((m) => m.userId === meId);
  const [hovered, setHovered] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const props = useMemo(() => propsFor(environment.key), [environment.key]);
  const bounds = useMemo(
    () => sceneBounds(environment.cols, environment.rows),
    [environment.cols, environment.rows]
  );

  const occupiedSeats = useMemo(
    () => new Set(members.map((m) => m.seatId).filter(Boolean) as string[]),
    [members]
  );

  /** Cells a prop stands on, so nobody walks through a bookshelf. */
  const blocked = useMemo(() => {
    const set = new Set<string>();
    for (const p of props) {
      if (p.kind === "rug" || p.kind === "window" || p.kind === "railing") continue;
      const w = p.w ?? 1;
      const h = p.h ?? 1;
      for (let dx = 0; dx < Math.ceil(w); dx++) {
        for (let dy = 0; dy < Math.ceil(h); dy++) {
          set.add(`${p.x + dx},${p.y + dy}`);
        }
      }
    }
    // Seats are sat on, not blocked — sitting is how you reach them.
    for (const seat of environment.seats) set.delete(`${seat.x},${seat.y}`);
    return set;
  }, [environment.seats, props]);

  const canStand = useCallback(
    (x: number, y: number) =>
      x >= 0 &&
      y >= 0 &&
      x < environment.cols &&
      y < environment.rows &&
      !blocked.has(`${x},${y}`),
    [blocked, environment.cols, environment.rows]
  );

  const step = useCallback(
    (dx: number, dy: number) => {
      if (!me) return;
      const x = me.x + dx;
      const y = me.y + dy;
      if (!canStand(x, y)) return;
      onMove(x, y, null);
    },
    [canStand, me, onMove]
  );

  // Keyboard movement, ignored while typing so WASD in chat does not walk.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)
      ) {
        return;
      }

      const moves: Record<string, [number, number]> = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        w: [0, -1],
        s: [0, 1],
        a: [-1, 0],
        d: [1, 0],
      };

      const move = moves[event.key] ?? moves[event.key.toLowerCase()];
      if (!move) return;

      event.preventDefault();
      step(move[0], move[1]);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  /** Click-to-move: screen point back through the projection to a cell. */
  const onBoardClick = (event: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    // Into viewBox units first, then out of the isometric projection.
    const vx = ((event.clientX - rect.left) / rect.width) * bounds.width + bounds.x;
    const vy = ((event.clientY - rect.top) / rect.height) * bounds.height + bounds.y;

    const cell = unIso(vx, vy);
    if (canStand(cell.x, cell.y)) onMove(cell.x, cell.y, null);
  };

  const sitAt = (seat: Seat) => {
    if (occupiedSeats.has(seat.id) && me?.seatId !== seat.id) return;
    onMove(seat.x, seat.y, seat.id);
  };

  const { palette } = environment;

  /* ── Build the paint list ──────────────────────────── */

  const drawables: Drawable[] = [];

  // Furniture. Layer 1 keeps a prop behind an avatar on the same cell.
  props.forEach((prop: Prop, i) => {
    drawables.push({
      key: `prop-${i}`,
      z: depth(prop.x + (prop.w ?? 1) / 2, prop.y + (prop.h ?? 1) / 2, prop.kind === "rug" ? -5 : 1),
      node: <PropShape prop={prop} accent={palette.accent} />,
    });
  });

  // Seats, as clickable pads on the floor.
  environment.seats.forEach((seat) => {
    const taken = occupiedSeats.has(seat.id);
    const mine = me?.seatId === seat.id;
    const c = iso(seat.x + 0.5, seat.y + 0.5);

    drawables.push({
      key: `seat-${seat.id}`,
      z: depth(seat.x, seat.y, -3),
      node: (
        <g
          role="button"
          tabIndex={taken && !mine ? -1 : 0}
          aria-label={taken && !mine ? `Karrige e zënë` : `Ulu këtu`}
          onClick={(e) => {
            e.stopPropagation();
            sitAt(seat);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              sitAt(seat);
            }
          }}
          style={{ cursor: taken && !mine ? "not-allowed" : "pointer" }}
        >
          <ellipse
            cx={c.x}
            cy={c.y}
            rx={TILE_W * 0.5}
            ry={TILE_H * 0.5}
            fill={mine ? palette.accent : "#ffffff"}
            opacity={mine ? 0.5 : taken ? 0.08 : 0.16}
          />
        </g>
      ),
    });
  });

  // People.
  members.forEach((member) => {
    const c = iso(member.x + 0.5, member.y + 0.5);
    const badge = ACTIVITY_BADGE[member.activity];
    const sitting = Boolean(member.seatId);

    drawables.push({
      key: `member-${member.userId}`,
      z: depth(member.x, member.y, 5),
      node: (
        <g
          onMouseEnter={() => setHovered(member.userId)}
          onMouseLeave={() => setHovered(null)}
          style={{ cursor: "pointer" }}
        >
          <ellipse
            cx={c.x}
            cy={c.y}
            rx={TILE_W * 0.34}
            ry={TILE_H * 0.34}
            fill="rgba(0,0,0,0.3)"
          />

          {/* Focus bubble — visual only, and still when motion is reduced. */}
          {focusMode && member.activity === "active" && (
            <ellipse
              cx={c.x}
              cy={c.y - UNIT_H * 0.9}
              rx={TILE_W * 0.72}
              ry={TILE_H * 1.5}
              fill={palette.accent}
              opacity={0.14}
              className={reducedMotion ? undefined : "animate-pulse"}
            />
          )}

          <g transform={`translate(${c.x - 15}, ${c.y - (sitting ? 40 : 46)})`}>
            <AvatarFigure avatar={member.avatar} size={30} sitting={sitting} />
          </g>

          {/* Name tag. A glyph as well as colour, so status is never colour alone. */}
          <g transform={`translate(${c.x}, ${c.y - (sitting ? 48 : 54)})`}>
            <rect
              x={-Math.max(24, member.name.length * 3.4 + 12)}
              y={-11}
              width={Math.max(48, member.name.length * 6.8 + 24)}
              height={15}
              rx={7.5}
              fill={member.isMe ? palette.accent : "rgba(0,0,0,0.55)"}
            />
            <text
              x={0}
              y={0}
              textAnchor="middle"
              fontSize={9.5}
              fontWeight={600}
              fill="#ffffff"
            >
              {badge.glyph} {member.isMe ? "Ti" : member.name}
            </text>
          </g>
        </g>
      ),
    });
  });

  drawables.sort((a, b) => a.z - b.z);

  const hoveredMember = members.find((m) => m.userId === hovered);

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        role="application"
        aria-label={`Harta e hapësirës: ${environment.name}`}
        viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
        onClick={onBoardClick}
        className="w-full select-none rounded-[16px] border border-line"
        style={{ background: palette.wall, aspectRatio: `${bounds.width} / ${bounds.height}` }}
      >
        <defs>
          {/* The room's own light, pooled in the middle. */}
          <radialGradient id={`glow-${environment.key}`} cx="50%" cy="38%" r="62%">
            <stop offset="0%" stopColor={palette.glow} stopOpacity={0.4} />
            <stop offset="100%" stopColor={palette.glow} stopOpacity={0} />
          </radialGradient>
          <radialGradient id={`vignette-${environment.key}`} cx="50%" cy="45%" r="72%">
            <stop offset="55%" stopColor="#000000" stopOpacity={0} />
            <stop offset="100%" stopColor="#000000" stopOpacity={0.45} />
          </radialGradient>
        </defs>

        {/* ── Floor ─────────────────────────────────── */}
        <g>
          {Array.from({ length: environment.rows }, (_, gy) =>
            Array.from({ length: environment.cols }, (_, gx) => (
              <polygon
                key={`${gx}-${gy}`}
                points={tilePoints(gx, gy)}
                fill={(gx + gy) % 2 === 0 ? palette.floor : palette.floorAlt}
                stroke={shade(palette.floor, 0.86)}
                strokeWidth={0.5}
              />
            ))
          )}
        </g>

        {/* Zone tints, read as rugs and markings on the floor. */}
        {environment.zones.map((zone) => {
          const a = iso(zone.x, zone.y);
          const b = iso(zone.x + zone.w, zone.y);
          const c = iso(zone.x + zone.w, zone.y + zone.h);
          const d = iso(zone.x, zone.y + zone.h);
          const tint =
            zone.kind === "quiet"
              ? "#7aa2ff"
              : zone.kind === "social"
                ? "#ffab7a"
                : zone.kind === "break"
                  ? "#7ad9b0"
                  : zone.kind === "ai"
                    ? "#b48cff"
                    : palette.accent;

          return (
            <polygon
              key={zone.id}
              points={`${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}`}
              fill={tint}
              opacity={0.07}
            />
          );
        })}

        {/* Warm pool of light over the floor, under everything solid. */}
        <rect
          x={bounds.x}
          y={bounds.y}
          width={bounds.width}
          height={bounds.height}
          fill={`url(#glow-${environment.key})`}
          pointerEvents="none"
        />

        {/* Each lamp and the fireplace pool light on the floor around them,
            so the sources in the room visibly do something. */}
        {props
          .filter((p) => p.light)
          .map((p, i) => {
            const c = iso(p.x + (p.w ?? 1) / 2, p.y + (p.h ?? 1) / 2);
            return (
              <ellipse
                key={`light-${i}`}
                cx={c.x}
                cy={c.y}
                rx={TILE_W * 2.4}
                ry={TILE_H * 2.4}
                fill={palette.glow}
                opacity={0.18}
                pointerEvents="none"
              />
            );
          })}

        {/* ── Everything solid, back to front ───────── */}
        {drawables.map((d) => (
          <g key={d.key}>{d.node}</g>
        ))}

        {/* Zone labels, above the furniture so they stay readable. */}
        {environment.zones.map((zone) => {
          const c = iso(zone.x + zone.w / 2, zone.y + zone.h / 2);
          return (
            <text
              key={`label-${zone.id}`}
              x={c.x}
              y={c.y}
              textAnchor="middle"
              fontSize={8}
              fontWeight={600}
              letterSpacing={0.6}
              fill={palette.accent}
              opacity={0.5}
              pointerEvents="none"
            >
              {zone.label.toUpperCase()}
            </text>
          );
        })}

        <rect
          x={bounds.x}
          y={bounds.y}
          width={bounds.width}
          height={bounds.height}
          fill={`url(#vignette-${environment.key})`}
          pointerEvents="none"
        />

        {/* Focus dimming, over the whole room. */}
        <rect
          x={bounds.x}
          y={bounds.y}
          width={bounds.width}
          height={bounds.height}
          fill={palette.dim}
          opacity={focusMode ? 1 : 0}
          pointerEvents="none"
          className={cx(!reducedMotion && "transition-opacity duration-700")}
        />
      </svg>

      {/* The hover card lives in HTML, where text wrapping is free. */}
      {hoveredMember && (
        <HoverCard member={hoveredMember} environment={environment} bounds={bounds} />
      )}
    </div>
  );
}

function HoverCard({
  member,
  environment,
  bounds,
}: {
  member: MapMember;
  environment: Environment;
  bounds: { x: number; y: number; width: number; height: number };
}) {
  const c = iso(member.x + 0.5, member.y + 0.5);

  // Position as a percentage of the scene, so it tracks the SVG at any size.
  const left = ((c.x - bounds.x) / bounds.width) * 100;
  const top = ((c.y - bounds.y) / bounds.height) * 100;

  return (
    <div
      className="pointer-events-none absolute z-30 w-48 -translate-x-1/2 -translate-y-full rounded-[10px] border border-line bg-surface p-2.5 shadow-lg"
      style={{ left: `${left}%`, top: `calc(${top}% - 52px)` }}
    >
      <p className="text-[13px] font-medium text-ink">
        {member.isMe ? "Ti" : member.name}
        {member.role !== "member" && (
          <span className="ml-1.5 text-[11px] font-normal text-brand">
            {member.role === "owner" ? "host" : "co-host"}
          </span>
        )}
      </p>
      <p className="text-[12px] text-muted">{ACTIVITY_LABEL[member.activity]}</p>

      {member.studySubject && (
        <p className="mt-1 text-[12px] text-ink">{member.studySubject}</p>
      )}
      {member.studyTopic && (
        <p className="text-[12px] text-muted">{member.studyTopic}</p>
      )}
      {member.studyGoal && (
        <p className="mt-1 text-[11.5px] italic leading-snug text-faint">
          “{member.studyGoal}”
        </p>
      )}

      <p className="num mt-1.5 text-[12px] text-faint">
        Fokus {Math.floor(member.focusSeconds / 60)} min
        {member.seatId ? ` · ${environment.name}` : ""}
      </p>
    </div>
  );
}
