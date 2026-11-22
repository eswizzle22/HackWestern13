const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

// `only` limits which variables are read from the file.
function loadEnvFile(filePath, { only } = {}) {
  if (!fs.existsSync(filePath)) return;
  const contents = fs.readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 1) continue;
    const name = trimmed.slice(0, separatorIndex).trim();
    if (only && !only.test(name)) continue;
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[name] === undefined) process.env[name] = value;
  }
}

loadEnvFile(path.join(__dirname, ".env"));
// One file can hold every secret: the backend's .env may also carry the Gemini settings. Only GEMINI_ variables are read
// from it, so the database password never enters this process.
loadEnvFile(path.join(__dirname, "backend", ".env"), { only: /^GEMINI_/ });

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 8000);
const root = __dirname;
const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiModel = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const geminiApiUrl =
  process.env.GEMINI_API_URL ||
  `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`;
const geminiTimeoutMs = Number(process.env.GEMINI_TIMEOUT_MS || 20000);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

const recentRequests = new Map();
let latestLiveData = { airRaw: 612, lightRaw: 420, updatedAt: null };
const sessionStore = new Map();

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", chunk => {
      body += chunk;
      if (body.length > 16 * 1024) {
        reject(new Error("Request too large"));
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

function validateContext(context) {
  if (!context || typeof context !== "object") return false;
  if (!Array.isArray(context.symptoms) || context.symptoms.length > 5) return false;
  if (!context.environment || typeof context.environment !== "object") return false;
  if (context.correlation !== null && typeof context.correlation !== "object") return false;

  return context.symptoms.every(item =>
    item &&
    typeof item.symptom === "string" &&
    item.symptom.length <= 40 &&
    typeof item.severityBand === "string" &&
    ["mild", "moderate", "high"].includes(item.severityBand)
  );
}

function buildPrompt(context) {
  return [
    "Create short Prodrome wellbeing dashboard copy from this de-identified context.",
    "Use only general environmental and symptom context.",
    "Do not diagnose, claim medical causation, mention the user's identity, or give emergency medical advice.",
    "Clearly keep the language observational.",
    "Return exactly one JSON object with keys intervention, detail, notification.",
    "Keep intervention under 60 characters, detail under 140 characters, and notification under 120 characters.",
    "No markdown and no extra text.",
    JSON.stringify(context),
  ].join("\n");
}

function parseGeneratedJson(text) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const parsed = JSON.parse(cleaned);
  if (
    typeof parsed.intervention !== "string" ||
    typeof parsed.detail !== "string" ||
    typeof parsed.notification !== "string"
  ) {
    throw new Error("Malformed Gemini response");
  }
  return {
    intervention: parsed.intervention.slice(0, 60),
    detail: parsed.detail.slice(0, 140),
    notification: parsed.notification.slice(0, 120),
  };
}

function isRateLimited(address) {
  const now = Date.now();
  const minuteAgo = now - 60 * 1000;
  const timestamps = (recentRequests.get(address) || []).filter(timestamp => timestamp > minuteAgo);
  timestamps.push(now);
  recentRequests.set(address, timestamps);
  return timestamps.length > 20;
}

