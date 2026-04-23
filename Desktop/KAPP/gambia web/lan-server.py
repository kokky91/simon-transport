#!/usr/bin/env python3
"""
WebGen Gambia — LAN server
Serves the static site + mirrors the Cloudflare Worker /api/kassa endpoints locally.
Run this on the restaurant's computer/tablet. All phones on the same WiFi will be
able to place orders + see updates even without internet.

Usage:
    python lan-server.py          # port 8787
    python lan-server.py 8080     # custom port
"""
import json
import os
import socket
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

# ---------- Config ----------
DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lan-data.json')
STATIC_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_PORT = 8787
MAX_ENTRIES = 500

# ---------- Thread-safe storage ----------
_lock = threading.RLock()
_data = {"orders": {}, "reservations": {}}  # keyed by rid → list of records


def load_data():
    global _data
    try:
        if os.path.exists(DATA_FILE):
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                _data = json.load(f)
                _data.setdefault("orders", {})
                _data.setdefault("reservations", {})
    except Exception as e:
        print(f"⚠ Failed to load {DATA_FILE}: {e} (starting empty)")


def save_data():
    try:
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(_data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"⚠ Failed to save {DATA_FILE}: {e}")


def get_list(kind, rid):
    with _lock:
        return list(_data.get(kind, {}).get(rid, []))


def upsert(kind, rid, record):
    with _lock:
        bucket = _data.setdefault(kind, {}).setdefault(rid, [])
        record = dict(record)
        record.setdefault("restaurantId", rid)
        record.setdefault("createdAt", int(time.time() * 1000))
        record["serverAt"] = int(time.time() * 1000)
        found = False
        for i, r in enumerate(bucket):
            if r.get("id") == record.get("id"):
                bucket[i] = record
                found = True
                break
        if not found:
            bucket.insert(0, record)
        if len(bucket) > MAX_ENTRIES:
            del bucket[MAX_ENTRIES:]
        save_data()
        return record


def patch_record(kind, rid, record_id, patch):
    allowed = {
        "orders": {"status", "note", "paidAt", "preparingAt", "readyAt", "servedAt", "cancelled"},
        "reservations": {"status", "notes", "seatedAt", "cancelledAt"},
    }[kind]
    with _lock:
        bucket = _data.get(kind, {}).get(rid, [])
        for r in bucket:
            if r.get("id") == record_id:
                for f in allowed:
                    if f in patch:
                        r[f] = patch[f]
                r["serverAt"] = int(time.time() * 1000)
                save_data()
                return r
    return None


def delete_record(kind, rid, record_id):
    with _lock:
        bucket = _data.get(kind, {}).get(rid, [])
        _data[kind][rid] = [r for r in bucket if r.get("id") != record_id]
        save_data()


