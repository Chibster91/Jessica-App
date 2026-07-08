import { test } from "node:test";
import assert from "node:assert/strict";
import { assignSurrogateId, fnv1aHash, SURROGATE_ID_FLOOR } from "../src/surrogateId.mjs";

test("fnv1aHash is deterministic and unsigned 32-bit", () => {
  const a = fnv1aHash("fd_2dObzdqa6o2J");
  const b = fnv1aHash("fd_2dObzdqa6o2J");
  assert.equal(a, b);
  assert.ok(a >= 0 && a <= 0xffffffff);
});

test("assigned ids stay at or above the floor, disjoint from real USDA fdc_id ranges", () => {
  const id = assignSurrogateId(new Set(), "fd_abc123");
  assert.ok(id >= SURROGATE_ID_FLOOR, `expected ${id} >= ${SURROGATE_ID_FLOOR}`);
});

test("deterministic: the same sourceId against the same prior state yields the same id", () => {
  const id1 = assignSurrogateId(new Set(), "fd_abc123");
  const id2 = assignSurrogateId(new Set(), "fd_abc123");
  assert.equal(id1, id2);
});

test("collision probing: an occupied slot bumps to the next free id, deterministically", () => {
  const naturalId = assignSurrogateId(new Set(), "fd_xyz789");
  const taken = new Set([naturalId]); // simulate the slot already being taken
  const bumped = assignSurrogateId(taken, "fd_xyz789");
  assert.equal(bumped, naturalId + 1);
  assert.ok(taken.has(naturalId) && taken.has(bumped));
});

test("a large batch of distinct source ids never collides", () => {
  const taken = new Set();
  const assigned = new Set();
  for (let i = 0; i < 50000; i++) {
    assigned.add(assignSurrogateId(taken, `fd_${i}`));
  }
  assert.equal(assigned.size, 50000);
});
