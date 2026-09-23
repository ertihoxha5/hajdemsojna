import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  TILE_H,
  TILE_W,
  depth,
  iso,
  sceneBounds,
  shade,
  tilePoints,
  unIso,
} from "@/components/spaces/iso.ts";
import { PROPS, propsFor, type Prop } from "@/lib/spaces/props.ts";
import { ENVIRONMENTS } from "@/lib/spaces/environments.ts";

/**
 * The map is geometry, so it can be checked without a browser: does the
 * projection round-trip, does every seat have something to sit on, and can a
 * student actually walk from one side of the room to the other.
 *
 * That last one is the test worth having. A layout where a chair is walled in
 * by a bookshelf looks fine in review and is infuriating to use.
 */

/** The prop kinds a person can occupy. */
const SITTABLE = new Set(["chair", "sofa", "beanbag"]);

/** Cells a prop covers. */
function cells(p: Prop): string[] {
  const out: string[] = [];
  for (let dx = 0; dx < Math.ceil(p.w ?? 1); dx++) {
    for (let dy = 0; dy < Math.ceil(p.h ?? 1); dy++) {
      out.push(`${p.x + dx},${p.y + dy}`);
    }
  }
  return out;
}

/** Mirrors the blocking rule in study-map.tsx. */
function blockedCells(props: Prop[], seats: { x: number; y: number }[]) {
  const set = new Set<string>();
  for (const p of props) {
    if (p.kind === "rug" || p.kind === "window" || p.kind === "railing") continue;
    for (const c of cells(p)) set.add(c);
  }
  for (const s of seats) set.delete(`${s.x},${s.y}`);
  return set;
}

describe("isometric projection", () => {
  test("a cell centre round-trips back to the same cell", () => {
    for (let x = 0; x < 16; x++) {
      for (let y = 0; y < 11; y++) {
        const p = iso(x + 0.5, y + 0.5);
        const back = unIso(p.x, p.y);
        // The centre sits on a corner between cells, so either side is right.
        assert.ok(
          back.x === x || back.x === x + 1,
          `x ${x} came back as ${back.x}`
        );
        assert.ok(
          back.y === y || back.y === y + 1,
          `y ${y} came back as ${back.y}`
        );
      }
    }
  });

  test("the grid runs back-left to front-right", () => {
    // Moving +x goes right and down; moving +y goes left and down.
    const origin = iso(0, 0);
    assert.ok(iso(1, 0).x > origin.x, "+x should move right");
    assert.ok(iso(1, 0).y > origin.y, "+x should move down");
    assert.ok(iso(0, 1).x < origin.x, "+y should move left");
    assert.ok(iso(0, 1).y > origin.y, "+y should move down");
  });

  test("tiles are 2:1 diamonds", () => {
    assert.equal(TILE_W / TILE_H, 2);
  });

  test("a tile is a four-corner diamond", () => {
    const pts = tilePoints(3, 4).split(" ");
    assert.equal(pts.length, 4);
    for (const p of pts) {
      const [x, y] = p.split(",").map(Number);
      assert.ok(Number.isFinite(x) && Number.isFinite(y), `bad point ${p}`);
    }
  });

  test("the scene bounds contain every tile", () => {
    const b = sceneBounds(16, 11);

    for (const [x, y] of [
      [0, 0],
      [15, 0],
      [0, 10],
      [15, 10],
    ]) {
      const p = iso(x, y);
      assert.ok(p.x >= b.x && p.x <= b.x + b.width, `cell ${x},${y} outside x`);
      assert.ok(p.y >= b.y && p.y <= b.y + b.height, `cell ${x},${y} outside y`);
    }
  });

  test("bounds leave headroom for tall furniture", () => {
    const b = sceneBounds(16, 11);
    // The top of the box must sit above the back row, or shelves get clipped.
    assert.ok(b.y < iso(0, 0).y - 40, "not enough headroom above the back wall");
  });
});

describe("depth sorting", () => {
  test("things further back are painted first", () => {
    assert.ok(depth(0, 0) < depth(5, 5));
    assert.ok(depth(2, 3) < depth(3, 3));
  });

  test("an avatar outranks a prop on the same cell", () => {
    const prop = depth(4, 4, 1);
    const avatar = depth(4, 4, 5);
    assert.ok(avatar > prop, "the avatar would be hidden behind the desk");
  });

  test("a rug stays under everything on its cell", () => {
    assert.ok(depth(4, 4, -5) < depth(4, 4, 1));
  });
});

