import os
import sys
import sqlite3
import json
import time
import urllib.request
from flask import Flask, request, jsonify, send_from_directory, Response, send_file

from crest_generator import generate_crest_svg, COLOR_PALETTES, EMBLEM_ICONS, get_club_initials

app = Flask(__name__, static_folder="../frontend", static_url_path="")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "backend", "fifa19.db")
CACHE_DIR = os.path.join(BASE_DIR, "data", "images_cache")
os.makedirs(CACHE_DIR, exist_ok=True)

DEFAULT_PLAYER_SVG = os.path.join(BASE_DIR, "frontend", "assets", "default_player.svg")
DEFAULT_CLUB_SVG = os.path.join(BASE_DIR, "frontend", "assets", "default_club.svg")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def ensure_db_schema():
    conn = get_db()
    cursor = conn.cursor()
    
    # State table columns
    state_cols_to_add = [
        ("timer_end_timestamp", "REAL"),
        ("last_unsold_player_id", "INTEGER"),
        ("last_unsold_player_name", "TEXT"),
        ("last_unsold_player_photo", "TEXT"),
        ("last_unsold_timestamp", "REAL")
    ]
    for col_name, col_type in state_cols_to_add:
        try:
            cursor.execute(f"ALTER TABLE auction_state ADD COLUMN {col_name} {col_type}")
        except Exception:
            pass

    # Managers table columns for custom crests and dynamic teams
    mgr_cols_to_add = [
        ("crest_svg", "TEXT"),
        ("emblem", "TEXT"),
        ("crest_color", "TEXT"),
        ("manager_name", "TEXT"),
        ("is_custom", "INTEGER DEFAULT 0")
    ]
    for col_name, col_type in mgr_cols_to_add:
        try:
            cursor.execute(f"ALTER TABLE auction_managers ADD COLUMN {col_name} {col_type}")
        except Exception:
            pass

    # Populate crest_svg for any existing managers missing it
    cursor.execute("SELECT * FROM auction_managers")
    for row in cursor.fetchall():
        d = dict(row)
        if not d.get("crest_svg"):
            color = d.get("crest_color") or ("gold" if "Galácticos" in d["name"] else "red" if "Red" in d["name"] else "blue" if "Blaugrana" in d["name"] else "emerald")
            emblem = d.get("emblem") or ("crown" if "Galácticos" in d["name"] else "flame" if "Red" in d["name"] else "shield" if "Blaugrana" in d["name"] else "lion")
            svg = generate_crest_svg(d["name"], color, emblem)
            cursor.execute("""
                UPDATE auction_managers
                SET crest_svg = ?, emblem = ?, crest_color = ?
                WHERE id = ?
            """, (svg, emblem, color, d["id"]))

    conn.commit()
    conn.close()

ensure_db_schema()

@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")

@app.route("/bidder")
def bidder_mobile():
    return send_from_directory(app.static_folder, "bidder.html")

# ----------------- FIFA 19 PLAYER SPECIALITIES ENGINE -----------------

def compute_player_specialities(p):
    if not p:
        return []
    
    specs = []
    
    acc = p.get("acceleration") or 0
    spd = p.get("sprint_speed") or 0
    dri = p.get("dribbling") or 0
    agi = p.get("agility") or 0
    bal = p.get("balance") or 0
    rea = p.get("reactions") or 0
    com = p.get("composure") or 0
    pos = p.get("positioning") or 0
    fin = p.get("finishing") or 0
    shp = p.get("shot_power") or 0
    lgs = p.get("long_shots") or 0
    vol = p.get("volleys") or 0
    pen = p.get("penalties") or 0
    vis = p.get("vision") or 0
    cro = p.get("crossing") or 0
    fka = p.get("free_kick_accuracy") or 0
    spa = p.get("short_passing") or 0
    lpa = p.get("long_passing") or 0
    cur = p.get("curve") or 0
    itc = p.get("interceptions") or 0
    hea = p.get("heading_accuracy") or 0
    mrk = p.get("marking") or 0
    stt = p.get("standing_tackle") or 0
    slt = p.get("sliding_tackle") or 0
    jmp = p.get("jumping") or 0
    sta = p.get("stamina") or 0
    str_ = p.get("strength") or 0
    agg = p.get("aggression") or 0
    ht = p.get("height_cm") or 180
    wt = p.get("weight_kg") or 75
    skills = p.get("skill_moves") or 3
    position = (p.get("position") or "").upper()

    gkd = p.get("gk_diving") or 0
    gkh = p.get("gk_handling") or 0
    gkk = p.get("gk_kicking") or 0
    gkp = p.get("gk_positioning") or 0
    gkr = p.get("gk_reflexes") or 0

    if position == "GK":
        if gkd >= 86 and gkr >= 86:
            specs.append({"name": "Acrobatic GK", "icon": "fa-shield-cat", "color": "amber", "desc": "Spectacular diving & reflex shot-stopping"})
        if gkp >= 86 and gkh >= 86:
            specs.append({"name": "Traditional GK", "icon": "fa-hands", "color": "blue", "desc": "Commanding aerial handling and positional discipline"})
        return specs

    # 1. Speedster
    if (acc + spd) >= 180:
        specs.append({"name": "Speedster", "icon": "fa-bolt", "color": "amber", "desc": "Lightning pace & acceleration"})

    # 2. Dribbler
    if (dri >= 86 and agi >= 75) or (skills >= 5 and dri >= 85):
        specs.append({"name": "Dribbler", "icon": "fa-wand-magic-sparkles", "color": "purple", "desc": "Elite ball control & agility"})

    # 3. Distance Shooter
    if lgs >= 86 and shp >= 86:
        specs.append({"name": "Distance Shooter", "icon": "fa-bullseye", "color": "rose", "desc": "Lethal long-range shooting power"})

    # 4. Playmaker
    if vis >= 86 and spa >= 86 and lpa >= 73:
        specs.append({"name": "Playmaker", "icon": "fa-brain", "color": "blue", "desc": "Master of vision and chance creation"})

    # 5. Crosser
    if cro >= 86 and cur >= 80:
        specs.append({"name": "Crosser", "icon": "fa-share-nodes", "color": "cyan", "desc": "Pinpoint wing delivery & curve"})

    # 6. Free Kick Specialist
    if fka >= 86 and (cur >= 85 or shp >= 85):
        specs.append({"name": "FK Specialist", "icon": "fa-futbol", "color": "emerald", "desc": "Deadly set-piece precision"})

    # 7. Poacher
    if (fin >= 85 and hea >= 85 and pos >= 85) or (fin >= 88 and pos >= 88):
        specs.append({"name": "Poacher", "icon": "fa-crosshairs", "color": "red", "desc": "Instinctual predator in the 18-yard box"})

    # 8. Clinical Finisher
    if fin >= 86 and lgs >= 80:
        specs.append({"name": "Clinical Finisher", "icon": "fa-fire", "color": "orange", "desc": "Ruthless accuracy in front of goal"})

    # 9. Aerial Threat
    if (hea >= 90 and (jmp >= 85 or ht >= 188)) or (hea >= 86 and ht >= 185 and jmp >= 80):
        specs.append({"name": "Aerial Threat", "icon": "fa-plane-departure", "color": "sky", "desc": "Dominant in the air with towering leap"})

    # 10. Tackling
    if stt >= 86 and slt >= 85:
        specs.append({"name": "Tackling", "icon": "fa-shield-halved", "color": "indigo", "desc": "Rock-solid tackling efficiency"})

    # 11. Tactician
    if itc >= 86 and rea >= 80:
        specs.append({"name": "Tactician", "icon": "fa-compass", "color": "teal", "desc": "Anticipates play with elite interceptions"})

    # 12. Strength
    if (str_ >= 86 and wt >= 83) or str_ >= 90:
        specs.append({"name": "Strength", "icon": "fa-dumbbell", "color": "amber", "desc": "Physical powerhouse"})

    # 13. Acrobat
    if (agi >= 90 and rea >= 80) or (agi >= 86 and jmp >= 86):
        specs.append({"name": "Acrobat", "icon": "fa-person-running", "color": "fuchsia", "desc": "Extreme agility & body control"})

    # 14. Engine
    if sta >= 88 and (agi >= 70 or spa >= 75):
        specs.append({"name": "Engine", "icon": "fa-gauge-high", "color": "lime", "desc": "High stamina covering full pitch"})

    spec_names = {s["name"] for s in specs}

    # 15. Complete Forward
    if ("Poacher" in spec_names or "Clinical Finisher" in spec_names) and len(spec_names.intersection({"Speedster", "Dribbler", "Aerial Threat", "Distance Shooter", "Strength", "Acrobat"})) >= 2:
        specs.insert(0, {"name": "Complete Forward", "icon": "fa-crown", "color": "yellow", "desc": "Ultimate all-round attacking superstar"})

    # 16. Complete Midfielder
    if "Playmaker" in spec_names and len(spec_names.intersection({"Distance Shooter", "Engine", "Dribbler", "Crosser", "FK Specialist", "Tackling", "Tactician"})) >= 2:
        specs.insert(0, {"name": "Complete Midfielder", "icon": "fa-crown", "color": "yellow", "desc": "Dominates both attack and midfield control"})

    # 17. Complete Defender
    if "Tackling" in spec_names and "Tactician" in spec_names and len(spec_names.intersection({"Aerial Threat", "Strength", "Speedster"})) >= 1:
        specs.insert(0, {"name": "Complete Defender", "icon": "fa-crown", "color": "yellow", "desc": "World-class defensive rock"})

    return specs

