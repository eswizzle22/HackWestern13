const express = require("express");
const db = require("./db");
const { HttpError } = require("./symptoms");
const { router: readingsRouter } = require("./routes/readings");
const { router: usersRouter } = require("./routes/users");
const { router: historyRouter } = require("./routes/history");

const app = express();
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:8000";

app.use(express.json({ limit: "100kb" }));

// The frontend runs on another origin (localhost:8000), so the browser needs explicit permission to call us.
app.use((request, response, next) => {
  response.set("Access-Control-Allow-Origin", frontendOrigin);
  response.set("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
  response.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (request.method === "OPTIONS") return response.sendStatus(204);
  next();
});

app.get("/health", (request, response) => response.json({ ok: true }));

// Proves the database connection works and that TimescaleDB is installed.
app.get("/health/db", async (request, response) => {
  try {
    const { rows } = await db.query(
      "SELECT version() AS postgres, (SELECT extversion FROM pg_extension WHERE extname = 'timescaledb') AS timescaledb"
    );
    response.json(rows[0]);
  } catch (error) {
    // Refused connections arrive as an AggregateError with an empty message, so fall back to the error code.
    response.status(503).json({ error: error.message || error.code || error.errors?.[0]?.code || "Database unreachable" });
  }
});

app.use(readingsRouter);
app.use(usersRouter);
app.use(historyRouter);

app.use((error, request, response, next) => {
  if (error instanceof HttpError) return response.status(error.status).json({ error: error.message });
  if (error.type === "entity.parse.failed") return response.status(400).json({ error: "Body is not valid JSON" });
  console.error(`${request.method} ${request.path} failed:`, error.message);
  response.status(500).json({ error: "Something went wrong" });
});

module.exports = app;
