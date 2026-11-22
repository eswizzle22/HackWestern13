// Pretends to be Anna's sensor script: posts one averaged record per interval to the backend.
// Stop it (Ctrl+C) to simulate switching the Arduino off. Usage:
//   npm run simulate -- --device CA-0018 --interval 30 --count 20
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, index, all) => (arg.startsWith("--") ? [...pairs, [arg.slice(2), all[index + 1]]] : pairs), []));
const url = args.url || process.env.BACKEND_URL || "http://localhost:3000";
const deviceId = args.device || "CA-0018";
const intervalMs = Number(args.interval || 30) * 1000;
const count = args.count ? Number(args.count) : Infinity;
const key = process.env.DEVICE_KEY;
if (!key) {
  console.error("DEVICE_KEY is not set. Add it to backend/.env.");
  process.exit(1);
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const noise = size => (Math.random() - 0.5) * size;

let sent = 0;
async function send() {
  // Light drifts gently through the "day"; air slowly builds up like a closed room.
  const light = clamp(330 + 160 * Math.sin(sent / 25) + noise(30), 0, 625);
  const air = clamp(280 + sent * 3 + noise(24), 0, 1023);
  const record = { device_id: deviceId, light_avg: Math.round(light * 10) / 10, air_avg: Math.round(air * 10) / 10 };
  try {
    const response = await fetch(`${url}/api/readings`, { method: "POST", headers: { "Content-Type": "application/json", "x-device-key": key }, body: JSON.stringify(record) });
    console.log(`#${sent + 1}`, JSON.stringify(record), "->", response.status, JSON.stringify(await response.json()));
  } catch (error) {
    console.error(`#${sent + 1} could not reach ${url}:`, error.message);
  }
  sent += 1;
  if (sent >= count) process.exit(0);
}

send();
setInterval(send, intervalMs);