@app.route("/api/host_info")
def get_host_info():
    import socket
    local_ip = "127.0.0.1"
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except Exception:
        pass
        
    port = int(os.environ.get("PORT", 8000))
    tunnel_url = os.environ.get("PUBLIC_TUNNEL_URL", "")
    
    tunnel_file = os.path.join(BASE_DIR, "data", "tunnel_url.txt")
    if os.path.exists(tunnel_file):
        try:
            with open(tunnel_file, "r") as f:
                t = f.read().strip()
                if t.startswith("http"):
                    tunnel_url = t
        except Exception:
            pass

    # Detect if app is accessed via public domain (PythonAnywhere, Render, Heroku, or custom domain)
    req_host = request.headers.get("X-Forwarded-Host") or request.headers.get("Host") or request.host or ""
    req_proto = request.headers.get("X-Forwarded-Proto") or request.scheme or "http"
    is_public_cloud = False
    public_hosted_url = ""

    if req_host:
        host_lower = req_host.split(":")[0].lower()
        # Exclude local addresses
        is_local_addr = (
            host_lower == "localhost" or 
            host_lower == "127.0.0.1" or 
            host_lower.startswith("192.168.") or 
            host_lower.startswith("10.") or 
            (host_lower.startswith("172.") and host_lower.split(".")[1].isdigit() and 16 <= int(host_lower.split(".")[1]) <= 31)
        )
        if not is_local_addr:
            is_public_cloud = True
            public_hosted_url = f"{req_proto}://{req_host}".rstrip("/")

    if is_public_cloud:
        tunnel_url = public_hosted_url
    
    if tunnel_url:
        tunnel_url = tunnel_url.rstrip("/")

    return jsonify({
        "local_ip": local_ip,
        "port": port,
        "local_bidder_url": f"http://{local_ip}:{port}/bidder",
        "public_tunnel_url": tunnel_url,
        "public_bidder_url": f"{tunnel_url}/bidder" if tunnel_url else "",
        "is_tunnel_active": bool(tunnel_url),
        "is_public_cloud": is_public_cloud,
        "public_hosted_url": public_hosted_url
    })

@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(app.static_folder, path)

# ----------------- IMAGE PROXY & CACHE (ZERO FLICKER) -----------------

@app.route("/api/player_image/<int:player_id>")
def get_player_image(player_id):
    cached_file = os.path.join(CACHE_DIR, f"player_{player_id}.png")
    if os.path.exists(cached_file):
        return send_file(cached_file, mimetype="image/png", max_age=86400)

    # Format 6-digit padded ID for SoFIFA path (e.g. 158023 -> 158/023)
    id_str = f"{player_id:06d}"
    part1, part2 = id_str[:3], id_str[3:]
    
    urls_to_try = [
        f"https://cdn.sofifa.net/players/{part1}/{part2}/19_120.png",
        f"https://cdn.sofifa.net/players/{part1}/{part2}/19_240.png",
        f"https://cdn.sofifa.net/players/{part1}/{part2}/18_120.png",
        f"https://cdn.sofifa.net/players/{part1}/{part2}/20_120.png",
        f"https://cdn.sofifa.net/players/{part1}/{part2}/24_120.png"
    ]

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Referer": "https://sofifa.com/"
    }

    for url in urls_to_try:
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=2.5) as resp:
                if resp.status == 200:
                    data = resp.read()
                    if len(data) > 300: # Valid image
                        with open(cached_file, "wb") as f:
                            f.write(data)
                        return Response(data, mimetype="image/png", headers={"Cache-Control": "public, max-age=86400"})
        except Exception:
            continue

    # Fallback to local default player SVG
    if os.path.exists(DEFAULT_PLAYER_SVG):
        return send_file(DEFAULT_PLAYER_SVG, mimetype="image/svg+xml")
    return jsonify({"error": "Image not found"}), 404

@app.route("/api/team_image/<int:team_id>")
def get_team_image(team_id):
    if team_id <= 0:
        if os.path.exists(DEFAULT_CLUB_SVG):
            return send_file(DEFAULT_CLUB_SVG, mimetype="image/svg+xml")
        return jsonify({"error": "No team"}), 404
        
    cached_file = os.path.join(CACHE_DIR, f"team_{team_id}.png")
    if os.path.exists(cached_file):
        return send_file(cached_file, mimetype="image/png", max_age=86400)

    url = f"https://cdn.sofifa.net/teams/{team_id}/60.png"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Referer": "https://sofifa.com/"
    }

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=2.5) as resp:
            if resp.status == 200:
                data = resp.read()
                if len(data) > 200:
                    with open(cached_file, "wb") as f:
                        f.write(data)
                    return Response(data, mimetype="image/png", headers={"Cache-Control": "public, max-age=86400"})
    except Exception:
        pass

    if os.path.exists(DEFAULT_CLUB_SVG):
        return send_file(DEFAULT_CLUB_SVG, mimetype="image/svg+xml")
    return jsonify({"error": "Image not found"}), 404

# ----------------- PLAYERS API -----------------

