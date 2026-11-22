const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");

// Starts the real website server (../server.js) and tries to read files it must never serve.
const PORT = 8791;
let server;

// http.get does not tidy the path, so ".." tricks reach the server exactly as written.
const get = rawPath => new Promise((resolve, reject) => {
  http.get({ host: "127.0.0.1", port: PORT, path: rawPath }, response => {
    let body = "";
    response.on("data", chunk => { body += chunk; });
    response.on("end", () => resolve({ status: response.statusCode, body, type: response.headers["content-type"] }));
  }).on("error", reject);
});

before(async () => {
  server = spawn("node", [path.join(__dirname, "..", "..", "server.js")], { env: { ...process.env, PORT: String(PORT), GEMINI_API_KEY: "" } });
  await new Promise((resolve, reject) => {
    server.stdout.on("data", data => { if (String(data).includes("running at")) resolve(); });
    server.on("exit", code => reject(new Error(`server exited early (${code})`)));
    setTimeout(() => reject(new Error("server did not start")), 5000);
  });
});
after(() => server.kill());

test("the website's own files are served", async () => {
  for (const [file, type] of [["/", "text/html"], ["/index.html", "text/html"], ["/app.js", "text/javascript"], ["/backend.js", "text/javascript"], ["/styles.css", "text/css"]]) {
    const response = await get(file);
    assert.equal(response.status, 200, file);
    assert.ok(response.type.startsWith(type), `${file} is ${response.type}`);
  }
});

test("fonts are served", async () => {
  assert.equal((await get("/Fonts/Modern%20Era.ttf")).status, 200);
});

test("secrets and source files are not served", async () => {
  const blocked = [
    "/.env", "/backend/.env", "/backend/.env.example", "/.git/config", "/.git/HEAD", "/.gitignore",
    "/backend/src/db.js", "/backend/package.json", "/backend/db/schema.sql", "/backend/node_modules/express/package.json",
    "/server.js", "/package.json", "/README.md", "/DESIGN.md", "/migrane_light_moniter.py", "/pages/login.js", "/.vscode/launch.json",
  ];
  for (const file of blocked) {
    const response = await get(file);
    assert.equal(response.status, 404, `${file} must not be served`);
    assert.ok(!/DATABASE_URL|DEVICE_KEY|GEMINI_API_KEY|postgres:\/\//.test(response.body), `${file} leaked content`);
  }
});

test("path tricks cannot reach blocked files", async () => {
  const tricks = [
    "/Fonts/../backend/.env", "/Fonts/../.env", "/Fonts/%2e%2e/backend/.env", "/%2e%2e/%2e%2e/etc/passwd", "/../../etc/passwd",
    "//backend//.env", "/./backend/.env", "/Fonts/.hidden", "/Fonts/%2e%2e%2f.env", "/backend%2f.env", "/app.js/../backend/.env",
  ];
  for (const file of tricks) {
    const response = await get(file);
    assert.notEqual(response.status, 200, `${file} must not be served`);
    assert.ok(!/DATABASE_URL|DEVICE_KEY|root:/.test(response.body), `${file} leaked content`);
  }
});

test("a malformed address does not crash the server", async () => {
  const response = await get("/%E0%A4%A");
  assert.equal(response.status, 404);
  assert.equal((await get("/api/health")).status, 200, "server is still alive");
});
