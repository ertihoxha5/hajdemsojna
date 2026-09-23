"use client";

import {
  HAIR_COLORS,
  SHIRT_COLORS,
  SHOE_COLORS,
  SKIN_TONES,
  TROUSER_COLORS,
  type Avatar,
} from "@/lib/avatar";

/**
 * One character, drawn as SVG.
 *
 * Every combination comes out of this one component, so a room full of people
 * costs nothing to load and each figure stays legible at 28 pixels — which is
 * the size that actually matters, since that is how they appear on the map.
 *
 * Deliberately stylised: rounded shapes and flat colour, no attempt at a
 * likeness. A cute figure reads instantly at a glance and sidesteps the
 * uncanny middle ground where a semi-realistic face just looks wrong.
 */

const BODY_WIDTH = [9, 11, 13];

export function AvatarFigure({
  avatar,
  size = 40,
  sitting = false,
  className,
}: {
  avatar: Avatar;
  size?: number;
  sitting?: boolean;
  className?: string;
}) {
  const skin = SKIN_TONES[avatar.skin] ?? SKIN_TONES[0];
  const hair = HAIR_COLORS[avatar.hairColor] ?? HAIR_COLORS[0];
  const shirt = SHIRT_COLORS[avatar.shirt] ?? SHIRT_COLORS[0];
  const trousers = TROUSER_COLORS[avatar.trousers] ?? TROUSER_COLORS[0];
  const shoes = SHOE_COLORS[avatar.shoes] ?? SHOE_COLORS[0];

  const w = BODY_WIDTH[avatar.body] ?? BODY_WIDTH[1];
  const half = w / 2;

  // Sitting shortens the legs rather than re-drawing the figure, which keeps
  // the head at a believable height relative to a chair.
  const legLength = sitting ? 3 : 7;
  const legTop = 25;

  return (
    <svg
      viewBox="0 0 32 40"
      width={size}
      height={size * 1.25}
      className={className}
      aria-hidden="true"
      shapeRendering="geometricPrecision"
    >
      {/* legs */}
      <rect
        x={16 - half + 1}
        y={legTop}
        width={3}
        height={legLength}
        rx={1.5}
        fill={trousers}
      />
      <rect
        x={16 + half - 4}
        y={legTop}
        width={3}
        height={legLength}
        rx={1.5}
        fill={trousers}
      />

      {/* shoes */}
      <rect
        x={16 - half}
        y={legTop + legLength}
        width={4.5}
        height={2.5}
        rx={1.25}
        fill={shoes}
      />
      <rect
        x={16 + half - 4.5}
        y={legTop + legLength}
        width={4.5}
        height={2.5}
        rx={1.25}
        fill={shoes}
      />

      {/* backpack, behind the torso */}
      {avatar.backpack > 0 && (
        <rect
          x={16 - half - 2}
          y={15}
          width={3}
          height={8}
          rx={1.5}
          fill={hair}
          opacity={0.75}
        />
      )}

      {/* torso */}
      <rect x={16 - half} y={14} width={w} height={12} rx={4} fill={shirt} />

      {/* arms */}
      <rect x={16 - half - 1.5} y={16} width={2.5} height={8} rx={1.25} fill={shirt} />
      <rect x={16 + half - 1} y={16} width={2.5} height={8} rx={1.25} fill={shirt} />
      <circle cx={16 - half - 0.25} cy={24.5} r={1.4} fill={skin} />
      <circle cx={16 + half + 0.25} cy={24.5} r={1.4} fill={skin} />

      {/* neck and head */}
      <rect x={14.5} y={12} width={3} height={3} fill={skin} />
      <circle cx={16} cy={8.5} r={5.5} fill={skin} />

      {/* hair: eight silhouettes over the same head */}
      <Hair variant={avatar.hair} color={hair} />

      {/* face — two dots, nothing more. A mouth at this size reads as a smudge. */}
      <circle cx={14} cy={9} r={0.7} fill="#2b2320" />
      <circle cx={18} cy={9} r={0.7} fill="#2b2320" />

      <Accessory variant={avatar.accessory} />
    </svg>
  );
}

function Hair({ variant, color }: { variant: number; color: string }) {
  switch (variant) {
    case 0: // short
      return <path d="M10.5 7.5a5.5 5.5 0 0 1 11 0v-.6a5.5 5.5 0 0 0-11 0Z" fill={color} />;
    case 1: // buzz
      return <path d="M10.5 8a5.5 5.5 0 0 1 11 0Z" fill={color} />;
    case 2: // side part
      return (
        <path
          d="M10.5 8a5.5 5.5 0 0 1 11 0c0-2-2-3.5-4-3.5-1.5 0-2 1-3.5 1S11 6 10.5 8Z"
          fill={color}
        />
      );
    case 3: // bob
      return (
        <path
          d="M10 9c0-4 2.5-6 6-6s6 2 6 6v3h-1.6V8.5a4.4 4.4 0 0 0-8.8 0V12H10Z"
          fill={color}
        />
      );
    case 4: // long
      return (
        <path
          d="M9.8 9c0-4 2.7-6 6.2-6s6.2 2 6.2 6v8h-1.8V8.6a4.4 4.4 0 0 0-8.8 0V17H9.8Z"
          fill={color}
        />
      );
    case 5: // curly
      return (
        <g fill={color}>
          <circle cx={12} cy={5.5} r={2.4} />
          <circle cx={16} cy={4.2} r={2.6} />
          <circle cx={20} cy={5.5} r={2.4} />
        </g>
      );
    case 6: // bun
      return (
        <g fill={color}>
          <path d="M10.5 8a5.5 5.5 0 0 1 11 0Z" />
          <circle cx={16} cy={2.4} r={2.1} />
        </g>
      );
    default: // ponytail
      return (
        <g fill={color}>
          <path d="M10.5 8a5.5 5.5 0 0 1 11 0Z" />
          <rect x={20.5} y={6} width={2.4} height={7} rx={1.2} />
        </g>
      );
  }
}

function Accessory({ variant }: { variant: number }) {
  switch (variant) {
    case 1: // glasses
      return (
        <g fill="none" stroke="#2b2320" strokeWidth={0.6}>
          <circle cx={14} cy={9} r={1.9} />
          <circle cx={18} cy={9} r={1.9} />
          <path d="M15.9 9h0.2" />
        </g>
      );
    case 2: // headphones
      return (
        <g fill="#2b2320">
          <path
            d="M10 9V8a6 6 0 0 1 12 0v1"
            fill="none"
            stroke="#2b2320"
            strokeWidth={1.1}
          />
          <rect x={8.9} y={8.4} width={2.2} height={3.6} rx={1.1} />
          <rect x={20.9} y={8.4} width={2.2} height={3.6} rx={1.1} />
        </g>
      );
    case 3: // cap
      return (
        <g fill="#33415a">
          <path d="M10.4 6.6a5.6 5.6 0 0 1 11.2 0Z" />
          <rect x={16} y={5.9} width={7} height={1.4} rx={0.7} />
        </g>
      );
    case 4: // scarf
      return <rect x={12.5} y={12.4} width={7} height={2.2} rx={1.1} fill="#b5543f" />;
    default:
      return null;
  }
}