@app.route("/api/players", methods=["GET"])
def get_players():
    search = request.args.get("search", "").strip()
    position = request.args.get("position", "").strip().upper()
    pos_cat = request.args.get("pos_cat", "").strip().upper()
    club = request.args.get("club", "").strip()
    nationality = request.args.get("nationality", "").strip()
    
    min_ovr = int(request.args.get("min_ovr", 40))
    max_ovr = int(request.args.get("max_ovr", 99))
    min_pot = int(request.args.get("min_pot", 40))
    max_pot = int(request.args.get("max_pot", 99))
    
    min_pac = int(request.args.get("min_pac", 0))
    min_sho = int(request.args.get("min_sho", 0))
    min_pas = int(request.args.get("min_pas", 0))
    min_dri = int(request.args.get("min_dri", 0))
    min_def = int(request.args.get("min_def", 0))
    min_phy = int(request.args.get("min_phy", 0))
    
    sort_by = request.args.get("sort_by", "overall_rating")
    order = request.args.get("order", "desc").upper()
    if order not in ["ASC", "DESC"]:
        order = "DESC"
    
    allowed_sorts = {
        "overall_rating": "overall_rating",
        "potential": "potential",
        "name": "name",
        "age": "age",
        "card_pac": "card_pac",
        "card_sho": "card_sho",
        "card_pas": "card_pas",
        "card_dri": "card_dri",
        "card_def": "card_def",
        "card_phy": "card_phy",
        "value_eur": "value_eur",
        "base_price": "base_price"
    }
    sort_col = allowed_sorts.get(sort_by, "overall_rating")
    
    page = max(1, int(request.args.get("page", 1)))
    limit = min(100, max(1, int(request.args.get("limit", 24))))
    offset = (page - 1) * limit
    
    query = """
        SELECT p.*, 
               r.id as roster_id, 
               r.bought_price as sold_price,
               m.name as sold_to_manager_name,
               m.avatar as sold_to_manager_avatar,
               m.color as sold_to_manager_color,
               m.id as sold_to_manager_id
        FROM players p
        LEFT JOIN auction_roster r ON p.id = r.player_id
        LEFT JOIN auction_managers m ON r.manager_id = m.id
        WHERE p.overall_rating BETWEEN ? AND ? AND p.potential BETWEEN ? AND ?
    """
    params = [min_ovr, max_ovr, min_pot, max_pot]
    
    if search:
        query += " AND (p.name LIKE ? OR p.club_name LIKE ? OR p.nationality LIKE ?)"
        like_term = f"%{search}%"
        params.extend([like_term, like_term, like_term])
        
    if position:
        query += " AND p.position = ?"
        params.append(position)
        
    if pos_cat:
        query += " AND p.position_category = ?"
        params.append(pos_cat)
        
    if club:
        query += " AND p.club_name = ?"
        params.append(club)
        
    if nationality:
        query += " AND p.nationality = ?"
        params.append(nationality)
        
    if min_pac > 0:
        query += " AND p.card_pac >= ?"
        params.append(min_pac)
    if min_sho > 0:
        query += " AND p.card_sho >= ?"
        params.append(min_sho)
    if min_pas > 0:
        query += " AND p.card_pas >= ?"
        params.append(min_pas)
    if min_dri > 0:
        query += " AND p.card_dri >= ?"
        params.append(min_dri)
    if min_def > 0:
        query += " AND p.card_def >= ?"
        params.append(min_def)
    if min_phy > 0:
        query += " AND p.card_phy >= ?"
        params.append(min_phy)
        
    # Count total
    count_query = "SELECT COUNT(*) FROM players p WHERE p.overall_rating BETWEEN ? AND ? AND p.potential BETWEEN ? AND ?"
    count_params = [min_ovr, max_ovr, min_pot, max_pot]
    if search:
        count_query += " AND (p.name LIKE ? OR p.club_name LIKE ? OR p.nationality LIKE ?)"
        count_params.extend([like_term, like_term, like_term])
    if position:
        count_query += " AND p.position = ?"
        count_params.append(position)
    if pos_cat:
        count_query += " AND p.position_category = ?"
        count_params.append(pos_cat)
    if club:
        count_query += " AND p.club_name = ?"
        count_params.append(club)
    if nationality:
        count_query += " AND p.nationality = ?"
        count_params.append(nationality)
    if min_pac > 0:
        count_query += " AND p.card_pac >= ?"
        count_params.append(min_pac)
    if min_sho > 0:
        count_query += " AND p.card_sho >= ?"
        count_params.append(min_sho)
    if min_pas > 0:
        count_query += " AND p.card_pas >= ?"
        count_params.append(min_pas)
    if min_dri > 0:
        count_query += " AND p.card_dri >= ?"
        count_params.append(min_dri)
    if min_def > 0:
        count_query += " AND p.card_def >= ?"
        count_params.append(min_def)
    if min_phy > 0:
        count_query += " AND p.card_phy >= ?"
        count_params.append(min_phy)
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(count_query, count_params)
    total_count = cursor.fetchone()[0]
    
    # Query data
    query += f" ORDER BY p.{sort_col} {order}, p.potential DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    players = []
    for row in rows:
        d = dict(row)
        d["is_sold"] = bool(d.get("roster_id"))
        d["photo_url"] = f"/api/player_image/{d['id']}"
        d["club_logo_url"] = f"/api/team_image/{d['club_id']}" if d.get("club_id") else "/assets/default_club.svg"
        players.append(d)
        
    conn.close()
    
    return jsonify({
        "players": players,
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": (total_count + limit - 1) // limit
    })

@app.route("/api/players/<int:player_id>", methods=["GET"])
def get_player_detail(player_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT p.*, 
               r.id as roster_id, 
               r.bought_price as sold_price,
               m.name as sold_to_manager_name,
               m.avatar as sold_to_manager_avatar,
               m.color as sold_to_manager_color,
               m.id as sold_to_manager_id
        FROM players p
        LEFT JOIN auction_roster r ON p.id = r.player_id
        LEFT JOIN auction_managers m ON r.manager_id = m.id
        WHERE p.id = ?
    """, (player_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return jsonify({"error": "Player not found"}), 404
        
    d = dict(row)
    d["is_sold"] = bool(d.get("roster_id"))
    d["photo_url"] = f"/api/player_image/{d['id']}"
    d["club_logo_url"] = f"/api/team_image/{d['club_id']}" if d.get("club_id") else "/assets/default_club.svg"
    d["specialities"] = compute_player_specialities(d)
    return jsonify(d)

# ----------------- FILTER AUTOCOMPLETES -----------------

@app.route("/api/filters", methods=["GET"])
def get_filters():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT DISTINCT club_name FROM players WHERE club_name != '' AND club_name != 'Free Agent' ORDER BY club_name ASC")
    clubs = [r[0] for r in cursor.fetchall()]
    
    cursor.execute("SELECT DISTINCT nationality FROM players WHERE nationality != '' ORDER BY nationality ASC")
    nationalities = [r[0] for r in cursor.fetchall()]
    
    cursor.execute("SELECT DISTINCT position FROM players WHERE position != '' ORDER BY position ASC")
    positions = [r[0] for r in cursor.fetchall()]
    
    conn.close()
    return jsonify({
        "clubs": clubs,
        "nationalities": nationalities,
        "positions": positions
    })

# ----------------- TEAMS API -----------------

@app.route("/api/teams", methods=["GET"])
def get_teams():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM teams WHERE overall_rating > 0 ORDER BY overall_rating DESC")
    teams = []
    for r in cursor.fetchall():
        d = dict(r)
        d["logo_url"] = f"/api/team_image/{d['id']}"
        teams.append(d)
    conn.close()
    return jsonify({"teams": teams})

# ----------------- TEAM CLAIMS MANAGEMENT -----------------
# ----------------- CLUB CREST & DYNAMIC MANAGER ENDPOINTS -----------------

@app.route("/api/manager_crest/<manager_id>")
def get_manager_crest(manager_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM auction_managers WHERE id = ?", (manager_id,))
    row = cursor.fetchone()
    conn.close()
    
    mgr = dict(row) if row else None
    if mgr and mgr.get("crest_svg"):
        return Response(mgr["crest_svg"], mimetype="image/svg+xml")
        
    name = mgr["name"] if mgr else "Club FC"
    color = (mgr.get("crest_color") if mgr else None) or "gold"
    emblem = (mgr.get("emblem") if mgr else None) or "crown"
    svg = generate_crest_svg(name, color, emblem)
    return Response(svg, mimetype="image/svg+xml")

@app.route("/api/generate_crest", methods=["GET"])
def preview_crest_endpoint():
    name = request.args.get("name", "Royal Strikers FC")
    color = request.args.get("color", "gold")
    emblem = request.args.get("emblem", "crown")
    svg = generate_crest_svg(name, color, emblem)
    return Response(svg, mimetype="image/svg+xml")

@app.route("/api/managers", methods=["GET"])
def get_managers_list():
    clean_expired_claims()
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM auction_managers ORDER BY spent DESC, budget DESC")
    rows = [dict(r) for r in cursor.fetchall()]
    
    for mgr in rows:
        cursor.execute("SELECT COUNT(*) FROM auction_roster WHERE manager_id = ?", (mgr["id"],))
        mgr["player_count"] = cursor.fetchone()[0]
        mgr["crest_url"] = f"/api/manager_crest/{mgr['id']}"
        claim = CLAIMED_TEAMS.get(mgr["id"])
        mgr["is_claimed"] = bool(claim)
        mgr["claimed_by"] = claim.get("client_name") if claim else None
        mgr["claimed_client_id"] = claim.get("client_id") if claim else None
    
    conn.close()
    return jsonify({"managers": rows, "total": len(rows)})

@app.route("/api/managers", methods=["POST"])
def create_manager():
    data = request.json or {}
    name = data.get("name", "New Club FC").strip() or "New Club FC"
    manager_name = data.get("manager_name", "").strip()
    color = (data.get("crest_color") or data.get("color") or "gold").lower()
    emblem = (data.get("emblem") or "crown").lower()
    initial_budget = int(data.get("initial_budget") or 1500)
    
    mgr_id = f"mgr_{int(time.time() * 1000) % 10000000}_{os.urandom(2).hex()}"
    svg = generate_crest_svg(name, color, emblem)
    avatar = EMBLEM_ICONS.get(emblem, "👑")
    
    palette = COLOR_PALETTES.get(color, COLOR_PALETTES["gold"])
    theme_color = palette["gradient"][1]
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO auction_managers (id, name, avatar, color, initial_budget, budget, spent, crest_svg, emblem, crest_color, manager_name, is_custom)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 1)
    """, (mgr_id, name, avatar, theme_color, initial_budget, initial_budget, svg, emblem, color, manager_name))
    conn.commit()
    conn.close()
    
    return jsonify({
        "success": True,
        "manager_id": mgr_id,
        "name": name,
        "crest_url": f"/api/manager_crest/{mgr_id}",
        "message": f"Club {name} created successfully!"
    })