describe("shade", () => {
  test("darkens towards black without leaving the range", () => {
    assert.equal(shade("#ffffff", 1), "#ffffff");
    assert.equal(shade("#ffffff", 0.5), "#808080");
    assert.equal(shade("#000000", 0.5), "#000000");
  });

  test("handles short hex and never returns a malformed colour", () => {
    for (const input of ["#fff", "#8a5a36", "abc"]) {
      const out = shade(input, 0.7);
      assert.match(out, /^#[0-9a-f]{6}$/, `${input} gave ${out}`);
    }
  });

  test("clamps rather than overflowing on a brightening factor", () => {
    assert.match(shade("#ffffff", 5), /^#ffffff$/);
  });
});

describe("room layouts", () => {
  test("every environment has furniture", () => {
    for (const env of ENVIRONMENTS) {
      const props = propsFor(env.key);
      assert.ok(props.length > 5, `${env.key} has only ${props.length} props`);
    }
  });

  test("every seat has something to sit on", () => {
    for (const env of ENVIRONMENTS) {
      const props = propsFor(env.key);

      const sittable = new Set<string>();
      for (const p of props) {
        if (SITTABLE.has(p.kind)) for (const c of cells(p)) sittable.add(c);
      }

      for (const seat of env.seats) {
        assert.ok(
          sittable.has(`${seat.x},${seat.y}`),
          `${env.key}: seat ${seat.id} at ${seat.x},${seat.y} has no furniture`
        );
      }
    }
  });

  test("no prop stands outside the room", () => {
    for (const env of ENVIRONMENTS) {
      for (const p of propsFor(env.key)) {
        assert.ok(p.x >= 0 && p.y >= 0, `${env.key}: ${p.kind} has a negative cell`);
        assert.ok(
          p.x + (p.w ?? 1) <= env.cols,
          `${env.key}: ${p.kind} runs past the right wall`
        );
        assert.ok(
          p.y + (p.h ?? 1) <= env.rows,
          `${env.key}: ${p.kind} runs past the front wall`
        );
      }
    }
  });

  test("a table never sits on a seat cell", () => {
    for (const env of ENVIRONMENTS) {
      const seats = new Set(env.seats.map((s) => `${s.x},${s.y}`));

      for (const p of propsFor(env.key)) {
        if (p.kind !== "desk" && p.kind !== "deskRound") continue;
        for (const c of cells(p)) {
          assert.ok(
            !seats.has(c),
            `${env.key}: a ${p.kind} stands on seat cell ${c}`
          );
        }
      }
    }
  });

  test("every seat is reachable from the spawn point", () => {
    // The real usability check: flood-fill the walkable floor from where a
    // student appears, and confirm every seat is in it.
    for (const env of ENVIRONMENTS) {
      const props = propsFor(env.key);
      const blocked = blockedCells(props, env.seats);

      const start = { x: Math.floor(env.cols / 2), y: env.rows - 2 };
      assert.ok(
        !blocked.has(`${start.x},${start.y}`),
        `${env.key}: the spawn point is inside furniture`
      );

      const seen = new Set<string>([`${start.x},${start.y}`]);
      const queue = [start];

      while (queue.length) {
        const cell = queue.shift()!;
        for (const [dx, dy] of [
          [0, -1],
          [0, 1],
          [-1, 0],
          [1, 0],
        ]) {
          const nx = cell.x + dx;
          const ny = cell.y + dy;
          const key = `${nx},${ny}`;

          if (nx < 0 || ny < 0 || nx >= env.cols || ny >= env.rows) continue;
          if (blocked.has(key) || seen.has(key)) continue;

          seen.add(key);
          queue.push({ x: nx, y: ny });
        }
      }

      for (const seat of env.seats) {
        assert.ok(
          seen.has(`${seat.x},${seat.y}`),
          `${env.key}: seat ${seat.id} is walled in`
        );
      }
    }
  });

  test("the rooms are genuinely different from one another", () => {
    // Eight tints of one layout would defeat the point of having eight rooms.
    const signatures = Object.keys(PROPS).map((key) =>
      [...new Set(propsFor(key).map((p) => p.kind))].sort().join(",")
    );
    assert.ok(
      new Set(signatures).size >= 5,
      "the environments use too similar a set of furniture"
    );
  });
});
