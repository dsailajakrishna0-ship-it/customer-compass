import assert from "node:assert/strict";
import test from "node:test";
import { app } from "./app.js";

test("rejects a non-numeric company ID before touching the database", async () => {
  const server = app.listen();
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const response = await fetch(`http://127.0.0.1:${address.port}/api/companies/not-a-number`);
  assert.equal(response.status, 400);
  server.close();
});

test("rejects an empty chat request before calling the model", async () => {
  const server = app.listen();
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const response = await fetch(`http://127.0.0.1:${address.port}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [] }),
  });
  assert.equal(response.status, 400);
  server.close();
});
