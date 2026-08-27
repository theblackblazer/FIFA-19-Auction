import os
import sys
import csv
import sqlite3
import re
import math

# Position code mapping in FIFA
FIFA_POSITIONS = {
    0: 'GK',
    1: 'SW',
    2: 'RWB',
    3: 'RB',
    4: 'RCB',
    5: 'CB',
    6: 'LCB',
    7: 'LB',
    8: 'LWB',
    9: 'RDM',
    10: 'CDM',
    11: 'LDM',
    12: 'RM',
    13: 'RCM',
    14: 'CM',
    15: 'LCM',
    16: 'LM',
    17: 'RAM',
    18: 'CAM',
    19: 'LAM',
    20: 'RF',
    21: 'CF',
    22: 'LF',
    23: 'RW',
    24: 'RS',
    25: 'ST',
    26: 'LS',
    27: 'LW',
    28: 'SUB',
    29: 'RES'
}

def position_to_category(pos):
    pos = str(pos).upper().strip()
    if pos in ['GK']:
        return 'GK'
    elif pos in ['CB', 'LB', 'RB', 'LWB', 'RWB', 'LCB', 'RCB', 'SW']:
        return 'DEF'
    elif pos in ['CM', 'CDM', 'CAM', 'LM', 'RM', 'LDM', 'RDM', 'LCM', 'RCM', 'LAM', 'RAM']:
        return 'MID'
    elif pos in ['ST', 'CF', 'LW', 'RW', 'LF', 'RF', 'LS', 'RS']:
        return 'FWD'
    return 'MID'