@app.route("/api/managers/<manager_id>", methods=["PUT"])
def update_manager(manager_id):
    data = request.json or {}
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM auction_managers WHERE id = ?", (manager_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Manager not found"}), 404
    mgr = dict(row)
        
    name = data.get("name", mgr["name"]).strip()
    manager_name = data.get("manager_name", mgr.get("manager_name") or "").strip()
    color = (data.get("crest_color") or data.get("color") or mgr.get("crest_color") or "gold").lower()
    emblem = (data.get("emblem") or mgr.get("emblem") or "crown").lower()
    
    svg = generate_crest_svg(name, color, emblem)
    avatar = EMBLEM_ICONS.get(emblem, mgr["avatar"])
    palette = COLOR_PALETTES.get(color, COLOR_PALETTES["gold"])
    theme_color = palette["gradient"][1]
    
    cursor.execute("""
        UPDATE auction_managers
        SET name = ?, avatar = ?, color = ?, crest_svg = ?, emblem = ?, crest_color = ?, manager_name = ?
        WHERE id = ?
    """, (name, avatar, theme_color, svg, emblem, color, manager_name, manager_id))
    conn.commit()
    conn.close()
    
    return jsonify({
        "success": True,
        "manager_id": manager_id,
        "name": name,
        "crest_url": f"/api/manager_crest/{manager_id}",
        "message": f"Club {name} updated successfully!"
    })

@app.route("/api/managers/<manager_id>", methods=["DELETE"])
def delete_manager(manager_id):
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if manager has bought players
    cursor.execute("SELECT COUNT(*) FROM auction_roster WHERE manager_id = ?", (manager_id,))
    count = cursor.fetchone()[0]
    if count > 0:
        conn.close()
        return jsonify({"error": f"Cannot delete manager with {count} acquired players. Please reset auction first."}), 400
        
    cursor.execute("DELETE FROM auction_managers WHERE id = ?", (manager_id,))
    conn.commit()
    conn.close()
    
    if manager_id in CLAIMED_TEAMS:
        del CLAIMED_TEAMS[manager_id]
        
    return jsonify({"success": True, "message": "Manager deleted successfully"})

# Format: { "mgr_1": { "client_id": "...", "client_name": "...", "claimed_at": timestamp, "last_seen": timestamp } }
CLAIMED_TEAMS = {}
CLAIM_TIMEOUT_SECONDS = 900 # 15 minutes of inactivity before auto-release

def clean_expired_claims():
    now = time.time()
    expired = [m_id for m_id, c in CLAIMED_TEAMS.items() if now - c.get("last_seen", 0) > CLAIM_TIMEOUT_SECONDS]
    for m_id in expired:
        del CLAIMED_TEAMS[m_id]