async function handleGemini(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  if (isRateLimited(request.socket.remoteAddress || "unknown")) {
    sendJson(response, 429, { error: "Too many requests" });
    return;
  }

  let payload;
  try {
    payload = await readJson(request);
  } catch (error) {
    sendJson(response, 400, { error: error.message });
    return;
  }

  if (!validateContext(payload.context)) {
    sendJson(response, 400, { error: "Invalid de-identified context" });
    return;
  }
  if (!geminiApiKey) {
    sendJson(response, 503, { error: "Gemini is not configured" });
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), geminiTimeoutMs);

  try {
    const upstream = await fetch(geminiApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiApiKey,
      },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [{ text: buildPrompt(payload.context) }],
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 512,
          responseMimeType: "application/json",
        },
      }),
      signal: controller.signal,
    });

    const upstreamBody = await upstream.text();
    if (!upstream.ok) {
      console.error("Gemini upstream error:", upstream.status);
      sendJson(response, 502, { error: "Gemini request failed" });
      return;
    }

    const upstreamJson = JSON.parse(upstreamBody);
    const text = upstreamJson.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();
    if (!text) {
      const candidate = upstreamJson.candidates?.[0];
      const finishReason = candidate?.finishReason || "unknown";
      const blockReason = upstreamJson.promptFeedback?.blockReason;
      throw new Error(
        `Empty Gemini response (finishReason=${finishReason}${blockReason ? `, blockReason=${blockReason}` : ""})`
      );
    }

    sendJson(response, 200, parseGeneratedJson(text));
  } catch (error) {
    console.error("Gemini proxy error:", error.name === "AbortError" ? "timeout" : error.message);
    sendJson(response, 502, { error: "Gemini copy unavailable" });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function handleLiveData(request, response) {
  if (request.method === "GET") {
    sendJson(response, 200, latestLiveData);
    return;
  }
  if (request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  let payload;
  try {
    payload = await readJson(request);
  } catch (error) {
    sendJson(response, 400, { error: error.message });
    return;
  }

  const airRaw = Number(payload.airRaw ?? payload.airPpm);
  const lightRaw = Number(payload.lightRaw ?? payload.lux);
  if (
    !Number.isFinite(airRaw) || airRaw < 0 || airRaw > 1023 ||
    !Number.isFinite(lightRaw) || lightRaw < 0 || lightRaw > 1023
  ) {
    sendJson(response, 400, { error: "Grove sensor readings must use 10-bit ADC values from 0–1023" });
    return;
  }

  latestLiveData = {
    airRaw: Math.round(airRaw),
    lightRaw: Math.round(lightRaw),
    updatedAt: new Date().toISOString(),
  };
  sendJson(response, 200, latestLiveData);
}

async function handleSessionData(request, response) {
  if (request.method === "GET") {
    const sessions = Array.from(sessionStore.values())
      .sort((a, b) => new Date(b.endedAt) - new Date(a.endedAt))
      .slice(0, 20);
    sendJson(response, 200, { sessions });
    return;
  }
  if (request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  let payload;
  try {
    payload = await readJson(request);
  } catch (error) {
    sendJson(response, 400, { error: error.message });
    return;
  }

  if (!payload.sessionId || !Array.isArray(payload.readings) || !Array.isArray(payload.symptoms)) {
    sendJson(response, 400, { error: "Invalid session data" });
    return;
  }
  const session = {
    sessionId: payload.sessionId,
    startedAt: payload.startedAt,
    endedAt: payload.endedAt || new Date().toISOString(),
    readings: payload.readings.slice(-500),
    symptoms: payload.symptoms.slice(-500),
    thresholds: payload.thresholds,
    sensitivityProfile: payload.sensitivityProfile,
    deviceSpecs: payload.deviceSpecs,
  };
  sessionStore.set(session.sessionId, session);
  sendJson(response, 201, session);
}

// Only the website's own files are public. Everything else in the repo folder (.env files, .git, backend/,
// node_modules, server code, docs) is never served, so secrets cannot be downloaded through this server.
const PUBLIC_FILES = new Set(["/index.html", "/app.js", "/backend.js", "/styles.css"]);
const PUBLIC_DIRECTORIES = ["/Fonts/"];

function isPublicPath(decodedPath) {
  if (PUBLIC_FILES.has(decodedPath)) return true;
  const hidden = decodedPath.split("/").some(part => part.startsWith("."));
  return !hidden && PUBLIC_DIRECTORIES.some(directory => decodedPath.startsWith(directory));
}

function serveStatic(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const pathname = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    sendJson(response, 404, { error: "Not found" });
    return;
  }
  const filePath = path.resolve(root, `.${decodedPath}`);

  if ((filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) || !isPublicPath(decodedPath)) {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendJson(response, error.code === "ENOENT" ? 404 : 500, { error: "Not found" });
      return;
    }
    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(data);
  });
}

const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, `http://${request.headers.host || "localhost"}`).pathname;
  if (pathname === "/api/gemini-copy") {
    handleGemini(request, response);
  } else if (pathname === "/api/live-data") {
    handleLiveData(request, response);
  } else if (pathname === "/api/session-data") {
    handleSessionData(request, response);
  } else if (pathname === "/api/health") {
    sendJson(response, 200, {
      status: "ok",
      geminiConfigured: Boolean(geminiApiKey),
    });
  } else {
    serveStatic(request, response);
  }
});

server.listen(port, host, () => {
  console.log(`Prodrome running at http://${host}:${port}`);
  console.log(geminiApiKey ? "Gemini proxy enabled" : "Gemini proxy disabled; add GEMINI_API_KEY");
});
