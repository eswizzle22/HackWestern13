import json
import time
import serial
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = "/dev/cu.usbmodem14683022582"
BAUD = 115200
BATCH_SIZE = 30
WARMUP_READINGS = 3
BRIDGE_HOST = "0.0.0.0"
BRIDGE_PORT = 8765


AIR_BASELINE = 16.4

light_sum = 0.0
air_sum = 0.0
count = 0
latest_record = None
record_lock = threading.Lock()


def send_to_database(record: dict) -> None:
    # Replace with your teammate's insert / POST. For now, print JSON.
    print(json.dumps(record))


class SensorBridgeHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/latest":
            self.send_error(404)
            return

        with record_lock:
            record = latest_record
        body = json.dumps(record or {"available": False}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass


def start_sensor_bridge():
    server = ThreadingHTTPServer((BRIDGE_HOST, BRIDGE_PORT), SensorBridgeHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    print(f"Live sensor bridge listening on port {BRIDGE_PORT}")


def publish_sensor_data(record: dict) -> None:
    global latest_record
    with record_lock:
        latest_record = {**record, "updated_at": time.time()}


with serial.Serial(PORT, BAUD, timeout=2) as ser:
    start_sensor_bridge()
    time.sleep(2)             # let the Uno finish rebooting
    ser.reset_input_buffer()  # clear leftover bytes, once
    warmup = WARMUP_READINGS

    while True:
        line = ser.readline().decode("utf-8", errors="ignore").strip()
        if not line:
            continue

        json_start = line.find("{")
        if json_start == -1:
            continue

        try:
            payload = json.loads(line[json_start:])
        except json.JSONDecodeError:
            continue

        light_raw = payload.get("light_raw")
        air_raw = payload.get("air_raw")
        if light_raw is None or air_raw is None:
            continue

        # throw away the first few readings after startup
        if warmup > 0:
            warmup -= 1
            continue

        light_sum += float(light_raw)
        air_sum += float(air_raw)
        count += 1

        if count >= BATCH_SIZE:
            air_avg = air_sum / count 
            record = {
                "light_avg": round(light_sum / count, 1),
                "air_avg": round(air_avg, 1),
                "air_delta": round(air_avg - AIR_BASELINE, 1),
            }
            #send_to_database(record)
            publish_sensor_data(record)
            light_sum = 0.0
            air_sum = 0.0
            count = 0