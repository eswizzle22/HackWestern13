const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");

// Runs the real website server (../server.js) against a fake Gemini, so no API key or network is needed.
const SERVER_PORT = 8794;
const NOKEY_PORT = 8796;
const UPSTREAM_PORT = 8795;
const SERVER_FILE = path.join(__dirname, "..", "..", "server.js");

let mode = "ok";
const upstreamRequests = [];
let upstream;
const servers = [];

const copy = { intervention: "Fresh air might help", detail: "Air has been a bit stale lately.", notification: "Open a window when you can." };
const googleReply = text => JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] });

function startServer(port, env) {
  const child = spawn("node", [SERVER_FILE], { env: { ...process.env, PORT: String(port), GEMINI_API_URL: `http://127.0.0.1:${UPSTREAM_PORT}/generate`, ...env } });
  servers.push(child);
  return new Promise((resolve, reject) => {
    child.stdout.on("data", data => { if (String(data).includes("running at")) resolve(); });
    child.on("exit", code => reject(new Error(`server exited early (${code})`)));
    setTimeout(() => reject(new Error("server did not start")), 5000);
  });
}

before(async () => {
  upstream = http.createServer((request, response) => {
    let body = "";
    request.on("data", chunk => { body += chunk; });
    request.on("end", () => {
      upstreamRequests.push({ headers: request.headers, body: JSON.parse(body) });
      const replies = {
        ok: [200, googleReply(JSON.stringify(copy))],
        fenced: [200, googleReply("```json\n" + JSON.stringify(copy) + "\n```")],
        long: [200, googleReply(JSON.stringify({ intervention: "i".repeat(300), detail: "d".repeat(500), notification: "n".repeat(400) }))],
        error: [500, "boom"],
        empty: [200, JSON.stringify({ candidates: [{ content: { parts: [] }, finishReason: "SAFETY" }] })],
        garbage: [200, googleReply("this is not json at all")],
      };
      const [status, reply] = replies[mode];
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(reply);
    });
  });
  await new Promise(resolve => upstream.listen(UPSTREAM_PORT, "127.0.0.1", resolve));
  await startServer(SERVER_PORT, { GEMINI_API_KEY: "test-key" });
  await startServer(NOKEY_PORT, { GEMINI_API_KEY: "" });
});
after(() => { servers.forEach(child => child.kill()); upstream.close(); });

const post = (body, port = SERVER_PORT, method = "POST") =>
  fetch(`http://127.0.0.1:${port}/api/gemini-copy`, { method, headers: { "Content-Type": "application/json" }, body: method === "POST" ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined })
    .then(async response => ({ status: response.status, body: await response.json().catch(() => null) }));

// A context shaped like the one the dashboard builds.
const context = () => ({
  symptoms: [{ symptom: "Headache", severityBand: "moderate" }, { symptom: "Eye strain", severityBand: "mild" }],
  environment: { airBand: "bad", lightBand: "moderate", timeOfDayBand: "daytime" },
  learningProfile: {
    sensitivitySurveyCompleted: true, sensitivities: { brightLight: "Low", dimLight: "Medium", stuffyAir: "High", odors: "Low" },
    deviceSpecs: { model: "Prodrome One" }, thresholds: { calibrated: true, airCaution: 445, airPoor: 692, lightDim: 166, lightHarsh: 516 },
  },
  correlation: { label: "Stale air", lookbackMinutes: 30, minimumLogCount: 5, confidenceBand: "high" },
});

test("a valid context returns the three suggestion texts", async () => {
  mode = "ok";
  const response = await post({ context: context(), instructions: "be brief" });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, copy);
});

test("the key and the de-identified context reach Gemini, and nothing else", async () => {
  const sent = upstreamRequests[upstreamRequests.length - 1];
  assert.equal(sent.headers["x-goog-api-key"], "test-key");
  const prompt = sent.body.contents[0].parts[0].text;
  assert.ok(prompt.includes('"airBand":"bad"') && prompt.includes("Stale air"));
  assert.ok(/Do not diagnose/.test(prompt), "the safety instructions are in the prompt");
  assert.ok(!/user_id|email|auth0|google-oauth2|demo-user/i.test(prompt), "no identity in the prompt");
});

test("JSON wrapped in a markdown fence is understood", async () => {
  mode = "fenced";
  assert.deepEqual((await post({ context: context() })).body, copy);
});

test("overlong text is cut to the limits the card can show", async () => {
  mode = "long";
  const { body } = await post({ context: context() });
  assert.equal(body.intervention.length, 60);
  assert.equal(body.detail.length, 140);
  assert.equal(body.notification.length, 120);
});

test("contexts that are not de-identified summaries are refused", async () => {
  mode = "ok";
  const bad = [
    { ...context(), symptoms: [{ symptom: "Headache", severityBand: "extreme" }] },
    { ...context(), symptoms: "Headache" },
    { ...context(), symptoms: Array.from({ length: 6 }, () => ({ symptom: "Headache", severityBand: "mild" })) },
    { ...context(), symptoms: [{ symptom: "x".repeat(41), severityBand: "mild" }] },
    { ...context(), environment: undefined },
    { ...context(), correlation: "Stale air" },
  ];
  for (const item of bad) assert.equal((await post({ context: item })).status, 400, JSON.stringify(item).slice(0, 80));
  assert.equal((await post({})).status, 400, "missing context");
  assert.equal((await post("{not json")).status, 400, "invalid JSON");
});

test("only POST is allowed", async () => {
  assert.equal((await post(null, SERVER_PORT, "GET")).status, 405);
});

test("Gemini failures become a 502 the page can fall back from", async () => {
  for (const failure of ["error", "empty", "garbage"]) {
    mode = failure;
    assert.equal((await post({ context: context() })).status, 502, failure);
  }
});

test("without a key the proxy says so", async () => {
  mode = "ok";
  assert.equal((await post({ context: context() }, NOKEY_PORT)).status, 503);
});

test("too many requests in a minute are refused", async () => {
  mode = "ok";
  const statuses = [];
  for (let i = 0; i < 15; i++) statuses.push((await post({ context: context() })).status);
  assert.ok(statuses.includes(429), `expected a 429 in ${statuses.join(",")}`);
});
