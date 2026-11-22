const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

// Runs a copy of the website server inside a temporary folder laid out like the repo, so the real .env files are never touched.
const SERVER_FILE = path.join(__dirname, "..", "..", "server.js");
const cleanup = [];
after(() => cleanup.forEach(fn => fn()));

// Starts the copy with the given files and reports what the server sees: its Gemini status, and whether it loaded the database URL.
function run(files, port) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "prodrome-env-"));
  fs.copyFileSync(SERVER_FILE, path.join(folder, "server.js"));
  for (const [name, contents] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(folder, name)), { recursive: true });
    fs.writeFileSync(path.join(folder, name), contents);
  }
  // Prints what the process can see, once it has started.
  fs.writeFileSync(path.join(folder, "probe.js"), 'setTimeout(() => console.log("PROBE " + JSON.stringify({ db: process.env.DATABASE_URL !== undefined, key: process.env.GEMINI_API_KEY || null, model: process.env.GEMINI_MODEL || null })), 400);');
  const env = { ...process.env, PORT: String(port) };
  for (const name of ["GEMINI_API_KEY", "GEMINI_MODEL", "DATABASE_URL"]) delete env[name];
  const child = spawn("node", ["-r", "./probe.js", "server.js"], { cwd: folder, env });
  cleanup.push(() => { child.kill(); fs.rmSync(folder, { recursive: true, force: true }); });
  return new Promise((resolve, reject) => {
    child.stdout.on("data", async data => {
      const match = String(data).match(/PROBE (.*)/);
      if (!match) return;
      const health = await fetch(`http://127.0.0.1:${port}/api/health`).then(response => response.json());
      resolve({ ...JSON.parse(match[1]), configured: health.geminiConfigured });
    });
    child.on("exit", code => reject(new Error(`server exited early (${code})`)));
    setTimeout(() => reject(new Error("server did not start")), 6000);
  });
}

test("the Gemini key can live in backend/.env, next to the database settings", async () => {
  const seen = await run({ "backend/.env": "DATABASE_URL=postgres://user:secret@host/db\nGEMINI_API_KEY=key-from-backend\nGEMINI_MODEL=some-model\n" }, 8801);
  assert.equal(seen.configured, true);
  assert.equal(seen.key, "key-from-backend");
  assert.equal(seen.model, "some-model");
});

test("the database password in backend/.env is never loaded into the website server", async () => {
  const seen = await run({ "backend/.env": "DATABASE_URL=postgres://user:secret@host/db\nDEVICE_KEY=abc\nGEMINI_API_KEY=k\n" }, 8802);
  assert.equal(seen.db, false, "DATABASE_URL must not be read by the website server");
});

test("a .env in the main folder still works, and wins over backend/.env", async () => {
  assert.equal((await run({ ".env": "GEMINI_API_KEY=root-key\n" }, 8803)).key, "root-key");
  assert.equal((await run({ ".env": "GEMINI_API_KEY=root-key\n", "backend/.env": "GEMINI_API_KEY=backend-key\n" }, 8804)).key, "root-key");
});

test("with no key anywhere, Gemini is off", async () => {
  const seen = await run({ "backend/.env": "DATABASE_URL=postgres://user:secret@host/db\n" }, 8805);
  assert.equal(seen.configured, false);
  assert.equal(seen.key, null);
});
