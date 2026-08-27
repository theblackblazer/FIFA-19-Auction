import os
import sys
import webbrowser
import threading
import time

# Ensure backend path is in sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from app import app

def open_browser():
    time.sleep(1.2)
    print("Opening web browser at http://localhost:8000 ...")
    webbrowser.open("http://localhost:8000")

if __name__ == "__main__":
    print("=" * 60)
    print("      FIFA 19 PLAYER EXPLORER & LIVE AUCTION ARENA      ")
    print("=" * 60)
    print("Starting server at: http://localhost:8000")
    print("Press Ctrl+C to stop the server.\n")

    threading.Thread(target=open_browser, daemon=True).start()
    app.run(host="0.0.0.0", port=8000, debug=False)
