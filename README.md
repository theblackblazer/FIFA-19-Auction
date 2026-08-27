# ⚽ FIFA 19 Live Auction Arena & Player Explorer

[![Python](https://img.shields.io/badge/Python-3.8%2B-blue.svg?logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Backend-Flask-000000.svg?logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![Tailwind CSS](https://img.shields.io/badge/Frontend-Tailwind_CSS-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/Database-SQLite3-003B57.svg?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Cloudflare](https://img.shields.io/badge/Multi--City-Cloudflare_Tunnel-F38020.svg?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> A full-stack, real-time multiplayer football auction application with multi-city mobile bidding, FIFA Ultimate Team (FUT) player explorer, tactical pitch lineup manager, dynamic club logos generator, and budget quota enforcement.

---

## 🌟 Highlights & Key Features

### 1. 🔍 FUT Player Explorer & Database
- **18,000+ Real Players**: Full FIFA 19 roster with real player photos, club crests, national flags, and in-depth ratings.
- **Detailed Attribute Radar**: PAC, SHO, PAS, DRI, DEF, PHY, weak foot, skill moves, work rates, and physical bio.
- **Specific Position Filters**: Filter by exact positions (`LB`, `RB`, `CB`, `CAM`, `CM`, `CDM`, `ST`, `RW`, `LW`, `GK`) or categories (`FWD`, `MID`, `DEF`, `GK`).
- **Dynamic Golden Cards**: Players rated 90+ automatically display glowing 24K gold Ultimate Team foil styling with position badges.

### 2. 🏆 Live Broadcast Auction Arena
- **Nomination Pools**: 1-click nomination presets for *Class of Icons*, *Wonderkids Under 21*, *85+ Elite Stars*, *Midfield Generals*, *Defensive Walls*, and *Free Agents*.
- **Live Countdown Timer & Audio FX**: Server-synced stage countdown timer with sound effects, gavel hammer strikes, and winner confetti explosions.
- **3-Second Nomination Preparation Buffer**: 3-second preview phase upon nomination allowing bidders to review player stats before bidding opens.
- **Audit Ledger & History**: Real-time bid log tracking raises, timestamps, sequence numbers, outbid states, and transfer summaries.

### 3. 📱 Mobile Remote Bidding & Multi-City Online Play
- **Zero-Install Mobile Remote**: Friends can scan a QR code from the host screen and participate from their phone's browser.
- **Built-in Cloudflare Tunnel**: Generates a public HTTPS link allowing friends in other cities to join without port forwarding or VPNs.
- **Haptic Feedback & Fast Taps**: Big touch-friendly buttons (`+₹10`, `+₹25`, `+₹50`, `+₹100`, Custom Bid) with tactile vibration.
- **⚡ Instant Outbid Notifications**: Mobile remote instantly alerts you with haptic vibration when a rival outbids you.

### 4. 🛡️ Dynamic Clubs & Vector Crest Generator
- **Custom Club Studio**: Bidders can create their own club name (e.g. *London Lions*, *Bengaluru Blasters*) and manager nickname on the fly.
- **Procedural SVG Logo Generator**: Generates high-definition vector crests with custom initial monograms, heraldic emblems (Crown, Lion, Eagle, Lightning, Ball, Star, Dragon, Flame), and rich color palettes.
- **Dynamic Manager Grid**: Automatically scales from 2 to $N$ managers with real-time state synchronization.

### 5. 👑 Fair Play Rules & Squad Quota Engine
- **Leader Lock (No Consecutive Bids)**: The current highest bidder cannot bid against themselves; bidding is unlocked only when outbid by a rival.
- **18-Player Squad Rule**: Every manager must build a squad of 18 players. The engine calculates `Max Allowable Bid = Budget - (Remaining Slots × ₹50)` to ensure managers never run out of funds to complete their squad.

### 6. 🏟️ Tactical Soccer Pitch & Formation Hub
- **7 Tactical Formations**: `4-3-3 Attack`, `4-2-3-1`, `4-4-2`, `4-1-2-1-2 Diamond`, `3-5-2`, `4-3-2-1`, and `5-3-2`.
- **Auto-Fill Starting XI**: 1-click optimizer that assigns acquired players to their ideal positions based on ratings and position suitability.
- **Drag-and-Drop & Bench Swap**: Swap players between pitch slots and the substitute bench.

---

## 🚀 Quick Start Guide

### Prerequisites
- [Python 3.8 or higher](https://www.python.org/downloads/)
- [Git](https://git-scm.com/downloads)

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/fifa19-live-auction.git
cd fifa19-live-auction
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Run the Application

#### Option A: Local / LAN Mode (Same Wi-Fi)
- **Windows**: Double-click `run_app.bat`
- **Terminal**:
  ```bash
  python start.py
  ```
- Open [http://localhost:8000](http://localhost:8000) on your desktop/laptop.
- Mobile devices on the same Wi-Fi can connect via `http://<YOUR_LOCAL_IP>:8000/bidder`.

#### Option B: Multi-City Online Mode (Play with Friends Anywhere)
- **Windows**: Double-click `run_online.bat`
- **Terminal**:
  ```bash
  python start_online.py
  ```
- The app will automatically initialize a secure Cloudflare tunnel and generate a public HTTPS link.
- Display the QR code on your host screen or share the link with friends!

---

## 📂 Project Architecture

```
FIFA 19 Auction/
├── backend/
│   ├── app.py                   # Main Flask REST API & Auction WebSockets/SSE engine
│   ├── crest_generator.py       # Python SVG vector club crest generator
│   └── fifa19.db                # SQLite database with 18,000+ players & auction state
├── frontend/
│   ├── index.html               # Desktop Host Broadcast Arena & Manager Hub
│   ├── bidder.html              # Mobile Remote Bidder Interface & Club Studio
│   ├── css/
│   │   └── styles.css           # FUT card styling, glow effects, pitch layout
│   └── js/
│       ├── app.js               # Desktop Arena frontend controller
│       └── crest_generator.js   # Client-side live SVG crest renderer
├── data/                        # Player metadata, images cache, and CSV datasets
├── start.py                     # Local server launcher
├── start_online.py              # Online Multi-City launcher (with Cloudflare Tunnel)
├── run_app.bat                  # 1-click Windows launcher (Local)
├── run_online.bat               # 1-click Windows launcher (Online)
├── requirements.txt             # Python package dependencies
├── .gitignore                   # Git ignore patterns
└── README.md                    # Project documentation
```

---

## 🛠️ Technology Stack

- **Backend**: Python 3, Flask, SQLite3, Subprocess Tunnel Management
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, Tailwind CSS, Font Awesome
- **Graphics & Visuals**: Inline SVG Crest Generation, HTML5 Canvas Confetti, Chart.js (Radar Charts)
- **Networking**: Cloudflare Quick Tunnels, REST APIs, Polling & Long-Polling Fallback

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/YOUR_USERNAME/fifa19-live-auction/issues).

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