@app.route("/api/auction/claim_team", methods=["POST"])
def claim_team():
    clean_expired_claims()
    data = request.json or {}
    manager_id = data.get("manager_id")
    client_id = data.get("client_id")
    client_name = data.get("client_name", "Remote Bidder").strip() or "Remote Bidder"
    
    team_name = (data.get("team_name") or data.get("name") or "").strip()
    color = (data.get("crest_color") or data.get("color") or "gold").lower()
    emblem = (data.get("emblem") or "crown").lower()
    create_new = bool(data.get("create_new") or manager_id == "new" or (not manager_id and team_name))
    
    if not client_id:
        return jsonify({"error": "Missing client_id"}), 400
        
    conn = get_db()
    cursor = conn.cursor()
    now = time.time()
    
    # 1. CREATE NEW DYNAMIC CLUB
    if create_new:
        if not team_name:
            team_name = f"{client_name}'s FC"
            
        mgr_id = f"mgr_{int(now * 1000) % 10000000}_{client_id[-4:]}"
        svg = generate_crest_svg(team_name, color, emblem)
        avatar = EMBLEM_ICONS.get(emblem, "👑")
        palette = COLOR_PALETTES.get(color, COLOR_PALETTES["gold"])
        theme_color = palette["gradient"][1]
        
        cursor.execute("""
            INSERT INTO auction_managers (id, name, avatar, color, initial_budget, budget, spent, crest_svg, emblem, crest_color, manager_name, is_custom)
            VALUES (?, ?, ?, ?, 1500, 1500, 0, ?, ?, ?, ?, 1)
        """, (mgr_id, team_name, avatar, theme_color, svg, emblem, color, client_name))
        conn.commit()
        conn.close()
        
        # Release any old team claimed by this client
        for m_id, claim in list(CLAIMED_TEAMS.items()):
            if claim["client_id"] == client_id:
                del CLAIMED_TEAMS[m_id]
                
        CLAIMED_TEAMS[mgr_id] = {
            "client_id": client_id,
            "client_name": client_name,
            "claimed_at": now,
            "last_seen": now
        }
        
        return jsonify({
            "success": True,
            "manager_id": mgr_id,
            "manager_name": team_name,
            "manager_avatar": avatar,
            "crest_url": f"/api/manager_crest/{mgr_id}",
            "message": f"Welcome to the Arena! You created and lead {team_name}."
        })
        
    # 2. CLAIM EXISTING CLUB
    if not manager_id:
        conn.close()
        return jsonify({"error": "Missing manager_id"}), 400
        
    cursor.execute("SELECT * FROM auction_managers WHERE id = ?", (manager_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Manager team not found"}), 404
    mgr = dict(row)
        
    current_claim = CLAIMED_TEAMS.get(manager_id)
    if current_claim and current_claim["client_id"] != client_id:
        conn.close()
        return jsonify({"error": f"{mgr['name']} is already claimed by {current_claim.get('client_name', 'another bidder')}! Please pick another team."}), 409
        
    # If bidder customized the team name/crest upon claiming
    if team_name and (team_name != mgr["name"] or emblem != mgr.get("emblem") or color != mgr.get("crest_color")):
        svg = generate_crest_svg(team_name, color, emblem)
        avatar = EMBLEM_ICONS.get(emblem, mgr["avatar"])
        palette = COLOR_PALETTES.get(color, COLOR_PALETTES["gold"])
        theme_color = palette["gradient"][1]
        cursor.execute("""
            UPDATE auction_managers
            SET name = ?, avatar = ?, color = ?, crest_svg = ?, emblem = ?, crest_color = ?, manager_name = ?
            WHERE id = ?
        """, (team_name, avatar, theme_color, svg, emblem, color, client_name, manager_id))
        conn.commit()
        mgr_name = team_name
        mgr_avatar = avatar
    else:
        mgr_name = mgr["name"]
        mgr_avatar = mgr["avatar"]
        if client_name:
            cursor.execute("UPDATE auction_managers SET manager_name = ? WHERE id = ?", (client_name, manager_id))
            conn.commit()
            
    conn.close()
        
    # If client claimed a different team previously, release it
    for m_id, claim in list(CLAIMED_TEAMS.items()):
        if claim["client_id"] == client_id and m_id != manager_id:
            del CLAIMED_TEAMS[m_id]
            
    CLAIMED_TEAMS[manager_id] = {
        "client_id": client_id,
        "client_name": client_name,
        "claimed_at": now,
        "last_seen": now
    }
    
    return jsonify({
        "success": True,
        "manager_id": manager_id,
        "manager_name": mgr_name,
        "manager_avatar": mgr_avatar,
        "crest_url": f"/api/manager_crest/{manager_id}",
        "message": f"You are now managing {mgr_name}!"
    })

@app.route("/api/auction/release_team", methods=["POST"])
def release_team():
    data = request.json or {}
    manager_id = data.get("manager_id")
    client_id = data.get("client_id")
    
    if manager_id in CLAIMED_TEAMS:
        if not client_id or CLAIMED_TEAMS[manager_id]["client_id"] == client_id:
            del CLAIMED_TEAMS[manager_id]
            
    return jsonify({"success": True, "message": "Team released successfully"})

@app.route("/api/auction/heartbeat", methods=["POST"])
def bidder_heartbeat():
    data = request.json or {}
    client_id = data.get("client_id")
    if client_id:
        now = time.time()
        for m_id, claim in CLAIMED_TEAMS.items():
            if claim["client_id"] == client_id:
                claim["last_seen"] = now
    return jsonify({"success": True})

def auto_finalize_auction_if_expired(cursor, conn, state, now):
    if state and state.get("is_active") and state.get("current_player_id"):
        timer_end = state.get("timer_end_timestamp")
        if timer_end and now >= timer_end:
            player_id = state["current_player_id"]
            winner_id = state["current_bidder_id"]
            sold_price = state["current_bid"]

            cursor.execute("SELECT name, photo_url FROM players WHERE id = ?", (player_id,))
            player = cursor.fetchone()
            player_name = player["name"] if player else f"Player #{player_id}"
            player_photo = f"/api/player_image/{player_id}"

            if not winner_id:
                # Mark player as UNSOLD
                cursor.execute("""
                    UPDATE auction_state
                    SET is_active = 0, current_player_id = NULL, current_bidder_id = NULL,
                        timer_end_timestamp = 0,
                        last_unsold_player_id = ?,
                        last_unsold_player_name = ?,
                        last_unsold_player_photo = ?,
                        last_unsold_timestamp = ?
                    WHERE id = 1
                """, (player_id, player_name, player_photo, now))
                cursor.execute("""
                    INSERT INTO auction_history (player_id, manager_id, bid_amount, bid_type)
                    VALUES (?, NULL, ?, 'UNSOLD')
                """, (player_id, sold_price))
                conn.commit()
            else:
                # Mark player as SOLD to highest bidder
                cursor.execute("SELECT * FROM auction_managers WHERE id = ?", (winner_id,))
                manager = cursor.fetchone()
                if manager:
                    new_budget = manager["budget"] - sold_price
                    new_spent = manager["spent"] + sold_price

                    cursor.execute("""
                        UPDATE auction_managers
                        SET budget = ?, spent = ?
                        WHERE id = ?
                    """, (new_budget, new_spent, winner_id))

                    cursor.execute("""
                        INSERT INTO auction_roster (manager_id, player_id, bought_price)
                        VALUES (?, ?, ?)
                    """, (winner_id, player_id, sold_price))

                    cursor.execute("""
                        INSERT INTO auction_history (player_id, manager_id, bid_amount, bid_type)
                        VALUES (?, ?, ?, 'SOLD')
                    """, (player_id, winner_id, sold_price))

                    cursor.execute("""
                        UPDATE auction_state
                        SET is_active = 0, current_player_id = NULL, current_bidder_id = NULL,
                            timer_end_timestamp = 0,
                            last_sold_player_id = ?,
                            last_sold_player_name = ?,
                            last_sold_player_photo = ?,
                            last_sold_manager_id = ?,
                            last_sold_manager_name = ?,
                            last_sold_manager_avatar = ?,
                            last_sold_price = ?,
                            last_sold_timestamp = ?
                        WHERE id = 1
                    """, (player_id, player_name, player_photo, winner_id, manager["name"], manager["avatar"], sold_price, now))
                    conn.commit()

            # Re-read state
            cursor.execute("SELECT * FROM auction_state WHERE id = 1")
            state = dict(cursor.fetchone())
    return state

# ----------------- SQUAD REQUIREMENTS & MAX BID ENGINE -----------------

REQUIRED_SQUAD_SIZE = 18
MIN_PLAYER_BASE_PRICE = 50

def calculate_manager_max_bid(budget, current_squad_count):
    """
    Every manager must acquire at least REQUIRED_SQUAD_SIZE (18) players.
    When bidding on the current candidate, that counts as +1 player towards the 18.
    The manager must retain at least MIN_PLAYER_BASE_PRICE (₹50) for every remaining spot.
    remaining_slots = max(0, 18 - (current_squad_count + 1))
    reserved_budget = remaining_slots * 50
    max_bid = max(0, budget - reserved_budget)
    """
    remaining_slots = max(0, REQUIRED_SQUAD_SIZE - (current_squad_count + 1))
    reserved = remaining_slots * MIN_PLAYER_BASE_PRICE
    max_bid = max(0, budget - reserved)
    return {
        "max_bid": max_bid,
        "reserved_budget": reserved,
        "remaining_slots_needed": remaining_slots,
        "current_squad_count": current_squad_count,
        "required_squad_size": REQUIRED_SQUAD_SIZE,
        "min_player_price": MIN_PLAYER_BASE_PRICE
    }

# ----------------- AUCTION API -----------------

@app.route("/api/auction/state", methods=["GET"])
def get_auction_state():
    clean_expired_claims()
    conn = get_db()
    cursor = conn.cursor()
    
    # Get state
    cursor.execute("SELECT * FROM auction_state WHERE id = 1")
    state_row = cursor.fetchone()
    state = dict(state_row) if state_row else {
        "current_player_id": None,
        "current_bid": 0,
        "current_bidder_id": None,
        "is_active": 0,
        "timer_seconds": 20
    }
    
    # Auto-finalize if timer expired
    now = time.time()
    state = auto_finalize_auction_if_expired(cursor, conn, state, now)

    # Get current player details if nominated and active
    current_player = None
    if state.get("current_player_id") and state.get("is_active"):
        cursor.execute("SELECT * FROM players WHERE id = ?", (state["current_player_id"],))
        p_row = cursor.fetchone()
        if p_row:
            current_player = dict(p_row)
            current_player["photo_url"] = f"/api/player_image/{current_player['id']}"
            current_player["club_logo_url"] = f"/api/team_image/{current_player['club_id']}" if current_player.get("club_id") else "/assets/default_club.svg"
            current_player["specialities"] = compute_player_specialities(current_player)

    # Verify actual roster count to avoid stale last_sold at start of auction
    cursor.execute("SELECT COUNT(*) FROM auction_roster")
    total_roster_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM auction_history WHERE bid_type = 'UNSOLD'")
    total_unsold_count = cursor.fetchone()[0]

    # Last sold celebration info
    last_sold = None
    if total_roster_count > 0 and state.get("last_sold_player_id") and state.get("last_sold_price"):
        last_sold = {
            "player_id": state["last_sold_player_id"],
            "player_name": state["last_sold_player_name"],
            "player_photo": state["last_sold_player_photo"] or f"/api/player_image/{state['last_sold_player_id']}",
            "manager_id": state["last_sold_manager_id"],
            "manager_name": state["last_sold_manager_name"],
            "manager_avatar": state["last_sold_manager_avatar"],
            "price": state["last_sold_price"],
            "timestamp": state["last_sold_timestamp"]
        }

    # Last unsold info
    last_unsold = None
    if total_unsold_count > 0 and state.get("last_unsold_player_id") and state.get("last_unsold_timestamp"):
        last_unsold = {
            "player_id": state["last_unsold_player_id"],
            "player_name": state["last_unsold_player_name"],
            "player_photo": state["last_unsold_player_photo"] or f"/api/player_image/{state['last_unsold_player_id']}",
            "timestamp": state["last_unsold_timestamp"]
        }
            
    # Get all managers
    cursor.execute("SELECT * FROM auction_managers ORDER BY spent DESC, budget DESC")
    managers = [dict(r) for r in cursor.fetchall()]
    
    # Get rosters for each manager and attach claim info + max bid info
    for mgr in managers:
        cursor.execute("""
            SELECT r.id as roster_id, r.bought_price, r.timestamp, p.*
            FROM auction_roster r
            JOIN players p ON r.player_id = p.id
            WHERE r.manager_id = ?
            ORDER BY p.overall_rating DESC
        """, (mgr["id"],))
        roster_rows = []
        for row in cursor.fetchall():
            rd = dict(row)
            rd["photo_url"] = f"/api/player_image/{rd['id']}"
            rd["club_logo_url"] = f"/api/team_image/{rd['club_id']}" if rd.get("club_id") else "/assets/default_club.svg"
            roster_rows.append(rd)
            
        mgr["roster"] = roster_rows
        mgr["player_count"] = len(mgr["roster"])
        mgr["avg_rating"] = round(sum(p["overall_rating"] for p in mgr["roster"]) / max(1, len(mgr["roster"])), 1) if mgr["roster"] else 0
        mgr["crest_url"] = f"/api/manager_crest/{mgr['id']}"
        
        # Calculate Max Allowable Bid (Quota of 18 players)
        max_info = calculate_manager_max_bid(mgr["budget"], mgr["player_count"])
        mgr["max_bid"] = max_info["max_bid"]
        mgr["reserved_budget"] = max_info["reserved_budget"]
        mgr["remaining_slots_needed"] = max_info["remaining_slots_needed"]
        mgr["required_squad_size"] = REQUIRED_SQUAD_SIZE
        mgr["min_player_price"] = MIN_PLAYER_BASE_PRICE

        # Attach claim status
        claim = CLAIMED_TEAMS.get(mgr["id"])
        if claim:
            mgr["is_claimed"] = True
            mgr["claimed_by"] = claim.get("client_name", "Remote Bidder")
            mgr["claimed_client_id"] = claim.get("client_id")
        else:
            mgr["is_claimed"] = False
            mgr["claimed_by"] = None
            mgr["claimed_client_id"] = None
        
    # Get recent bid history with player details
    cursor.execute("""
        SELECT h.*, m.name as manager_name, m.avatar as manager_avatar, m.color as manager_color,
               p.name as player_name, p.position as player_pos, p.overall_rating as player_ovr
        FROM auction_history h
        LEFT JOIN auction_managers m ON h.manager_id = m.id
        LEFT JOIN players p ON h.player_id = p.id
        ORDER BY h.id DESC LIMIT 50
    """)
    history_rows = [dict(r) for r in cursor.fetchall()]
    
    # Attach claimed_by names
    for item in history_rows:
        mgr_id = item.get("manager_id")
        if mgr_id and mgr_id in CLAIMED_TEAMS:
            item["claimed_by"] = CLAIMED_TEAMS[mgr_id].get("client_name")
        else:
            item["claimed_by"] = None
            
    history = history_rows
    
    # Leading bidder info
    leading_bidder = None
    if state.get("current_bidder_id"):
        for m in managers:
            if m["id"] == state["current_bidder_id"]:
                leading_bidder = m
                break

    # Attach server time and countdown info
    if state.get("is_active"):
        timer_end = state.get("timer_end_timestamp")
        if not timer_end:
            timer_end = now + (state.get("timer_seconds") or 20)
            cursor.execute("UPDATE auction_state SET timer_end_timestamp = ? WHERE id = 1", (timer_end,))
            conn.commit()
        state["time_left"] = max(0, int(round(timer_end - now)))
        state["timer_end_timestamp"] = timer_end
    else:
        state["time_left"] = 0
        state["timer_end_timestamp"] = 0
    state["server_time"] = now

    conn.close()
    
    return jsonify({
        "state": state,
        "current_player": current_player,
        "leading_bidder": leading_bidder,
        "managers": managers,
        "history": history,
        "last_sold": last_sold,
        "last_unsold": last_unsold
    })

@app.route("/api/auction/nominate", methods=["POST"])
def nominate_player():
    data = request.json or {}
    player_id = data.get("player_id")
    starting_bid = data.get("starting_bid")
    
    if not player_id:
        return jsonify({"error": "Missing player_id"}), 400
        
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM players WHERE id = ?", (player_id,))
    player = cursor.fetchone()
    if not player:
        conn.close()
        return jsonify({"error": "Player not found"}), 404
        
    cursor.execute("SELECT * FROM auction_roster WHERE player_id = ?", (player_id,))
    already_bought = cursor.fetchone()
    if already_bought:
        conn.close()
        return jsonify({"error": "Player has already been sold in this auction!"}), 400
        
    if starting_bid is None or int(starting_bid) <= 0:
        starting_bid = player["base_price"] or 50
    else:
        starting_bid = int(starting_bid)
        
    timer_seconds = int(data.get("timer_seconds", 20))
    timer_end_timestamp = time.time() + timer_seconds
    
    cursor.execute("""
        UPDATE auction_state
        SET current_player_id = ?, current_bid = ?, current_bidder_id = NULL, is_active = 1, 
            timer_seconds = ?, timer_end_timestamp = ?, last_sold_player_id = NULL
        WHERE id = 1
    """, (player_id, starting_bid, timer_seconds, timer_end_timestamp))
    
    cursor.execute("""
        INSERT INTO auction_history (player_id, manager_id, bid_amount, bid_type)
        VALUES (?, NULL, ?, 'NOMINATE')
    """, (player_id, starting_bid))
    
    conn.commit()
    conn.close()
    
    return jsonify({
        "success": True, 
        "message": f"{player['name']} is now on the auction block for ₹{starting_bid:,} INR!",
        "timer_seconds": timer_seconds,
        "timer_end_timestamp": timer_end_timestamp
    })

@app.route("/api/auction/bid", methods=["POST"])
def place_bid():
    data = request.json or {}
    manager_id = data.get("manager_id")
    bid_amount = data.get("bid_amount")
    
    if not manager_id or bid_amount is None:
        return jsonify({"error": "Missing manager_id or bid_amount"}), 400
        
    bid_amount = int(bid_amount)
    
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM auction_state WHERE id = 1")
    state = cursor.fetchone()
    if not state or not state["is_active"] or not state["current_player_id"]:
        conn.close()
        return jsonify({"error": "No active auction in progress"}), 400
        
    cursor.execute("SELECT * FROM auction_managers WHERE id = ?", (manager_id,))
    manager = cursor.fetchone()
    if not manager:
        conn.close()
        return jsonify({"error": "Manager team not found"}), 404
        
    if manager["budget"] < bid_amount:
        conn.close()
        return jsonify({"error": f"Insufficient budget! {manager['name']} only has ₹{manager['budget']:,} INR remaining."}), 400

    # Validate Max Allowable Bid (Minimum 18 Players Squad Rule)
    cursor.execute("SELECT COUNT(*) FROM auction_roster WHERE manager_id = ?", (manager_id,))
    squad_count = cursor.fetchone()[0]
    max_bid_info = calculate_manager_max_bid(manager["budget"], squad_count)
    max_allowable_bid = max_bid_info["max_bid"]
    reserved_budget = max_bid_info["reserved_budget"]
    remaining_slots = max_bid_info["remaining_slots_needed"]

    if bid_amount > max_allowable_bid:
        conn.close()
        return jsonify({
            "error": f"Bid exceeds max allowable limit of ₹{max_allowable_bid:,}! {manager['name']} currently has {squad_count} player(s) and must reserve ₹{reserved_budget:,} (₹50 × {remaining_slots} remaining players) to complete the required minimum squad of 18 players."
        }), 400
        
    current_bid = state["current_bid"]
    current_bidder = state["current_bidder_id"]

    # Rule: The current leader bidder must NOT be able to bid consecutively!
    if current_bidder is not None and current_bidder == manager_id:
        conn.close()
        return jsonify({
            "error": f"You ({manager['name']}) are already leading the bid at ₹{current_bid:,}! Consecutive bidding is not allowed until another manager outbids you."
        }), 400
    
    if current_bidder is not None and bid_amount <= current_bid:
        conn.close()
        return jsonify({"error": f"Bid must be strictly higher than current highest bid of ₹{current_bid:,}!"}), 400
        
    if current_bidder is None and bid_amount < current_bid:
        conn.close()
        return jsonify({"error": f"Bid must meet opening price of ₹{current_bid:,}!"}), 400
        
    # Reset timer on each bid (e.g. back to full 20s)
    timer_seconds = state["timer_seconds"] or 20
    timer_end_timestamp = time.time() + timer_seconds
    
    cursor.execute("""
        UPDATE auction_state
        SET current_bid = ?, current_bidder_id = ?, timer_end_timestamp = ?
        WHERE id = 1
    """, (bid_amount, manager_id, timer_end_timestamp))
    
    cursor.execute("""
        INSERT INTO auction_history (player_id, manager_id, bid_amount, bid_type)
        VALUES (?, ?, ?, 'BID')
    """, (state["current_player_id"], manager_id, bid_amount))
    
    conn.commit()
    conn.close()
    
    return jsonify({
        "success": True, 
        "message": f"Bid of ₹{bid_amount:,} INR by {manager['name']} accepted!",
        "current_bid": bid_amount,
        "leading_manager": manager["name"],
        "timer_seconds": timer_seconds,
        "timer_end_timestamp": timer_end_timestamp,
        "max_allowable_bid": max_allowable_bid
    })

@app.route("/api/auction/sell", methods=["POST"])
def finalize_sale():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM auction_state WHERE id = 1")
    state = cursor.fetchone()
    if not state or not state["is_active"] or not state["current_player_id"]:
        conn.close()
        return jsonify({"error": "No active auction to finalize"}), 400
        
    player_id = state["current_player_id"]
    winner_id = state["current_bidder_id"]
    sold_price = state["current_bid"]
    
    cursor.execute("SELECT name, photo_url FROM players WHERE id = ?", (player_id,))
    player = cursor.fetchone()
    player_name = player["name"] if player else f"Player #{player_id}"
    player_photo = f"/api/player_image/{player_id}"
    
    if not winner_id:
        now_ts = time.time()
        cursor.execute("""
            UPDATE auction_state
            SET is_active = 0, current_player_id = NULL, current_bidder_id = NULL,
                timer_end_timestamp = 0,
                last_sold_player_id = NULL,
                last_unsold_player_id = ?,
                last_unsold_player_name = ?,
                last_unsold_player_photo = ?,
                last_unsold_timestamp = ?
            WHERE id = 1
        """, (player_id, player_name, player_photo, now_ts))
        cursor.execute("""
            INSERT INTO auction_history (player_id, manager_id, bid_amount, bid_type)
            VALUES (?, NULL, ?, 'UNSOLD')
        """, (player_id, sold_price))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": f"{player_name} went UNSOLD at ₹{sold_price:,} INR."})
        
    cursor.execute("SELECT * FROM auction_managers WHERE id = ?", (winner_id,))
    manager = cursor.fetchone()
    
    new_budget = manager["budget"] - sold_price
    new_spent = manager["spent"] + sold_price
    
    cursor.execute("""
        UPDATE auction_managers
        SET budget = ?, spent = ?
        WHERE id = ?
    """, (new_budget, new_spent, winner_id))
    
    cursor.execute("""
        INSERT INTO auction_roster (manager_id, player_id, bought_price)
        VALUES (?, ?, ?)
    """, (winner_id, player_id, sold_price))
    
    cursor.execute("""
        INSERT INTO auction_history (player_id, manager_id, bid_amount, bid_type)
        VALUES (?, ?, ?, 'SOLD')
    """, (player_id, winner_id, sold_price))
    
    now_ts = time.time()
    cursor.execute("""
        UPDATE auction_state
        SET is_active = 0, current_player_id = NULL, current_bidder_id = NULL,
            last_sold_player_id = ?,
            last_sold_player_name = ?,
            last_sold_player_photo = ?,
            last_sold_manager_id = ?,
            last_sold_manager_name = ?,
            last_sold_manager_avatar = ?,
            last_sold_price = ?,
            last_sold_timestamp = ?
        WHERE id = 1
    """, (player_id, player_name, player_photo, winner_id, manager["name"], manager["avatar"], sold_price, now_ts))
    
    conn.commit()
    conn.close()
    
    return jsonify({
        "success": True,
        "message": f"🏆 SOLD! {player_name} bought by {manager['name']} for ₹{sold_price:,} INR!",
        "winner": manager["name"],
        "winner_avatar": manager["avatar"],
        "player_name": player_name,
        "price": sold_price
    })

@app.route("/api/auction/sold_history", methods=["GET"])
def get_sold_history():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT r.id as roster_id, r.player_id, r.manager_id, r.bought_price, r.timestamp as sold_timestamp,
               p.name as player_name, p.overall_rating as player_ovr, p.position as player_pos,
               p.club_name, p.nationality, p.base_price, p.club_id,
               m.name as manager_name, m.avatar as manager_avatar, m.color as manager_color
        FROM auction_roster r
        JOIN players p ON r.player_id = p.id
        JOIN auction_managers m ON r.manager_id = m.id
        ORDER BY r.id DESC
    """)
    sold_rows = [dict(row) for row in cursor.fetchall()]
    
    for item in sold_rows:
        item["photo_url"] = f"/api/player_image/{item['player_id']}"
        item["club_logo_url"] = f"/api/team_image/{item['club_id']}" if item.get("club_id") else "/assets/default_club.svg"
        
        mgr_id = item.get("manager_id")
        if mgr_id and mgr_id in CLAIMED_TEAMS:
            item["claimed_by"] = CLAIMED_TEAMS[mgr_id].get("client_name")
        else:
            item["claimed_by"] = None
            
        # Get bids trail for this player
        cursor.execute("""
            SELECT h.*, m.name as manager_name, m.avatar as manager_avatar, m.color as manager_color
            FROM auction_history h
            LEFT JOIN auction_managers m ON h.manager_id = m.id
            WHERE h.player_id = ?
            ORDER BY h.id ASC
        """, (item["player_id"],))
        bids = [dict(b) for b in cursor.fetchall()]
        for b in bids:
            b_mgr_id = b.get("manager_id")
            if b_mgr_id and b_mgr_id in CLAIMED_TEAMS:
                b["claimed_by"] = CLAIMED_TEAMS[b_mgr_id].get("client_name")
            else:
                b["claimed_by"] = None
        item["bids"] = bids
        item["bid_count"] = len([b for b in bids if b["bid_type"] == "BID"])
        
    conn.close()
    return jsonify({"sold_players": sold_rows, "total_sold": len(sold_rows)})

@app.route("/api/auction/player_ledger/<int:player_id>", methods=["GET"])
def get_player_ledger(player_id):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM players WHERE id = ?", (player_id,))
    p_row = cursor.fetchone()
    if not p_row:
        conn.close()
        return jsonify({"error": "Player not found"}), 404
        
    player = dict(p_row)
    player["photo_url"] = f"/api/player_image/{player_id}"
    player["club_logo_url"] = f"/api/team_image/{player['club_id']}" if player.get("club_id") else "/assets/default_club.svg"
    
    cursor.execute("""
        SELECT r.*, m.name as manager_name, m.avatar as manager_avatar, m.color as manager_color
        FROM auction_roster r
        JOIN auction_managers m ON r.manager_id = m.id
        WHERE r.player_id = ?
    """, (player_id,))
    roster_row = cursor.fetchone()
    sold_info = dict(roster_row) if roster_row else None
    if sold_info and sold_info.get("manager_id") in CLAIMED_TEAMS:
        sold_info["claimed_by"] = CLAIMED_TEAMS[sold_info["manager_id"]].get("client_name")
        
    cursor.execute("""
        SELECT h.*, m.name as manager_name, m.avatar as manager_avatar, m.color as manager_color
        FROM auction_history h
        LEFT JOIN auction_managers m ON h.manager_id = m.id
        WHERE h.player_id = ?
        ORDER BY h.id ASC
    """, (player_id,))
    bids = [dict(b) for b in cursor.fetchall()]
    for b in bids:
        b_mgr = b.get("manager_id")
        if b_mgr and b_mgr in CLAIMED_TEAMS:
            b["claimed_by"] = CLAIMED_TEAMS[b_mgr].get("client_name")
        else:
            b["claimed_by"] = None
            
    conn.close()
    return jsonify({
        "player": player,
        "sold_info": sold_info,
        "bids": bids,
        "bid_count": len([b for b in bids if b["bid_type"] == "BID"])
    })

# ----------------- PLAYER POOLS & NOMINATION ROSTER -----------------

@app.route("/api/auction/pools", methods=["GET"])
def get_auction_pools():
    pool_type = request.args.get("type", "to_be_auctioned") # 'to_be_auctioned', 'unsold', 'sold'
    search = request.args.get("search", "").strip()
    position = request.args.get("position", "").strip().upper()
    pos_cat = request.args.get("position_category", "").strip().upper()
    min_ovr = int(request.args.get("min_ovr", 0))
    sort_by = request.args.get("sort", "overall_rating")
    order = request.args.get("order", "DESC").upper()
    if order not in ["ASC", "DESC"]:
        order = "DESC"
    if sort_by not in ["overall_rating", "base_price", "name", "potential"]:
        sort_by = "overall_rating"

    page = max(1, int(request.args.get("page", 1)))
    limit = max(1, min(100, int(request.args.get("limit", 24))))
    offset = (page - 1) * limit

    conn = get_db()
    cursor = conn.cursor()

    # Get counts for all 3 categories
    cursor.execute("""
        SELECT 
          (SELECT COUNT(*) FROM players WHERE id NOT IN (SELECT player_id FROM auction_roster) AND id NOT IN (SELECT player_id FROM auction_history WHERE bid_type = 'UNSOLD' AND player_id NOT IN (SELECT player_id FROM auction_roster))) as to_be_auctioned_count,
          (SELECT COUNT(DISTINCT player_id) FROM auction_history WHERE bid_type = 'UNSOLD' AND player_id NOT IN (SELECT player_id FROM auction_roster)) as unsold_count,
          (SELECT COUNT(*) FROM auction_roster) as sold_count,
          (SELECT COUNT(*) FROM players) as total_count
    """)
    counts_row = cursor.fetchone()
    counts = {
        "to_be_auctioned": counts_row[0] if counts_row else 0,
        "unsold": counts_row[1] if counts_row else 0,
        "sold": counts_row[2] if counts_row else 0,
        "total": counts_row[3] if counts_row else 0
    }

    players = []
    total_in_pool = 0

    if pool_type == "sold":
        # Sold players with buyer details and bid count
        base_q = """
            FROM auction_roster r
            JOIN players p ON r.player_id = p.id
            JOIN auction_managers m ON r.manager_id = m.id
            WHERE 1=1
        """
        params = []
        if search:
            base_q += " AND (p.name LIKE ? OR p.club_name LIKE ? OR m.name LIKE ?)"
            like_s = f"%{search}%"
            params.extend([like_s, like_s, like_s])
        if position:
            base_q += " AND p.position = ?"
            params.append(position)
        elif pos_cat:
            base_q += " AND p.position_category = ?"
            params.append(pos_cat)
        if min_ovr > 0:
            base_q += " AND p.overall_rating >= ?"
            params.append(min_ovr)

        cursor.execute(f"SELECT COUNT(*) {base_q}", params)
        total_in_pool = cursor.fetchone()[0]

        q = f"""
            SELECT r.id as roster_id, r.player_id, r.manager_id, r.bought_price, r.timestamp as sold_timestamp,
                   p.*,
                   m.name as manager_name, m.avatar as manager_avatar, m.color as manager_color,
                   (SELECT COUNT(*) FROM auction_history WHERE player_id = p.id AND bid_type = 'BID') as bid_count
            {base_q}
            ORDER BY r.id DESC
            LIMIT ? OFFSET ?
        """
        params.extend([limit, offset])
        cursor.execute(q, params)
        for r in cursor.fetchall():
            d = dict(r)
            d["photo_url"] = f"/api/player_image/{d['id']}"
            d["club_logo_url"] = f"/api/team_image/{d['club_id']}" if d.get("club_id") else "/assets/default_club.svg"
            if d.get("manager_id") in CLAIMED_TEAMS:
                d["claimed_by"] = CLAIMED_TEAMS[d["manager_id"]].get("client_name")
            else:
                d["claimed_by"] = None
            players.append(d)

    elif pool_type == "unsold":
        # Unsold players (have UNSOLD history entry and are not in roster)
        base_q = """
            FROM players p
            JOIN (
                SELECT player_id, MAX(timestamp) as unsold_timestamp, MAX(bid_amount) as unmet_price
                FROM auction_history
                WHERE bid_type = 'UNSOLD'
                GROUP BY player_id
            ) h ON p.id = h.player_id
            WHERE p.id NOT IN (SELECT player_id FROM auction_roster)
        """
        params = []
        if search:
            base_q += " AND (p.name LIKE ? OR p.club_name LIKE ?)"
            like_s = f"%{search}%"
            params.extend([like_s, like_s])
        if position:
            base_q += " AND p.position = ?"
            params.append(position)
        elif pos_cat:
            base_q += " AND p.position_category = ?"
            params.append(pos_cat)
        if min_ovr > 0:
            base_q += " AND p.overall_rating >= ?"
            params.append(min_ovr)

        cursor.execute(f"SELECT COUNT(*) {base_q}", params)
        total_in_pool = cursor.fetchone()[0]

        q = f"""
            SELECT p.*, h.unmet_price, h.unsold_timestamp
            {base_q}
            ORDER BY h.unsold_timestamp DESC, p.overall_rating DESC
            LIMIT ? OFFSET ?
        """
        params.extend([limit, offset])
        cursor.execute(q, params)
        for r in cursor.fetchall():
            d = dict(r)
            d["photo_url"] = f"/api/player_image/{d['id']}"
            d["club_logo_url"] = f"/api/team_image/{d['club_id']}" if d.get("club_id") else "/assets/default_club.svg"
            players.append(d)

    else: # to_be_auctioned
        # Available players not sold and not unsold
        base_q = """
            FROM players p
            WHERE p.id NOT IN (SELECT player_id FROM auction_roster)
              AND p.id NOT IN (SELECT player_id FROM auction_history WHERE bid_type = 'UNSOLD' AND player_id NOT IN (SELECT player_id FROM auction_roster))
        """
        params = []
        if search:
            base_q += " AND (p.name LIKE ? OR p.club_name LIKE ? OR p.nationality LIKE ?)"
            like_s = f"%{search}%"
            params.extend([like_s, like_s, like_s])
        if position:
            base_q += " AND p.position = ?"
            params.append(position)
        elif pos_cat:
            base_q += " AND p.position_category = ?"
            params.append(pos_cat)
        if min_ovr > 0:
            base_q += " AND p.overall_rating >= ?"
            params.append(min_ovr)

        cursor.execute(f"SELECT COUNT(*) {base_q}", params)
        total_in_pool = cursor.fetchone()[0]

        q = f"""
            SELECT p.*
            {base_q}
            ORDER BY p.{sort_by} {order}, p.potential DESC
            LIMIT ? OFFSET ?
        """
        params.extend([limit, offset])
        cursor.execute(q, params)
        for r in cursor.fetchall():
            d = dict(r)
            d["photo_url"] = f"/api/player_image/{d['id']}"
            d["club_logo_url"] = f"/api/team_image/{d['club_id']}" if d.get("club_id") else "/assets/default_club.svg"
            players.append(d)

    conn.close()

    return jsonify({
        "type": pool_type,
        "counts": counts,
        "players": players,
        "total": total_in_pool,
        "page": page,
        "limit": limit,
        "total_pages": max(1, (total_in_pool + limit - 1) // limit)
    })

@app.route("/api/auction/pass", methods=["POST"])
def pass_player():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM auction_state WHERE id = 1")
    state = cursor.fetchone()
    if state and state["current_player_id"]:
        cursor.execute("UPDATE auction_state SET is_active = 0, current_player_id = NULL, current_bidder_id = NULL WHERE id = 1")
        cursor.execute("""
            INSERT INTO auction_history (player_id, manager_id, bid_amount, bid_type)
            VALUES (?, NULL, 0, 'PASSED')
        """, (state["current_player_id"],))
        conn.commit()
    conn.close()
    return jsonify({"success": True, "message": "Player auction skipped/passed."})

@app.route("/api/auction/release_player", methods=["POST"])
def release_player():
    data = request.json or {}
    roster_id = data.get("roster_id")
    
    if not roster_id:
        return jsonify({"error": "Missing roster_id"}), 400
        
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM auction_roster WHERE id = ?", (roster_id,))
    entry = cursor.fetchone()
    if not entry:
        conn.close()
        return jsonify({"error": "Roster entry not found"}), 404
        
    mgr_id = entry["manager_id"]
    refund_amount = entry["bought_price"]
    
    cursor.execute("""
        UPDATE auction_managers
        SET budget = budget + ?, spent = spent - ?
        WHERE id = ?
    """, (refund_amount, refund_amount, mgr_id))
    
    cursor.execute("DELETE FROM auction_roster WHERE id = ?", (roster_id,))
    conn.commit()
    conn.close()
    
    return jsonify({"success": True, "message": f"Player released and ₹{refund_amount:,} INR refunded to manager!"})

@app.route("/api/auction/release_team_roster", methods=["POST"])
def release_team_roster():
    data = request.json or {}
    manager_id = data.get("manager_id")
    
    if not manager_id:
        return jsonify({"error": "Missing manager_id"}), 400
        
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM auction_managers WHERE id = ?", (manager_id,))
    mgr = cursor.fetchone()
    if not mgr:
        conn.close()
        return jsonify({"error": "Manager not found"}), 404
        
    cursor.execute("SELECT SUM(bought_price), COUNT(*) FROM auction_roster WHERE manager_id = ?", (manager_id,))
    sum_row = cursor.fetchone()
    total_spent = sum_row[0] or 0
    player_count = sum_row[1] or 0
    
    if player_count == 0:
        conn.close()
        return jsonify({"success": True, "message": f"{mgr['name']} has no acquired players to release."})
        
    cursor.execute("""
        UPDATE auction_managers
        SET budget = budget + ?, spent = spent - ?
        WHERE id = ?
    """, (total_spent, total_spent, manager_id))
    
    cursor.execute("DELETE FROM auction_roster WHERE manager_id = ?", (manager_id,))
    conn.commit()
    conn.close()
    
    return jsonify({
        "success": True, 
        "message": f"All {player_count} players released for {mgr['name']}! ₹{total_spent:,} INR refunded."
    })

@app.route("/api/auction/reset", methods=["POST"])
def reset_auction():
    CLAIMED_TEAMS.clear()
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        UPDATE auction_managers
        SET budget = initial_budget, spent = 0
    """)
    cursor.execute("DELETE FROM auction_roster")
    cursor.execute("DELETE FROM auction_history")
    cursor.execute("""
        UPDATE auction_state 
        SET current_player_id = NULL, 
            current_bid = 50, 
            current_bidder_id = NULL, 
            is_active = 0,
            timer_end_timestamp = 0,
            last_sold_player_id = NULL,
            last_sold_player_name = NULL,
            last_sold_player_photo = NULL,
            last_sold_manager_id = NULL,
            last_sold_manager_name = NULL,
            last_sold_manager_avatar = NULL,
            last_sold_price = NULL,
            last_sold_timestamp = NULL,
            last_unsold_player_id = NULL,
            last_unsold_player_name = NULL,
            last_unsold_player_photo = NULL,
            last_unsold_timestamp = NULL
        WHERE id = 1
    """)
    
    conn.commit()
    conn.close()
    
    return jsonify({"success": True, "message": "Auction season has been reset to ₹1,500 INR budget per team!"})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting FIFA 19 Auction Server with Image Proxy at http://localhost:{port}...")
    app.run(host="0.0.0.0", port=port, debug=False)