# ---------- Request handler ----------
class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    # Quiet the default access log (keep startup clean)
    def log_message(self, fmt, *args):
        pass

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Max-Age", "86400")

    def _json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.send_header("Connection", "close")
        self.end_headers()

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception:
            return {}

    # ---------- Static files ----------
    def _serve_static(self, path):
        if path == "/" or path == "":
            path = "/index.html"
        safe = os.path.normpath(path.lstrip("/")).replace("\\", "/")
        if safe.startswith(".."):
            self.send_error(403)
            return
        full = os.path.join(STATIC_DIR, safe)
        if os.path.isdir(full):
            full = os.path.join(full, "index.html")
        if not os.path.isfile(full):
            self.send_error(404, "Not Found")
            return
        # Content type
        ext = os.path.splitext(full)[1].lower()
        ctype = {
            ".html": "text/html; charset=utf-8",
            ".js":   "application/javascript; charset=utf-8",
            ".css":  "text/css; charset=utf-8",
            ".json": "application/json; charset=utf-8",
            ".svg":  "image/svg+xml",
            ".png":  "image/png",
            ".jpg":  "image/jpeg",
            ".jpeg": "image/jpeg",
            ".webp": "image/webp",
            ".ico":  "image/x-icon",
        }.get(ext, "application/octet-stream")
        try:
            with open(full, "rb") as f:
                data = f.read()
        except Exception:
            self.send_error(500)
            return
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self._cors()
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(data)

    # ---------- API routing ----------
    def _handle_api(self, method, path, query):
        # /api/kassa/<rid>/orders
        # /api/kassa/<rid>/orders/<id>
        parts = path.strip("/").split("/")
        if len(parts) >= 4 and parts[0] == "api" and parts[1] == "kassa":
            rid = parts[2]
            kind_seg = parts[3]  # "orders" or "reservations"
            if kind_seg not in ("orders", "reservations"):
                return self._json(404, {"error": "Unknown kind"})
            kind = kind_seg
            record_id = parts[4] if len(parts) >= 5 else None

            if record_id is None:
                if method == "GET":
                    since = int(query.get("since", ["0"])[0] or 0)
                    items = get_list(kind, rid)
                    if since:
                        items = [r for r in items if (r.get("serverAt") or r.get("createdAt") or 0) > since]
                    return self._json(200, {kind: items, "serverTime": int(time.time() * 1000)})
                if method == "POST":
                    body = self._read_body()
                    if not body or not body.get("id"):
                        return self._json(400, {"error": "id required"})
                    rec = upsert(kind, rid, body)
                    return self._json(200, {"success": True, kind[:-1]: rec})
            else:
                if method in ("PATCH", "PUT"):
                    patch = self._read_body()
                    updated = patch_record(kind, rid, record_id, patch)
                    if not updated:
                        return self._json(404, {"error": f"{kind[:-1]} not found"})
                    return self._json(200, {"success": True, kind[:-1]: updated})
                if method == "DELETE":
                    delete_record(kind, rid, record_id)
                    return self._json(200, {"success": True})
            return self._json(405, {"error": "Method not allowed"})

        # Health check
        if path == "/api/health":
            return self._json(200, {"ok": True, "lan": True, "time": int(time.time() * 1000)})

        return self._json(404, {"error": "Not found", "path": path})

    def do_GET(self):
        u = urlparse(self.path)
        if u.path.startswith("/api/"):
            return self._handle_api("GET", u.path, parse_qs(u.query or ""))
        self._serve_static(u.path)

    def do_POST(self):
        u = urlparse(self.path)
        if u.path.startswith("/api/"):
            return self._handle_api("POST", u.path, parse_qs(u.query or ""))
        self.send_error(405)

    def do_PATCH(self):
        u = urlparse(self.path)
        if u.path.startswith("/api/"):
            return self._handle_api("PATCH", u.path, parse_qs(u.query or ""))
        self.send_error(405)

    def do_PUT(self):
        self.do_PATCH()

    def do_DELETE(self):
        u = urlparse(self.path)
        if u.path.startswith("/api/"):
            return self._handle_api("DELETE", u.path, parse_qs(u.query or ""))
        self.send_error(405)


# ---------- LAN IP detection ----------
def get_lan_ip():
    """Find the IP address used for the primary LAN interface (no DNS required)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # This doesn't actually send anything — just picks the interface OS would use.
        s.connect(("10.255.255.255", 1))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


# ---------- Main ----------
def main():
    # Windows console: force UTF-8 so the boxes/emojis render instead of crashing
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    port = DEFAULT_PORT
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print(f"⚠ Invalid port '{sys.argv[1]}', falling back to {DEFAULT_PORT}")
    load_data()
    ip = get_lan_ip()
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)

    orders_count = sum(len(v) for v in _data.get("orders", {}).values())
    res_count = sum(len(v) for v in _data.get("reservations", {}).values())

    print()
    print("╔════════════════════════════════════════════════════════╗")
    print("║       WebGen Gambia — LAN server (offline mode)        ║")
    print("╚════════════════════════════════════════════════════════╝")
    print()
    print(f"  Kassa (dit apparaat):  http://localhost:{port}/kassa.html")
    print(f"  Op je telefoon:        http://{ip}:{port}/bestel.html?r=demo&t=5")
    print(f"  Reserveer op website:  http://{ip}:{port}/reserveer.html?r=demo")
    print()
    print(f"  Data-bestand:   {DATA_FILE}")
    print(f"  Geladen:        {orders_count} orders · {res_count} reserveringen")
    print()
    print("  ▸ Vul in kassa → Instellingen → 'Basis URL' in:")
    print(f"      http://{ip}:{port}/bestel.html")
    print("  ▸ Genereer QR codes opnieuw → telefoons scannen dan naar jouw LAN")
    print("  ▸ Stop: Ctrl+C")
    print()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n✓ LAN-server gestopt — data is opgeslagen.")
        server.shutdown()


if __name__ == "__main__":
    main()