def clean_text(text):
    if not text:
        return ''
    text = str(text).strip()
    replacements = {
        'Pel': 'Pelé',
        'Zindine': 'Zinédine',
        'Matthus': 'Matthäus',
        'Eusbio': 'Eusébio',
        'Eusbio': 'Eusébio',
        'Man': 'Mané',
        'Andrs': 'Andrés',
        'Surez': 'Suárez',
        'Agero': 'Agüero',
        'Higuan': 'Higuaín',
        'Rodrguez': 'Rodríguez',
        'Di Mara': 'Di María',
        'Garca': 'García',
        'Snchez': 'Sánchez',
        'Martnez': 'Martínez',
        'Lpez': 'López',
        'Hernndez': 'Hernández',
        'Gonzlez': 'González',
        'Prez': 'Pérez',
        'Fernndez': 'Fernández',
        '': ''
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return text.strip()

def calc_card_stats(pos, stats):
    pos = str(pos).upper()
    acc = stats.get('acceleration', 60)
    spd = stats.get('sprint_speed', 60)
    fin = stats.get('finishing', 60)
    pow = stats.get('shot_power', 60)
    lsh = stats.get('long_shots', 60)
    vol = stats.get('volleys', 60)
    pen = stats.get('penalties', 60)
    pos_stat = stats.get('positioning', 60)
    
    spa = stats.get('short_passing', 60)
    vis = stats.get('vision', 60)
    cro = stats.get('crossing', 60)
    lpa = stats.get('long_passing', 60)
    cur = stats.get('curve', 60)
    fka = stats.get('free_kick_accuracy', 60)
    
    dri = stats.get('dribbling', 60)
    bco = stats.get('ball_control', 60)
    agi = stats.get('agility', 60)
    bal = stats.get('balance', 60)
    com = stats.get('composure', 60)
    
    mar = stats.get('marking', 60)
    stt = stats.get('standing_tackle', 60)
    slt = stats.get('sliding_tackle', 60)
    hea = stats.get('heading_accuracy', 60)
    itc = stats.get('interceptions', 60)
    
    str_val = stats.get('strength', 60)
    sta = stats.get('stamina', 60)
    agg = stats.get('aggression', 60)
    jmp = stats.get('jumping', 60)
    
    gkd = stats.get('gk_diving', 10)
    gkh = stats.get('gk_handling', 10)
    gkk = stats.get('gk_kicking', 10)
    gkp = stats.get('gk_positioning', 10)
    gkr = stats.get('gk_reflexes', 10)
    
    if pos == 'GK':
        return {
            'card_pac': max(1, min(99, round(gkd))),
            'card_sho': max(1, min(99, round(gkh))),
            'card_pas': max(1, min(99, round(gkk))),
            'card_dri': max(1, min(99, round(gkr))),
            'card_def': max(1, min(99, round(0.45 * acc + 0.55 * spd))),
            'card_phy': max(1, min(99, round(gkp)))
        }
    else:
        pac = round(0.45 * acc + 0.55 * spd)
        sho = round(0.45 * fin + 0.20 * pow + 0.20 * lsh + 0.05 * vol + 0.05 * pen + 0.05 * pos_stat)
        pas = round(0.35 * spa + 0.20 * vis + 0.20 * cro + 0.15 * lpa + 0.05 * cur + 0.05 * fka)
        drib = round(0.50 * dri + 0.35 * bco + 0.10 * agi + 0.05 * bal)
        defe = round(0.30 * mar + 0.30 * stt + 0.30 * slt + 0.10 * hea)
        phy = round(0.50 * str_val + 0.25 * sta + 0.20 * agg + 0.05 * jmp)
        return {
            'card_pac': max(1, min(99, pac)),
            'card_sho': max(1, min(99, sho)),
            'card_pas': max(1, min(99, pas)),
            'card_dri': max(1, min(99, drib)),
            'card_def': max(1, min(99, defe)),
            'card_phy': max(1, min(99, phy))
        }

def calculate_base_price(ovr, pot):
    # Auction base starting price is strictly 50 INR for all players
    return 50

def build_fifa_database():
    data_dir = r"C:\Users\singh\.gemini\antigravity\scratch\fifa19-auction-app\data"
    db_file = r"C:\Users\singh\.gemini\antigravity\scratch\fifa19-auction-app\backend\fifa19.db"
    
    print(f"Building FIFA 19 SQLite database from Desktop DB extract at: {db_file}...")
    
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    cursor.execute("PRAGMA journal_mode = WAL;")
    cursor.execute("PRAGMA synchronous = NORMAL;")
    
    cursor.executescript("""
    DROP TABLE IF EXISTS players;
    DROP TABLE IF EXISTS teams;
    DROP TABLE IF EXISTS leagues;
    DROP TABLE IF EXISTS auction_managers;
    DROP TABLE IF EXISTS auction_roster;
    DROP TABLE IF EXISTS auction_state;
    DROP TABLE IF EXISTS auction_history;

    CREATE TABLE players (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        short_name TEXT,
        full_name TEXT,
        age INTEGER,
        photo_url TEXT,
        flag_url TEXT,
        nationality TEXT,
        club_id INTEGER,
        club_name TEXT,
        club_logo_url TEXT,
        league_id INTEGER,
        league_name TEXT,
        position TEXT,
        position_category TEXT,
        jersey_number INTEGER,
        overall_rating INTEGER,
        potential INTEGER,
        value_eur INTEGER,
        wage_eur INTEGER,
        base_price INTEGER,
        preferred_foot TEXT,
        weak_foot INTEGER,
        skill_moves INTEGER,
        work_rate TEXT,
        body_type TEXT,
        height_cm INTEGER,
        weight_kg INTEGER,
        card_pac INTEGER,
        card_sho INTEGER,
        card_pas INTEGER,
        card_dri INTEGER,
        card_def INTEGER,
        card_phy INTEGER,
        acceleration INTEGER,
        sprint_speed INTEGER,
        agility INTEGER,
        balance INTEGER,
        reactions INTEGER,
        ball_control INTEGER,
        dribbling INTEGER,
        composure INTEGER,
        positioning INTEGER,
        finishing INTEGER,
        shot_power INTEGER,
        long_shots INTEGER,
        volleys INTEGER,
        penalties INTEGER,
        vision INTEGER,
        crossing INTEGER,
        free_kick_accuracy INTEGER,
        short_passing INTEGER,
        long_passing INTEGER,
        curve INTEGER,
        interceptions INTEGER,
        heading_accuracy INTEGER,
        marking INTEGER,
        standing_tackle INTEGER,
        sliding_tackle INTEGER,
        jumping INTEGER,
        stamina INTEGER,
        strength INTEGER,
        aggression INTEGER,
        gk_diving INTEGER,
        gk_handling INTEGER,
        gk_kicking INTEGER,
        gk_positioning INTEGER,
        gk_reflexes INTEGER,
        is_custom INTEGER DEFAULT 0
    );

    CREATE TABLE teams (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        league_id INTEGER,
        league_name TEXT,
        overall_rating INTEGER,
        attack_rating INTEGER,
        midfield_rating INTEGER,
        defense_rating INTEGER,
        transfer_budget INTEGER,
        club_worth INTEGER,
        logo_url TEXT
    );

    CREATE TABLE leagues (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
    );

    CREATE TABLE auction_managers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        avatar TEXT,
        color TEXT,
        initial_budget INTEGER,
        budget INTEGER,
        spent INTEGER DEFAULT 0
    );

    CREATE TABLE auction_roster (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        manager_id TEXT,
        player_id INTEGER,
        bought_price INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(manager_id) REFERENCES auction_managers(id),
        FOREIGN KEY(player_id) REFERENCES players(id)
    );

    CREATE TABLE auction_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        current_player_id INTEGER,
        current_bid INTEGER DEFAULT 0,
        current_bidder_id TEXT,
        is_active INTEGER DEFAULT 0,
        timer_seconds INTEGER DEFAULT 20,
        last_sold_player_id INTEGER,
        last_sold_player_name TEXT,
        last_sold_player_photo TEXT,
        last_sold_manager_id TEXT,
        last_sold_manager_name TEXT,
        last_sold_manager_avatar TEXT,
        last_sold_price INTEGER,
        last_sold_timestamp REAL,
        FOREIGN KEY(current_player_id) REFERENCES players(id)
    );

    CREATE TABLE auction_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER,
        manager_id TEXT,
        bid_amount INTEGER,
        bid_type TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_players_ovr ON players(overall_rating DESC);
    CREATE INDEX idx_players_pos ON players(position);
    CREATE INDEX idx_players_pos_cat ON players(position_category);
    CREATE INDEX idx_players_club ON players(club_name);
    CREATE INDEX idx_players_nat ON players(nationality);
    CREATE INDEX idx_players_name ON players(name);
    """);

    # 1. Load Name Dictionaries
    # dcplayernames.csv
    name_map = {}
    dc_path = os.path.join(data_dir, "dcplayernames.csv")
    if os.path.exists(dc_path):
        with open(dc_path, 'r', encoding='utf-8', errors='ignore') as f:
            for r in csv.DictReader(f):
                nid = r.get('nameid') or r.get('name_id')
                name = r.get('name') or r.get('\ufeffname')
                if nid and name:
                    name_map[int(nid)] = clean_text(name)
        print(f"Loaded {len(name_map)} name mappings from dcplayernames.")

    # editedplayernames.csv (user's custom in-game edited names)
    edited_map = {}
    edited_path = os.path.join(data_dir, "editedplayernames.csv")
    if os.path.exists(edited_path):
        with open(edited_path, 'r', encoding='utf-8', errors='ignore') as f:
            for r in csv.DictReader(f):
                pid = r.get('playerid')
                if pid:
                    fn = r.get('firstname') or r.get('\ufefffirstname') or ''
                    sn = r.get('surname') or ''
                    cn = r.get('commonname') or ''
                    pjn = r.get('playerjerseyname') or ''
                    name_str = cn if cn else f"{fn} {sn}".strip()
                    if not name_str: name_str = pjn
                    edited_map[int(pid)] = clean_text(name_str)
        print(f"Loaded {len(edited_map)} custom edited player names from editedplayernames.")

    # Metadata names & photos dictionary
    meta_path = os.path.join(data_dir, "fifa19_metadata.csv")
    meta_info = {}
    if os.path.exists(meta_path):
        with open(meta_path, 'r', encoding='utf-8', errors='ignore') as f:
            for r in csv.DictReader(f):
                pid = r.get('ID') or r.get('\ufeffID')
                if pid:
                    try:
                        pid = int(pid)
                        meta_info[pid] = {
                            'name': clean_text(r.get('Name', '')),
                            'photo': r.get('Photo', ''),
                            'flag': r.get('Flag', ''),
                            'nationality': r.get('Nationality', ''),
                            'club_logo': r.get('Club Logo', '')
                        }
                    except:
                        pass
        print(f"Loaded {len(meta_info)} player metadata references.")

    # 2. Load Teams directly from user teams.csv
    teams_path = os.path.join(data_dir, "teams.csv")
    teams_dict = {}
    team_insert_rows = []
    if os.path.exists(teams_path):
        with open(teams_path, 'r', encoding='utf-8', errors='ignore') as f:
            for r in csv.DictReader(f):
                try:
                    tid = int(r.get('teamid', 0))
                    tname = clean_text(r.get('teamname', ''))
                    if tid > 0 and tname:
                        t_ovr = int(r.get('overallrating', 70) or 70)
                        t_att = int(r.get('attackrating', 70) or 70)
                        t_mid = int(r.get('midfieldrating', 70) or 70)
                        t_def = int(r.get('defenserating', 70) or 70)
                        t_bud = int(r.get('transferbudget', 10000000) or 10000000)
                        t_worth = int(r.get('clubworth', 50000000) or 50000000)
                        logo_url = f"https://cdn.sofifa.net/teams/{tid}/60.png"
                        
                        teams_dict[tid] = tname
                        team_insert_rows.append((
                            tid, tname, 0, '', t_ovr, t_att, t_mid, t_def, t_bud, t_worth, logo_url
                        ))
                except:
                    pass
        cursor.executemany("INSERT OR REPLACE INTO teams VALUES (?,?,?,?,?,?,?,?,?,?,?)", team_insert_rows)
        print(f"Inserted {len(team_insert_rows)} teams directly from user DB.")

    # 3. Load TeamPlayerLinks from user teamplayerlinks.csv
    links_path = os.path.join(data_dir, "teamplayerlinks.csv")
    player_team_links = {}
    if os.path.exists(links_path):
        with open(links_path, 'r', encoding='utf-8', errors='ignore') as f:
            for r in csv.DictReader(f):
                try:
                    pid = int(r.get('playerid', 0))
                    tid = int(r.get('teamid', 0))
                    num = int(r.get('jerseynumber', 0) or 0)
                    if pid > 0 and tid > 0:
                        player_team_links[pid] = {'team_id': tid, 'jersey_number': num}
                except:
                    pass
        print(f"Loaded {len(player_team_links)} squad-player links directly from user DB.")

    # 4. Load ALL 26,000 Players directly from user players.csv!
    players_path = os.path.join(data_dir, "players.csv")
    player_rows = []
    
    if not os.path.exists(players_path):
        print("ERROR: players.csv not found!")
        return

    print("Processing all players directly from user's extracted players.csv...")
    with open(players_path, 'r', encoding='utf-8', errors='ignore') as f:
        reader = csv.DictReader(f)
        for r in reader:
            try:
                pid = int(r.get('playerid', 0))
                if pid <= 0: continue

                ovr = int(r.get('overallrating', 60) or 60)
                if ovr <= 0: continue
                
                pot = int(r.get('potential', ovr) or ovr)
                
                # Position from user DB
                pos_code = int(r.get('preferredposition1', 14) or 14)
                pos = FIFA_POSITIONS.get(pos_code, 'CM')
                pos_cat = position_to_category(pos)
                
                # Resolve player name
                fn_id = int(r.get('firstnameid', 0) or r.get('\ufefffirstnameid', 0) or 0)
                ln_id = int(r.get('lastnameid', 0) or 0)
                cn_id = int(r.get('commonnameid', 0) or 0)
                
                name = ''
                if pid in edited_map and edited_map[pid]:
                    name = edited_map[pid]
                elif cn_id in name_map:
                    name = name_map[cn_id]
                elif fn_id in name_map or ln_id in name_map:
                    fn_part = name_map.get(fn_id, '')
                    ln_part = name_map.get(ln_id, '')
                    name = f"{fn_part} {ln_part}".strip()
                elif pid in meta_info and meta_info[pid]['name']:
                    name = meta_info[pid]['name']
                else:
                    name = f"Player #{pid}"
                
                name = clean_text(name)
                
                # Team & Jersey from user DB
                club_id = 0
                club_name = 'Free Agent'
                jersey_num = 0
                if pid in player_team_links:
                    club_id = player_team_links[pid]['team_id']
                    jersey_num = player_team_links[pid]['jersey_number']
                    if club_id in teams_dict:
                        club_name = teams_dict[club_id]

                # Photo & Flag
                photo_url = f"https://cdn.sofifa.net/players/{pid:06d}/19_120.png"
                flag_url = ""
                nat = "International"
                club_logo = f"https://cdn.sofifa.net/teams/{club_id}/60.png" if club_id > 0 else ""
                
                if pid in meta_info:
                    if meta_info[pid]['photo']: photo_url = meta_info[pid]['photo']
                    if meta_info[pid]['flag']: flag_url = meta_info[pid]['flag']
                    if meta_info[pid]['nationality']: nat = meta_info[pid]['nationality']
                    if meta_info[pid]['club_logo'] and not club_logo: club_logo = meta_info[pid]['club_logo']

                # Physical attributes from user DB
                h_cm = int(r.get('height', 180) or 180)
                w_kg = int(r.get('weight', 75) or 75)
                age = 26
                
                # Foot, Skills, Work rates from user DB
                pref_foot_code = int(r.get('preferredfoot', 1) or 1)
                pref_foot = 'Left' if pref_foot_code == 2 else 'Right'
                wf = int(r.get('weakfootabilitytypecode', 3) or 3)
                sm = int(r.get('skillmoves', 3) or 3)
                
                att_wr_code = int(r.get('attackingworkrate', 1) or 1)
                def_wr_code = int(r.get('defensiveworkrate', 1) or 1)
                wr_map = {0: 'Low', 1: 'Medium', 2: 'High'}
                work_rate = f"{wr_map.get(att_wr_code, 'Medium')}/{wr_map.get(def_wr_code, 'Medium')}"
                
                # Detailed stats from user DB
                def get_stat(key, def_val=60):
                    try:
                        v = r.get(key, def_val)
                        if not v or v == '': return def_val
                        return int(v)
                    except:
                        return def_val

                stats = {
                    'acceleration': get_stat('acceleration'),
                    'sprint_speed': get_stat('sprintspeed'),
                    'agility': get_stat('agility'),
                    'balance': get_stat('balance'),
                    'reactions': get_stat('reactions'),
                    'ball_control': get_stat('ballcontrol'),
                    'dribbling': get_stat('dribbling'),
                    'composure': get_stat('composure'),
                    'positioning': get_stat('positioning'),
                    'finishing': get_stat('finishing'),
                    'shot_power': get_stat('shotpower'),
                    'long_shots': get_stat('longshots'),
                    'volleys': get_stat('volleys'),
                    'penalties': get_stat('penalties'),
                    'vision': get_stat('vision'),
                    'crossing': get_stat('crossing'),
                    'free_kick_accuracy': get_stat('freekickaccuracy'),
                    'short_passing': get_stat('shortpassing'),
                    'long_passing': get_stat('longpassing'),
                    'curve': get_stat('curve'),
                    'interceptions': get_stat('interceptions'),
                    'heading_accuracy': get_stat('headingaccuracy'),
                    'marking': get_stat('marking'),
                    'standing_tackle': get_stat('standingtackle'),
                    'sliding_tackle': get_stat('slidingtackle'),
                    'jumping': get_stat('jumping'),
                    'stamina': get_stat('stamina'),
                    'strength': get_stat('strength'),
                    'aggression': get_stat('aggression'),
                    'gk_diving': get_stat('gkdiving', 10),
                    'gk_handling': get_stat('gkhandling', 10),
                    'gk_kicking': get_stat('gkkicking', 10),
                    'gk_positioning': get_stat('gkpositioning', 10),
                    'gk_reflexes': get_stat('gkreflexes', 10),
                }

                card = calc_card_stats(pos, stats)
                base_price = calculate_base_price(ovr, pot)
                val_eur = int(base_price * 1.4)
                wage_eur = max(5000, int(val_eur / 350))

                player_rows.append((
                    pid, name, name, name, age, photo_url, flag_url, nat,
                    club_id, club_name, club_logo, 0, '', pos, pos_cat, jersey_num,
                    ovr, pot, val_eur, wage_eur, base_price,
                    pref_foot, wf, sm, work_rate, 'Normal', h_cm, w_kg,
                    card['card_pac'], card['card_sho'], card['card_pas'], card['card_dri'], card['card_def'], card['card_phy'],
                    stats['acceleration'], stats['sprint_speed'], stats['agility'], stats['balance'], stats['reactions'],
                    stats['ball_control'], stats['dribbling'], stats['composure'], stats['positioning'], stats['finishing'],
                    stats['shot_power'], stats['long_shots'], stats['volleys'], stats['penalties'], stats['vision'],
                    stats['crossing'], stats['free_kick_accuracy'], stats['short_passing'], stats['long_passing'], stats['curve'],
                    stats['interceptions'], stats['heading_accuracy'], stats['marking'], stats['standing_tackle'], stats['sliding_tackle'],
                    stats['jumping'], stats['stamina'], stats['strength'], stats['aggression'],
                    stats['gk_diving'], stats['gk_handling'], stats['gk_kicking'], stats['gk_positioning'], stats['gk_reflexes'],
                    1 if pid in edited_map else 0
                ))
            except Exception as e:
                continue

    placeholders = ",".join(["?"] * 69)
    cursor.executemany(f"INSERT OR REPLACE INTO players VALUES ({placeholders})", player_rows)
    print(f"Inserted ALL {len(player_rows)} players directly from user's squad DB file!")

    # 5. Initialize Auction Teams (1,500 INR Budget each)
    default_managers = [
        ("mgr_1", "Real Galácticos", "👑", "#eab308", 1500, 1500, 0),
        ("mgr_2", "FC Red Devils", "👹", "#ef4444", 1500, 1500, 0),
        ("mgr_3", "Blue Knights", "🛡️", "#3b82f6", 1500, 1500, 0),
        ("mgr_4", "Golden Stars", "⭐", "#10b981", 1500, 1500, 0)
    ]
    cursor.executemany("INSERT OR REPLACE INTO auction_managers VALUES (?,?,?,?,?,?,?)", default_managers)

    # Initialize top player (Pelé / CR7) on stage with 50 INR starting bid
    top_p = cursor.execute("SELECT id, base_price FROM players ORDER BY overall_rating DESC LIMIT 1").fetchone()
    top_id = top_p[0] if top_p else 237067
    top_bid = top_p[1] if top_p else 50
    cursor.execute("INSERT OR REPLACE INTO auction_state (id, current_player_id, current_bid, current_bidder_id, is_active, timer_seconds) VALUES (1, ?, ?, NULL, 0, 20)", (top_id, top_bid))

    conn.commit()
    conn.close()
    print("FIFA 19 SQLite database rebuilt from user desktop DB file successfully!")

if __name__ == "__main__":
    build_fifa_database()
