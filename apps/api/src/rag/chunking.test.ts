import assert from "node:assert/strict";
import test from "node:test";
import { chunkText } from "./chunking.js";

test("returns no chunks for empty input", () => {
  assert.deepEqual(chunkText(""), []);
  assert.deepEqual(chunkText("   "), []);
});

test("returns a single chunk when text fits within chunkSize", () => {
  const chunks = chunkText("short text", { chunkSize: 100, overlap: 10 });
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].content, "short text");
  assert.equal(chunks[0].index, 0);
});

test("splits long text into overlapping chunks with increasing indexes", () => {
  const text = "a".repeat(250);
  const chunks = chunkText(text, { chunkSize: 100, overlap: 20 });

  assert.ok(chunks.length > 1);
  chunks.forEach((chunk, i) => assert.equal(chunk.index, i));
  // Overlap means consecutive chunks share characters at the boundary.
  for (let i = 1; i < chunks.length; i += 1) {
    assert.ok(chunks[i].charStart < chunks[i - 1].charEnd);
  }
});

test("rejects an overlap that is not smaller than chunkSize", () => {
  assert.throws(() => chunkText("hello", { chunkSize: 10, overlap: 10 }));
});
