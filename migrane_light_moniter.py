import json
import time
import serial

PORT = "/dev/cu.usbmodem14683022582"
BAUD = 115200
BATCH_SIZE = 30
WARMUP_READINGS = 3


AIR_BASELINE = 0

light_sum = 0.0
air_sum = 0.0
count = 0


def send_to_database(record: dict) -> None:
    # Replace with your teammate's insert / POST. For now, print JSON.
    print(json.dumps(record))


with serial.Serial(PORT, BAUD, timeout=2) as ser:
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
            send_to_database(record)
            light_sum = 0.0
            air_sum = 0.0
            count = 0