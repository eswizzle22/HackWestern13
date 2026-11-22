import json
import os
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import serial
from serial.tools import list_ports

# Serial port: the Arduino is found automatically. Set PRODROME_SERIAL_PORT to force a specific one.
SERIAL_PORT = os.environ.get("PRODROME_SERIAL_PORT")
ARDUINO_VENDOR_ID = 0x2341
PORT_NAME_HINTS = ("arduino", "usbmodem", "usbserial", "ttyacm")
BAUD = 115200
BATCH_SIZE = 30
WARMUP_READINGS = 3
RECONNECT_SECONDS = 2
BRIDGE_HOST = "0.0.0.0"
BRIDGE_PORT = 8765

# Where finished records are sent. With PRODROME_BACKEND_URL unset, records are only printed.
BACKEND_URL = os.environ.get("PRODROME_BACKEND_URL", "").rstrip("/")
DEVICE_KEY = os.environ.get("PRODROME_DEVICE_KEY", "")
DEVICE_ID = os.environ.get("PRODROME_DEVICE_ID", "CA-0018")

AIR_BASELINE = 16.4

latest_record = None
record_lock = threading.Lock()


def find_arduino_port():
    if SERIAL_PORT:
        return SERIAL_PORT
    for port in list_ports.comports():
        name = f"{port.device} {port.description}".lower()
        if port.vid == ARDUINO_VENDOR_ID or any(hint in name for hint in PORT_NAME_HINTS):
            return port.device
    return None


def send_to_database(record: dict) -> None:
    if not BACKEND_URL:
        print(json.dumps(record))
        return

    body = json.dumps({"device_id": DEVICE_ID, **record}).encode("utf-8")
    request = urllib.request.Request(
        f"{BACKEND_URL}/api/readings",
        data=body,
        method="POST",
        headers={"Content-Type": "application/json", "x-device-key": DEVICE_KEY},
    )
    try:
        with urllib.request.urlopen(request, timeout=5):
            pass
    except (urllib.error.URLError, OSError) as error:
        print(f"Could not send record to the backend: {error}")


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


def clear_sensor_data() -> None:
    # The Arduino is gone, so the last record must not keep looking live.
    global latest_record
    with record_lock:
        latest_record = None


def stream_from(port_name: str) -> None:
    # Batch state lives here so a reconnect never mixes readings from before and after a power cycle.
    light_sum = 0.0
    air_sum = 0.0
    count = 0

    with serial.Serial(port_name, BAUD, timeout=2) as ser:
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
                publish_sensor_data(record)
                # Sent from a thread so a slow network never stalls reading the Arduino.
                threading.Thread(target=send_to_database, args=(record,), daemon=True).start()
                light_sum = 0.0
                air_sum = 0.0
                count = 0


def main() -> None:
    start_sensor_bridge()
    waiting = False

    # Plugging the Arduino in starts streaming; unplugging it ends the stream. Either way we keep running,
    # and the backend sees the readings stop and closes the working session.
    while True:
        port_name = find_arduino_port()
        if port_name is None:
            if not waiting:
                print("No Arduino found. Waiting for it to be plugged in...")
                waiting = True
            time.sleep(RECONNECT_SECONDS)
            continue

        waiting = False
        print(f"Reading from {port_name}")
        try:
            stream_from(port_name)
        except (serial.SerialException, OSError) as error:
            print(f"Lost the Arduino ({error}). Reconnecting...")
        clear_sensor_data()
        time.sleep(RECONNECT_SECONDS)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("Stopped.")
