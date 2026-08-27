"""
FIFA 19 Multi-City Online Auction Launcher
Starts the Flask server + Cloudflare Tunnel so friends in other cities can join instantly.
"""

import os
import sys
import time
import subprocess
import threading
import re
import webbrowser

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(PROJECT_DIR, "backend"))
CLOUDFLARED_PATH = os.path.join(PROJECT_DIR, "cloudflared.exe")
TUNNEL_FILE = os.path.join(PROJECT_DIR, "data", "tunnel_url.txt")
CONFIG_FILE = os.path.join(PROJECT_DIR, "data", "tunnel_config.json")

if os.path.exists(TUNNEL_FILE):
    try: os.remove(TUNNEL_FILE)
    except: pass

tunnel_proc = None
tunnel_ready_event = threading.Event()

def load_tunnel_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                import json
                return json.load(f)
        except Exception:
            pass
    return {}

def ensure_cloudflared():
    if not os.path.exists(CLOUDFLARED_PATH):
        print("[*] cloudflared.exe not found. Auto-downloading official Cloudflare Tunnel binary...")
        import urllib.request
        url = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
        try:
            urllib.request.urlretrieve(url, CLOUDFLARED_PATH)
            print("[+] cloudflared.exe downloaded successfully!\n")
        except Exception as e:
            print(f"[!] Auto-download of cloudflared.exe failed: {e}\n")

def run_tunnel(port=8000):
    global tunnel_proc
    ensure_cloudflared()
    if not os.path.exists(CLOUDFLARED_PATH):
        print("[!] cloudflared.exe not found at", CLOUDFLARED_PATH)
        return

    cfg = load_tunnel_config()
    token = cfg.get("cloudflare_tunnel_token") or os.environ.get("CLOUDFLARE_TUNNEL_TOKEN", "").strip()
    static_url = cfg.get("static_domain") or os.environ.get("STATIC_AUCTION_URL", "").strip()

    if token:
        # Static Permanent Named Tunnel Mode
        print("[+] Starting Cloudflare Named Tunnel with your permanent token...")
        cmd = [CLOUDFLARED_PATH, "tunnel", "run", "--token", token]
        tunnel_proc = subprocess.Popen(
            cmd,
            stderr=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            text=True,
            encoding="utf-8",
            errors="replace"
        )
        
        display_url = static_url if static_url else "https://your-custom-domain.com"
        if not display_url.startswith("http"):
            display_url = f"https://{display_url}"
        display_url = display_url.rstrip("/")

        os.environ["PUBLIC_TUNNEL_URL"] = display_url
        try:
            with open(TUNNEL_FILE, "w", encoding="utf-8") as f:
                f.write(display_url)
        except:
            pass

        full_bidder_url = f"{display_url}/bidder"
        print("\n" + "=" * 72)
        print("  [+] YOUR PERMANENT STATIC ONLINE LINK FOR ALL AUCTIONS:")
        print(f"  --> {full_bidder_url}")
        print("=" * 72)
        print("  (This link NEVER changes! Friends can bookmark it forever!)")
        print("=" * 72 + "\n")
        return

    # Ephemeral Quick Tunnel Mode (trycloudflare.com)
    cmd = [CLOUDFLARED_PATH, "tunnel", "--url", f"http://127.0.0.1:{port}"]
    tunnel_proc = subprocess.Popen(
        cmd,
        stderr=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        text=True,
        encoding="utf-8",
        errors="replace"
    )

    for line in iter(tunnel_proc.stderr.readline, ''):
        match = re.search(r'(https://[a-zA-Z0-9-]+\.trycloudflare\.com)', line)
        if match:
            tunnel_url = match.group(1)
            os.environ["PUBLIC_TUNNEL_URL"] = tunnel_url
            try:
                with open(TUNNEL_FILE, "w", encoding="utf-8") as f:
                    f.write(tunnel_url)
                    f.flush()
            except:
                pass

            tunnel_ready_event.set()

            full_bidder_url = f"{tunnel_url}/bidder"
            print("\n" + "=" * 72)
            print("  [+] YOUR REAL ONLINE LINK FOR FRIENDS IN OTHER CITIES:")
            print(f"  --> {full_bidder_url}")
            print("=" * 72)
            print("  (Send this link to your friends so they can bid from their phones!)")
            print("=" * 72 + "\n")
            break

def main():
    print("=" * 72)
    print("       FIFA 19 MULTI-CITY LIVE AUCTION ARENA (ONLINE MODE)")
    print("=" * 72)
    print("1. Starting local auction server on port 8000...")
    print("2. Connecting Cloudflare to generate your free online link...\n")

    # Start tunnel in background thread
    tunnel_thread = threading.Thread(target=run_tunnel, daemon=True)
    tunnel_thread.start()

    from app import app

    def open_browser():
        # Wait up to 7.5s for Cloudflare tunnel to establish so Connect Friends modal has live link instantly
        tunnel_ready_event.wait(timeout=7.5)
        time.sleep(0.8)
        webbrowser.open("http://localhost:8000")

    threading.Thread(target=open_browser, daemon=True).start()

    print("-----------------------------------------------------------------")
    print("  HOST MAIN SCREEN (Keep open on your laptop/PC):")
    print("  -> http://localhost:8000")
    print("-----------------------------------------------------------------\n")

    try:
        app.run(host="0.0.0.0", port=8000, debug=False)
    finally:
        if tunnel_proc:
            try: tunnel_proc.terminate()
            except: pass

if __name__ == "__main__":
    main()
