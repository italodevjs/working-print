import test from "node:test";
import assert from "node:assert/strict";
import { createImageLoader } from "../image-loader.mjs";
import { PixelWorkerClient } from "../worker-client.mjs";

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const image = () => new Blob(["fixture"], { type: "image/png" });
const bitmap = () => ({ width: 20, height: 10, closed: false, close() { this.closed = true; } });

test("a slow initial sample fetch cannot replace a later local photograph", async () => {
  const sample = deferred(), committed = [], errors = [], loading = [];
  const load = createImageLoader({ decode: async () => bitmap(), onLoad: (_, __, name) => committed.push(name), onError: e => errors.push(e), onLoading: state => loading.push(state) });
  const first = load(() => sample.promise, "sample");
  await load(async () => image(), "local-photograph");
  sample.resolve(image());
  await first;
  assert.deepEqual(committed, ["local-photograph"]);
  assert.deepEqual(errors, []);
  assert.deepEqual(loading, [true, true, false]);
});

test("an obsolete decode closes its bitmap and does not commit or clear loading", async () => {
  const decoding = deferred(), old = bitmap(), current = bitmap(), committed = [];
  let calls = 0;
  const load = createImageLoader({ decode: () => ++calls === 1 ? decoding.promise : Promise.resolve(current), onLoad: value => committed.push(value), onError: assert.fail, onLoading() {} });
  const first = load(async () => image(), "first");
  await Promise.resolve();
  await load(async () => image(), "second");
  decoding.resolve(old);
  await first;
  assert.equal(old.closed, true);
  assert.equal(current.closed, false);
  assert.deepEqual(committed, [current]);
});

test("an obsolete sample fetch error cannot replace the current image status", async () => {
  const sample = deferred(), errors = [];
  const load = createImageLoader({ decode: async () => bitmap(), onLoad() {}, onError: e => errors.push(e), onLoading() {} });
  const first = load(() => sample.promise, "sample");
  await load(async () => image(), "local");
  sample.reject(new Error("Old network failure"));
  await first;
  assert.deepEqual(errors, []);
});

test("dimension rejection closes decoded resources and reports an actionable error", async () => {
  const oversized = bitmap(), errors = [];
  oversized.width = 20000;
  const load = createImageLoader({ decode: async () => oversized, onLoad: assert.fail, onError: e => errors.push(e.message), onLoading() {} });
  await load(async () => image(), "oversized");
  assert.equal(oversized.closed, true);
  assert.match(errors[0], /12 megapixels/);
});

test("fatal worker errors reject both pending and future renders without posting again", async () => {
  let posts = 0, terminated = false;
  const worker = { postMessage() { posts++; }, terminate() { terminated = true; } };
  const client = new PixelWorkerClient(worker);
  const pending = client.run(new Uint8ClampedArray(4), {});
  const rejected = assert.rejects(pending, /Reload the page/);
  worker.onerror();
  await rejected;
  await assert.rejects(client.run(new Uint8ClampedArray(4), {}), /Reload the page/);
  assert.equal(posts, 1);
  assert.equal(terminated, true);
});

test("a request-specific engine error does not poison later worker responses", async () => {
  const posted = [];
  const worker = { postMessage(message) { posted.push(message); }, terminate() {} };
  const client = new PixelWorkerClient(worker);
  const invalid = client.run(new Uint8ClampedArray(4), {});
  const rejected = assert.rejects(invalid, /Invalid recipe/);
  worker.onmessage({ data: { id: posted[0].id, error: "Invalid recipe" } });
  await rejected;
  const valid = client.run(new Uint8ClampedArray(4), {});
  worker.onmessage({ data: { id: posted[1].id, pixels: [1, 2, 3, 255] } });
  assert.deepEqual((await valid).pixels, [1, 2, 3, 255]);
});

test("a synchronous worker post failure rejects immediately rather than leaking a request", async () => {
  const client = new PixelWorkerClient({ postMessage() { throw new Error("Could not clone" ); }, terminate() {} });
  await assert.rejects(client.run(new Uint8ClampedArray(4), {}), /Could not clone/);
});
