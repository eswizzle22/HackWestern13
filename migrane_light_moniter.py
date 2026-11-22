from collections import deque
import json
import time
import serial

PORT = "/dev/cu.usbmodem14683022582"
BAUD = 115200

BASELINE = 450 #this is based on data in schmeical change this
THRESHOLD = 530       # Triggers above ~450 baseline, well below ~620 ceiling
WINDOW_SECONDS = 30

samples = deque()  # Stores (timestamp, light_raw) tuples

with serial.Serial(PORT, BAUD, timeout=2) as ser:
    while True:
        line = ser.readline().decode("utf-8", errors="ignore").strip()
        if not line:
            continue

        try:
            payload = json.loads(line)
            raw_val = payload.get("light_raw")
            if raw_val is None:
                continue
        except json.JSONDecodeError:
            continue

        now = time.monotonic()
        samples.append((now, float(raw_val)))

        # Drop readings older than 30 seconds
        while samples and (now - samples[0][0]) > WINDOW_SECONDS:
            samples.popleft()

        avg_30s = sum(v for _, v in samples) / len(samples)
        is_high = avg_30s >= THRESHOLD

        print(
            f"Raw: {int(raw_val)} | 30s Avg: {avg_30s:.1f} | "
            f"Baseline: {BASELINE} | Migraine Light Alert: {is_high}"
        )