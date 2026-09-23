// FIFA 19 Player Explorer & Live Auction Application Logic (Zero-Flicker & Bright / Dark Theme)

let currentTab = 'explorer';
let currentPage = 1;
let totalPages = 1;
let currentPosCat = '';
let searchDebounceTimer = null;
let auctionPollInterval = null;
let currentAuctionState = null;
let activeManagerId = 'mgr_1';
let selectedSquadManagerId = 'mgr_1';
let squadViewMode = 'pitch';
let lastNominatedPlayerId = null;
let currentLedgerView = 'live';
let liveTimerInterval = null;
let serverClockOffset = 0;
let currentTimerEndTimestamp = 0;
let autoFinalizeInProgress = false;
let lastUnsoldTimestamp = 0;

// ----------------- DARK / LIGHT THEME ENGINE -----------------

function initTheme() {
    const savedTheme = localStorage.getItem('fifa19_theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('fifa19_theme', isDark ? 'dark' : 'light');
    showCustomToast('Theme Switched', `Switched to ${isDark ? 'Dark 🌙' : 'Light ☀️'} Mode.`, 'info');
}

// Immediately initialize theme on script evaluation
initTheme();

// ----------------- POSITION CARD COLOR & STYLE HELPER -----------------

function getPositionCardStyles(position, posCat, overallRating) {
    const pos = (position || '').toUpperCase();
    const cat = posCat || (
        ['ST', 'CF', 'LW', 'RW', 'LF', 'RF', 'RS', 'LS'].includes(pos) ? 'FWD' :
        ['CAM', 'CM', 'CDM', 'LM', 'RM', 'LAM', 'RAM', 'LCM', 'RCM', 'LDM', 'RDM'].includes(pos) ? 'MID' :
        ['CB', 'LB', 'RB', 'LWB', 'RWB', 'LCB', 'RCB'].includes(pos) ? 'DEF' : 'GK'
    );

    const ovr = Number(overallRating) || 0;
    const isGold = ovr >= 90;

    // Position-specific badge and text colors (Red for FWD, Blue for MID, Green for DEF, Amber for GK)
    let posColor = 'text-amber-600 dark:text-amber-400';
    let posBadgeClass = 'bg-amber-500/20 dark:bg-amber-500/30 text-amber-800 dark:text-amber-300 border border-amber-400/50 font-black';
    let borderClass = 'border-amber-400/50 dark:border-amber-500/60';
    let haloClass = 'shadow-amber-500/20';
    let cardClass = 'fut-card-gk';

    if (cat === 'FWD') {
        cardClass = 'fut-card-fwd';
        posColor = 'text-rose-600 dark:text-rose-400';
        posBadgeClass = 'bg-rose-500/20 dark:bg-rose-500/30 text-rose-700 dark:text-rose-300 border border-rose-400/50 font-black';
        borderClass = 'border-rose-400/50 dark:border-rose-500/60';
        haloClass = 'shadow-rose-500/20';
    } else if (cat === 'MID') {
        cardClass = 'fut-card-mid';
        posColor = 'text-blue-600 dark:text-blue-400';
        posBadgeClass = 'bg-blue-500/20 dark:bg-blue-500/30 text-blue-700 dark:text-blue-300 border border-blue-400/50 font-black';
        borderClass = 'border-blue-400/50 dark:border-blue-500/60';
        haloClass = 'shadow-blue-500/20';
    } else if (cat === 'DEF') {
        cardClass = 'fut-card-def';
        posColor = 'text-emerald-600 dark:text-emerald-400';
        posBadgeClass = 'bg-emerald-500/20 dark:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 border border-emerald-400/50 font-black';
        borderClass = 'border-emerald-400/50 dark:border-emerald-500/60';
        haloClass = 'shadow-emerald-500/20';
    } else {
        cardClass = 'fut-card-gk';
        posColor = 'text-amber-600 dark:text-amber-400';
        posBadgeClass = 'bg-amber-500/20 dark:bg-amber-500/30 text-amber-800 dark:text-amber-300 border border-amber-400/50 font-black';
        borderClass = 'border-amber-400/50 dark:border-amber-500/60';
        haloClass = 'shadow-amber-500/20';
    }

    if (isGold) {
        cardClass = 'fut-card-gold';
        borderClass = 'border-amber-400 dark:border-amber-500';
        haloClass = 'shadow-amber-500/40';
    }

    return {
        cardClass,
        posColor,
        posBadgeClass,
        borderClass,
        haloClass
    };
}

// Currency Formatter (Indian Rupee INR)
function formatMoney(amount) {
    if (amount === undefined || amount === null || isNaN(amount)) return '₹0';
    return '₹' + Number(amount).toLocaleString('en-IN');
}

function formatFullMoney(amount) {
    if (amount === undefined || amount === null || isNaN(amount)) return '₹0';
    return '₹' + Number(amount).toLocaleString('en-IN');
}

// ----------------- LIVE AUCTION TIMER ENGINE -----------------

function startLiveTimerCountdown() {
    if (!liveTimerInterval) {
        liveTimerInterval = setInterval(updateLiveTimerDisplay, 250);
    }
}

function updateLiveTimerDisplay() {
    const timerEl = document.getElementById('auction-timer');
    if (!timerEl) return;

    if (!currentAuctionState || !currentAuctionState.state || !currentAuctionState.state.is_active) {
        timerEl.textContent = '20s';
        timerEl.className = "font-['Outfit'] font-black text-xl text-slate-900";
        return;
    }

    const nowAdjusted = (Date.now() / 1000) - serverClockOffset;
    const timeLeft = Math.max(0, Math.ceil(currentTimerEndTimestamp - nowAdjusted));

    if (timeLeft <= 5 && timeLeft > 0) {
        timerEl.textContent = `${timeLeft}s`;
        timerEl.className = "font-['Outfit'] font-black text-xl text-rose-600 animate-pulse drop-shadow-sm";
    } else if (timeLeft === 0) {
        timerEl.textContent = '0s';
        timerEl.className = "font-['Outfit'] font-black text-xl text-rose-700 animate-pulse";

        // Auto-finalize immediately when timer reaches 0s
        if (!autoFinalizeInProgress && currentAuctionState && currentAuctionState.state && currentAuctionState.state.is_active) {
            autoFinalizeInProgress = true;
            fetch('/api/auction/sell', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{}'
            })
            .then(res => res.json())
            .then(data => {
                loadAuctionState(true);
                setTimeout(() => { autoFinalizeInProgress = false; }, 1500);
            })
            .catch(() => {
                setTimeout(() => { autoFinalizeInProgress = false; }, 1500);
            });
        }
    } else {
        timerEl.textContent = `${timeLeft}s`;
        timerEl.className = "font-['Outfit'] font-black text-xl text-slate-900";
    }
}

function playSadUnsoldChime() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();

        // Melancholic, gentle descending 2-note sad minor motif (Eb4 311Hz -> C4 261Hz)
        const notes = [
            { freq: 311.13, start: 0.0, dur: 0.45 },
            { freq: 261.63, start: 0.4, dur: 0.85 }
        ];

        notes.forEach(n => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(n.freq, ctx.currentTime + n.start);

            gain.gain.setValueAtTime(0.0001, ctx.currentTime + n.start);
            gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + n.start + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + n.start + n.dur);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + n.start);
            osc.stop(ctx.currentTime + n.start + n.dur + 0.05);
        });
    } catch (e) {
        console.error('Sad audio chime error:', e);
    }
}

function triggerUnsoldNotification(lastUnsold) {
    if (!lastUnsold || !lastUnsold.timestamp) return;
    if (lastUnsold.timestamp <= lastUnsoldTimestamp) return;
    lastUnsoldTimestamp = lastUnsold.timestamp;

    // Play subtle melancholic descending chime
    playSadUnsoldChime();

    // Populate and display Unsold Melancholic Modal Dialog
    const photoEl = document.getElementById('unsold-p-photo');
    const nameEl = document.getElementById('unsold-p-name');
    const priceEl = document.getElementById('unsold-opening-price');
    const overlay = document.getElementById('unsold-modal-overlay');
    const box = document.getElementById('unsold-modal-box');

    if (photoEl) photoEl.src = lastUnsold.player_photo || '/assets/default_player.svg';
    if (nameEl) nameEl.textContent = lastUnsold.player_name;
    if (priceEl) priceEl.textContent = formatMoney(lastUnsold.base_price || 50) + ' INR';

    if (overlay && box) {
        overlay.classList.remove('hidden');
        setTimeout(() => box.classList.remove('scale-95'), 20);
    }
}

function dismissUnsoldModal() {
    const overlay = document.getElementById('unsold-modal-overlay');
    const box = document.getElementById('unsold-modal-box');
    if (box) box.classList.add('scale-95');
    setTimeout(() => {
        if (overlay) overlay.classList.add('hidden');
    }, 200);
}

// ----------------- TAB SWITCHING -----------------

// ----------------- AUCTION NOMINATION POOL MODULE -----------------

let currentPoolCategory = 'to_be_auctioned'; // 'to_be_auctioned', 'unsold', 'sold'
let poolCurrentPage = 1;
let poolTotalPages = 1;
let poolPosCat = '';
let poolSpecificPosition = '';
let poolSearchDebounce = null;

const POSITION_SUB_CHIPS = {
    '': [
        { pos: '', label: 'All' },
        { pos: 'ST', label: 'ST' },
        { pos: 'LW', label: 'LW' },
        { pos: 'RW', label: 'RW' },
        { pos: 'CF', label: 'CF' },
        { pos: 'CAM', label: 'CAM' },
        { pos: 'CM', label: 'CM' },
        { pos: 'CDM', label: 'CDM' },
        { pos: 'CB', label: 'CB' },
        { pos: 'LB', label: 'LB' },
        { pos: 'RB', label: 'RB' },
        { pos: 'LWB', label: 'LWB' },
        { pos: 'RWB', label: 'RWB' },
        { pos: 'GK', label: 'GK' }
    ],
    'FWD': [
        { pos: '', label: 'All FWD' },
        { pos: 'ST', label: 'ST (Striker)' },
        { pos: 'CF', label: 'CF (Center Forward)' },
        { pos: 'LW', label: 'LW (Left Winger)' },
        { pos: 'RW', label: 'RW (Right Winger)' },
        { pos: 'LF', label: 'LF' },
        { pos: 'RF', label: 'RF' }
    ],
    'MID': [
        { pos: '', label: 'All MID' },
        { pos: 'CAM', label: 'CAM (Attacking Mid)' },
        { pos: 'CM', label: 'CM (Central Mid)' },
        { pos: 'CDM', label: 'CDM (Defensive Mid)' },
        { pos: 'LM', label: 'LM (Left Mid)' },
        { pos: 'RM', label: 'RM (Right Mid)' }
    ],
    'DEF': [
        { pos: '', label: 'All DEF' },
        { pos: 'CB', label: 'CB (Center Back)' },
        { pos: 'LB', label: 'LB (Left Back)' },
        { pos: 'RB', label: 'RB (Right Back)' },
        { pos: 'LWB', label: 'LWB (Left Wing Back)' },
        { pos: 'RWB', label: 'RWB (Right Wing Back)' }
    ],
    'GK': [
        { pos: '', label: 'All GK' },
        { pos: 'GK', label: 'GK (Goalkeeper)' }
    ]
};

function switchTab(tabId) {
    currentTab = tabId;
    
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    const activeNav = document.getElementById(`nav-${tabId}`);
    if (activeNav) activeNav.classList.add('active');

    // Update sections
    ['explorer', 'pool', 'auction', 'managers', 'compare', 'settings'].forEach(id => {
        const btn = document.getElementById(`nav-${id}`);
        const sec = document.getElementById(`tab-${id}`);
        if (btn) {
            if (id === tabId) {
                btn.className = 'nav-btn active flex items-center space-x-2 px-3.5 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all relative';
            } else {
                btn.className = 'nav-btn flex items-center space-x-2 px-3.5 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all relative';
            }
        }
        if (sec) {
            if (id === tabId) {
                sec.classList.remove('hidden');
            } else {
                sec.classList.add('hidden');
            }
        }
    });

    if (tabId === 'explorer') {
        loadPlayers();
    } else if (tabId === 'pool') {
        loadPoolPlayers(1);
    } else if (tabId === 'auction') {
        loadAuctionState(true);
    } else if (tabId === 'managers') {
        loadManagersHub();
    } else if (tabId === 'compare') {
        loadComparisonView();
    } else if (tabId === 'settings') {
        loadSettingsView();
    }
}

function switchPoolCategory(cat) {
    currentPoolCategory = cat;

    // Update active tab buttons
    ['to_be_auctioned', 'unsold', 'sold'].forEach(c => {
        const btn = document.getElementById(`pool-tab-${c}`);
        if (!btn) return;
        if (c === cat) {
            if (c === 'to_be_auctioned') {
                btn.className = 'px-4 py-2 rounded-xl text-xs font-black transition-all bg-emerald-600 text-white shadow-md flex items-center space-x-1.5 active:scale-95';
            } else if (c === 'unsold') {
                btn.className = 'px-4 py-2 rounded-xl text-xs font-black transition-all bg-rose-600 text-white shadow-md flex items-center space-x-1.5 active:scale-95';
            } else {
                btn.className = 'px-4 py-2 rounded-xl text-xs font-black transition-all bg-amber-500 text-slate-950 shadow-md flex items-center space-x-1.5 active:scale-95';
            }
        } else {
            btn.className = 'px-4 py-2 rounded-xl text-xs font-black transition-all text-slate-600 hover:text-slate-900 flex items-center space-x-1.5 active:scale-95';
        }
    });

    loadPoolPlayers(1);
}

function renderPoolSubPosChips() {
    const container = document.getElementById('pool-sub-pos-chips-container');
    if (!container) return;
    const chips = POSITION_SUB_CHIPS[poolPosCat] || POSITION_SUB_CHIPS[''];
    
    container.innerHTML = chips.map(chip => {
        const isActive = poolSpecificPosition === chip.pos;
        let activeClass = '';
        if (isActive) {
            activeClass = 'bg-emerald-600 text-white font-black shadow-sm border-emerald-600';
        } else {
            activeClass = 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold border-slate-200 dark:border-slate-700';
        }
        return `
            <button onclick="setPoolSpecificPosition('${chip.pos}')" class="px-2.5 py-1 rounded-lg border text-[11px] transition-all cursor-pointer ${activeClass}">
                ${chip.label}
            </button>
        `;
    }).join('');
}

function setPoolPosCat(cat) {
    poolPosCat = cat;
    poolSpecificPosition = '';
    const posFilter = document.getElementById('pool-position-filter');
    if (posFilter) posFilter.value = '';

    document.querySelectorAll('.pool-pos-btn').forEach(btn => {
        if (btn.getAttribute('data-cat') === cat) {
            btn.className = 'pool-pos-btn active px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold transition-all bg-emerald-600 text-white';
        } else {
            btn.className = 'pool-pos-btn px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold transition-all text-slate-600 hover:bg-slate-100';
        }
    });
    renderPoolSubPosChips();
    loadPoolPlayers(1);
}

function setPoolSpecificPosition(pos) {
    poolSpecificPosition = pos;
    const posFilter = document.getElementById('pool-position-filter');
    if (posFilter) {
        posFilter.value = pos;
    }
    renderPoolSubPosChips();
    loadPoolPlayers(1);
}

function onPoolSpecificPositionChange() {
    const posFilter = document.getElementById('pool-position-filter');
    poolSpecificPosition = posFilter ? posFilter.value : '';
    
    if (poolSpecificPosition) {
        if (['ST', 'CF', 'LW', 'RW', 'LF', 'RF'].includes(poolSpecificPosition)) {
            poolPosCat = 'FWD';
        } else if (['CAM', 'CM', 'CDM', 'LM', 'RM'].includes(poolSpecificPosition)) {
            poolPosCat = 'MID';
        } else if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(poolSpecificPosition)) {
            poolPosCat = 'DEF';
        } else if (poolSpecificPosition === 'GK') {
            poolPosCat = 'GK';
        }
        
        document.querySelectorAll('.pool-pos-btn').forEach(btn => {
            if (btn.getAttribute('data-cat') === poolPosCat) {
                btn.className = 'pool-pos-btn active px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold transition-all bg-emerald-600 text-white';
            } else {
                btn.className = 'pool-pos-btn px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold transition-all text-slate-600 hover:bg-slate-100';
            }
        });
    }
    
    renderPoolSubPosChips();
    loadPoolPlayers(1);
}

function changePoolPage(delta) {
    const newPage = poolCurrentPage + delta;
    if (newPage >= 1 && newPage <= poolTotalPages) {
        loadPoolPlayers(newPage);
        window.scrollTo({ top: 120, behavior: 'smooth' });
    }
}

async function loadPoolPlayers(page = 1) {
    poolCurrentPage = page;
    const search = document.getElementById('pool-search-input')?.value || '';
    const minOvr = document.getElementById('pool-min-ovr')?.value || '0';
    const container = document.getElementById('pool-players-container');
    if (!container) return;

    container.innerHTML = `
        <div class="col-span-full py-16 text-center text-slate-400">
            <i class="fa-solid fa-circle-notch fa-spin text-3xl mb-2 text-emerald-500"></i>
            <p class="text-xs font-bold">Loading ${currentPoolCategory.replace(/_/g, ' ')} players...</p>
        </div>
    `;

    try {
        const params = new URLSearchParams({
            type: currentPoolCategory,
            search: search,
            position: poolSpecificPosition,
            position_category: poolPosCat,
            min_ovr: minOvr,
            page: poolCurrentPage,
            limit: 24
        });

        const res = await fetch(`/api/auction/pools?${params.toString()}`);
        const data = await res.json();

        // Update category counter badges
        if (data.counts) {
            const countToAuction = document.getElementById('pool-count-to_be_auctioned');
            const countUnsold = document.getElementById('pool-count-unsold');
            const countSold = document.getElementById('pool-count-sold');
            const navBadge = document.getElementById('nav-pool-unsold-badge');

            if (countToAuction) countToAuction.textContent = (data.counts.to_be_auctioned || 0).toLocaleString();
            if (countUnsold) countUnsold.textContent = (data.counts.unsold || 0).toLocaleString();
            if (countSold) countSold.textContent = (data.counts.sold || 0).toLocaleString();

            if (navBadge) {
                if (data.counts.unsold > 0) {
                    navBadge.textContent = data.counts.unsold;
                    navBadge.classList.remove('hidden');
                } else {
                    navBadge.classList.add('hidden');
                }
            }
        }

        poolTotalPages = data.total_pages || 1;
        const pageInfo = document.getElementById('pool-pagination-info');
        const prevBtn = document.getElementById('pool-prev-btn');
        const nextBtn = document.getElementById('pool-next-btn');

        if (pageInfo) pageInfo.textContent = `Showing Page ${data.page} of ${poolTotalPages} (${(data.total || 0).toLocaleString()} players)`;
        if (prevBtn) prevBtn.disabled = data.page <= 1;
        if (nextBtn) nextBtn.disabled = data.page >= poolTotalPages;

        if (!data.players || data.players.length === 0) {
            let emptyIcon = 'fa-users-slash';
            let emptyTitle = 'No players found';
            let emptyMsg = 'Try tweaking your search or position filter.';

            if (currentPoolCategory === 'unsold') {
                emptyIcon = 'fa-heart-crack';
                emptyTitle = 'No Unsold Players!';
                emptyMsg = 'All nominated players in this auction have found clubs.';
            } else if (currentPoolCategory === 'sold') {
                emptyIcon = 'fa-trophy';
                emptyTitle = 'No Players Sold Yet!';
                emptyMsg = 'Nominate players from the "To Be Auctioned" tab to get started.';
            }

            container.innerHTML = `
                <div class="col-span-full py-16 text-center text-slate-500 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-2">
                    <i class="fa-solid ${emptyIcon} text-4xl text-slate-300"></i>
                    <h4 class="text-base font-extrabold text-slate-800">${emptyTitle}</h4>
                    <p class="text-xs text-slate-500 font-medium">${emptyMsg}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        data.players.forEach(p => {
            container.appendChild(createPoolPlayerCard(p, currentPoolCategory));
        });

    } catch (err) {
        console.error('Failed to load pool players:', err);
        container.innerHTML = `<div class="col-span-full text-center text-rose-500 font-bold py-8">Error loading players. Please try again.</div>`;
    }
}

function createPoolPlayerCard(p, poolType) {
    const card = document.createElement('div');
    const isGold = p.overall_rating >= 80;
    const style = getPositionCardStyles(p.position, p.position_category, p.overall_rating);

    card.className = `fut-card ${style.cardClass} ${isGold ? 'gold-glow' : ''} p-4 sm:p-5 flex flex-col justify-between cursor-pointer group relative`;
    card.onclick = () => openPlayerModal(p.id);

    let topBanner = '';
    let actionArea = '';

    if (poolType === 'sold') {
        topBanner = `
            <div class="mb-2 px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-300 text-[10px] font-black flex items-center justify-between shadow-sm">
                <span class="truncate mr-1"><i class="fa-solid fa-trophy text-amber-500 mr-1"></i> ${p.manager_avatar || '👑'} ${p.manager_name}</span>
                <span class="font-mono text-emerald-700 dark:text-emerald-400 font-bold">${formatMoney(p.bought_price)}</span>
            </div>
        `;
        actionArea = `
            <div class="mt-3.5 pt-2.5 border-t border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
                <div>
                    <span class="text-[9px] uppercase font-black tracking-wider text-slate-400 dark:text-slate-500 block">Sold Price</span>
                    <span class="font-black text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 font-['Outfit']">${formatMoney(p.bought_price)}</span>
                </div>
                <button onclick="event.stopPropagation(); openPlayerLedgerModal(${p.id})" class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs uppercase transition-all shadow-sm active:scale-95 border border-slate-300 dark:border-slate-700 flex items-center space-x-1">
                    <i class="fa-solid fa-receipt text-amber-600"></i>
                    <span>Ledger</span>
                </button>
            </div>
        `;
    } else if (poolType === 'unsold') {
        topBanner = `
            <div class="mb-2 px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-300 text-[10px] font-black flex items-center justify-between shadow-sm">
                <span class="truncate mr-1"><i class="fa-solid fa-heart-crack text-rose-500 mr-1"></i> Passed Unsold</span>
                <span class="font-mono text-rose-700 dark:text-rose-400 font-bold">Base ₹${p.unmet_price || p.base_price}</span>
            </div>
        `;
        actionArea = `
            <div class="mt-3.5 pt-2.5 border-t border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
                <div>
                    <span class="text-[9px] uppercase font-black tracking-wider text-slate-400 dark:text-slate-500 block">Opening Base</span>
                    <span class="font-black text-xs sm:text-sm text-amber-600 dark:text-amber-400 font-['Outfit']">${formatMoney(p.base_price)}</span>
                </div>
                <button onclick="event.stopPropagation(); nominateAndJumpToArena(${p.id}, ${p.base_price})" class="px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 border border-rose-400 flex items-center space-x-1">
                    <i class="fa-solid fa-arrows-rotate"></i>
                    <span>Re-Nominate</span>
                </button>
            </div>
        `;
    } else {
        // to_be_auctioned
        actionArea = `
            <div class="mt-3.5 pt-2.5 border-t border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
                <div>
                    <span class="text-[9px] uppercase font-black tracking-wider text-slate-400 dark:text-slate-500 block">Base Price</span>
                    <span class="font-black text-xs sm:text-sm text-amber-600 dark:text-amber-400 font-['Outfit']">${formatMoney(p.base_price)}</span>
                </div>
                <button onclick="event.stopPropagation(); nominateAndJumpToArena(${p.id}, ${p.base_price})" class="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-500/20 active:scale-95 border border-emerald-400 flex items-center space-x-1">
                    <i class="fa-solid fa-gavel"></i>
                    <span>Nominate</span>
                </button>
            </div>
        `;
    }

    card.innerHTML = `
        <div>
            ${topBanner}
            <!-- Top Card Header: Rating & Pos on Left, Flag & Club on Right -->
            <div class="flex items-center justify-between mb-1.5">
                <div class="flex items-center space-x-1.5">
                    <span class="font-['Oswald'] text-2xl sm:text-3xl font-black leading-none text-slate-900 dark:text-white drop-shadow-sm">${p.overall_rating}</span>
                    <span class="font-['Oswald'] text-xs sm:text-sm font-extrabold tracking-wider px-2 py-0.5 rounded-lg ${style.posBadgeClass}">${p.position}</span>
                </div>
                <div class="flex items-center space-x-1.5">
                    ${p.flag_url ? `<img src="${p.flag_url}" alt="${p.nationality}" class="w-5 h-3.5 object-cover rounded-sm border border-slate-300 dark:border-slate-600 shadow-sm" onerror="this.style.display='none'">` : ''}
                    <img src="${p.club_logo_url || '/assets/default_club.svg'}" alt="${p.club_name}" class="w-6 h-6 object-contain" onerror="this.onerror=null; this.src='/assets/default_club.svg';">
                </div>
            </div>

            <!-- Big Centered Player Photo Portrait with Ambient Position Halo -->
            <div class="flex justify-center my-2 relative">
                <div class="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden relative shadow-lg ${style.haloClass} transition-transform group-hover:scale-105 duration-300 bg-white/40 dark:bg-slate-800/60 border-2 ${style.borderClass}">
                    <img src="${p.photo_url || '/assets/default_player.svg'}" alt="${p.name}" class="w-full h-full object-cover object-top" onerror="this.onerror=null; this.src='/assets/default_player.svg';">
                </div>
            </div>

            <!-- Player Name & Club Info Centered -->
            <div class="text-center pt-1">
                <h3 class="font-black text-sm sm:text-base text-slate-900 dark:text-white truncate group-hover:text-amber-500 transition-colors font-['Outfit']">${p.name}</h3>
                <p class="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">${p.club_name || 'Free Agent'}</p>
            </div>

            <!-- Card Face 6 Stats (Enlarged & High-Impact) -->
            <div class="grid grid-cols-6 gap-1 mt-3 text-center bg-slate-100/95 dark:bg-slate-800/90 py-2.5 px-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-inner">
                <div class="flex flex-col items-center">
                    <span class="font-['Oswald'] text-sm sm:text-base font-black leading-tight text-slate-900 dark:text-white">${p.card_pac}</span>
                    <span class="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-black">${p.position === 'GK' ? 'DIV' : 'PAC'}</span>
                </div>
                <div class="flex flex-col items-center">
                    <span class="font-['Oswald'] text-sm sm:text-base font-black leading-tight text-slate-900 dark:text-white">${p.card_sho}</span>
                    <span class="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-black">${p.position === 'GK' ? 'HAN' : 'SHO'}</span>
                </div>
                <div class="flex flex-col items-center">
                    <span class="font-['Oswald'] text-sm sm:text-base font-black leading-tight text-slate-900 dark:text-white">${p.card_pas}</span>
                    <span class="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-black">${p.position === 'GK' ? 'KIC' : 'PAS'}</span>
                </div>
                <div class="flex flex-col items-center">
                    <span class="font-['Oswald'] text-sm sm:text-base font-black leading-tight text-slate-900 dark:text-white">${p.card_dri}</span>
                    <span class="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-black">${p.position === 'GK' ? 'REF' : 'DRI'}</span>
                </div>
                <div class="flex flex-col items-center">
                    <span class="font-['Oswald'] text-sm sm:text-base font-black leading-tight text-slate-900 dark:text-white">${p.card_def}</span>
                    <span class="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-black">${p.position === 'GK' ? 'SPE' : 'DEF'}</span>
                </div>
                <div class="flex flex-col items-center">
                    <span class="font-['Oswald'] text-sm sm:text-base font-black leading-tight text-slate-900 dark:text-white">${p.card_phy}</span>
                    <span class="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-black">${p.position === 'GK' ? 'POS' : 'PHY'}</span>
                </div>
            </div>
        </div>

        ${actionArea}
    `;

    return card;
}

async function nominateAndJumpToArena(playerId, basePrice) {
    try {
        const res = await fetch('/api/auction/nominate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                player_id: playerId,
                starting_bid: basePrice || 50
            })
        });
        const data = await res.json();
        if (data.error) {
            showCustomToast('Nomination Error', data.error, 'error');
            return;
        }

        showCustomToast('Player Nominated', data.message || 'Player is now live on the auction block!', 'success');
        // Automatically switch to Live Auction tab so user sees arena immediately
        switchTab('auction');
    } catch (e) {
        console.error('Nominate error:', e);
        showCustomToast('Error', 'Failed to nominate player to auction block.', 'error');
    }
}

// ----------------- INITIALIZATION -----------------

document.addEventListener('DOMContentLoaded', () => {
    initFilters();
    renderSubPosChips();
    renderPoolSubPosChips();
    loadPlayers();
    loadAuctionState(true);

    // Background poll for live auction state (smart updates to prevent DOM flicker)
    auctionPollInterval = setInterval(() => {
        if (currentTab === 'auction' || currentTab === 'managers') {
            loadAuctionState(false);
        }
    }, 2000);

    // Search input debouncing (Explorer tab)
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                currentPage = 1;
                loadPlayers();
            }, 300);
        });
    }

    // Pool search input debouncing (Pool tab)
    const poolSearchInput = document.getElementById('pool-search-input');
    if (poolSearchInput) {
        poolSearchInput.addEventListener('input', () => {
            clearTimeout(poolSearchDebounce);
            poolSearchDebounce = setTimeout(() => {
                loadPoolPlayers(1);
            }, 300);
        });
    }
});

// ----------------- FILTERS & EXPLORER -----------------

let currentSpecificPosition = '';

async function initFilters() {
    try {
        const res = await fetch('/api/filters');
        const data = await res.json();
        
        const clubSelect = document.getElementById('club-filter');
        if (clubSelect && data.clubs) {
            data.clubs.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c;
                opt.textContent = c;
                clubSelect.appendChild(opt);
            });
        }
    } catch (err) {
        console.error('Failed to load filter autocompletes:', err);
    }
}

function updateRangeLabel(id) {
    const el = document.getElementById(id);
    const label = document.getElementById(`${id}-val`);
    if (el && label) {
        label.textContent = el.value;
    }
}

function renderSubPosChips() {
    const container = document.getElementById('sub-pos-chips-container');
    if (!container) return;
    const chips = POSITION_SUB_CHIPS[currentPosCat] || POSITION_SUB_CHIPS[''];
    
    container.innerHTML = chips.map(chip => {
        const isActive = currentSpecificPosition === chip.pos;
        let activeClass = '';
        if (isActive) {
            activeClass = 'bg-blue-600 text-white font-black shadow-sm border-blue-600';
        } else {
            activeClass = 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold border-slate-200 dark:border-slate-700';
        }
        return `
            <button onclick="setSpecificPosition('${chip.pos}')" class="px-2.5 py-1 rounded-lg border text-[11px] transition-all cursor-pointer ${activeClass}">
                ${chip.label}
            </button>
        `;
    }).join('');
}

function setSpecificPosition(pos) {
    currentSpecificPosition = pos;
    const posFilter = document.getElementById('position-filter');
    if (posFilter) {
        posFilter.value = pos;
    }
    renderSubPosChips();
    currentPage = 1;
    loadPlayers();
}

function onSpecificPositionChange() {
    const posFilter = document.getElementById('position-filter');
    currentSpecificPosition = posFilter ? posFilter.value : '';
    
    // Auto-update position category button if a specific position is picked
    if (currentSpecificPosition) {
        if (['ST', 'CF', 'LW', 'RW', 'LF', 'RF', 'LS', 'RS'].includes(currentSpecificPosition)) {
            currentPosCat = 'FWD';
        } else if (['CAM', 'CM', 'CDM', 'LM', 'RM', 'LAM', 'RAM', 'LCM', 'RCM', 'LDM', 'RDM'].includes(currentSpecificPosition)) {
            currentPosCat = 'MID';
        } else if (['CB', 'LB', 'RB', 'LWB', 'RWB', 'LCB', 'RCB'].includes(currentSpecificPosition)) {
            currentPosCat = 'DEF';
        } else if (currentSpecificPosition === 'GK') {
            currentPosCat = 'GK';
        }
        
        document.querySelectorAll('.pos-cat-btn').forEach(btn => {
            if (btn.textContent === currentPosCat) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
    
    renderSubPosChips();
    currentPage = 1;
    loadPlayers();
}

function setPositionCat(cat) {
    currentPosCat = cat;
    currentSpecificPosition = '';
    const posFilter = document.getElementById('position-filter');
    if (posFilter) posFilter.value = '';

    document.querySelectorAll('.pos-cat-btn').forEach(btn => {
        if ((cat === '' && btn.textContent === 'ALL') || btn.textContent === cat) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    renderSubPosChips();
    currentPage = 1;
    loadPlayers();
}

function applyFilters() {
    currentPage = 1;
    loadPlayers();
}

function resetFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('club-filter').value = '';
    document.getElementById('sort-by').value = 'overall_rating';
    
    const posFilter = document.getElementById('position-filter');
    if (posFilter) posFilter.value = '';
    currentSpecificPosition = '';

    document.getElementById('min-ovr').value = 75;
    document.getElementById('min-ovr-val').textContent = '75';
    document.getElementById('min-pot').value = 75;
    document.getElementById('min-pot-val').textContent = '75';
    document.getElementById('min-pac').value = 0;
    document.getElementById('min-pac-val').textContent = '0';
    
    currentPosCat = '';
    setPositionCat('');
}

async function loadPlayers() {
    const grid = document.getElementById('players-grid');
    const loader = document.getElementById('players-loader');
    
    if (loader) loader.classList.remove('hidden');
    if (grid) grid.innerHTML = '';

    const search = document.getElementById('search-input')?.value || '';
    const club = document.getElementById('club-filter')?.value || '';
    const sortBy = document.getElementById('sort-by')?.value || 'overall_rating';
    const minOvr = document.getElementById('min-ovr')?.value || 40;
    const minPot = document.getElementById('min-pot')?.value || 40;
    const minPac = document.getElementById('min-pac')?.value || 0;

    const params = new URLSearchParams({
        page: currentPage,
        limit: 24,
        search: search,
        club: club,
        position: currentSpecificPosition,
        pos_cat: currentPosCat,
        sort_by: sortBy,
        min_ovr: minOvr,
        min_pot: minPot,
        min_pac: minPac
    });

    try {
        const res = await fetch(`/api/players?${params.toString()}`);
        const data = await res.json();
        
        if (loader) loader.classList.add('hidden');
        
        totalPages = data.total_pages || 1;
        document.getElementById('player-count').textContent = (data.total || 0).toLocaleString();
        document.getElementById('page-info').textContent = `Page ${data.page} of ${totalPages}`;
        
        document.getElementById('prev-page-btn').disabled = data.page <= 1;
        document.getElementById('next-page-btn').disabled = data.page >= totalPages;

        if (!data.players || data.players.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full py-16 text-center text-slate-500 bg-white rounded-3xl border border-slate-200 shadow-sm">
                    <i class="fa-solid fa-user-slash text-4xl mb-3 text-slate-300"></i>
                    <p class="text-base font-bold text-slate-700">No players matched your filter criteria.</p>
                    <button onclick="resetFilters()" class="mt-3 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm">
                        Reset Filters
                    </button>
                </div>
            `;
            return;
        }

        data.players.forEach(p => {
            grid.appendChild(createPlayerCard(p));
        });

    } catch (err) {
        console.error('Error fetching players:', err);
        if (loader) loader.classList.add('hidden');
        grid.innerHTML = `<div class="col-span-full text-center text-rose-500 font-bold py-8">Failed to load players. Please make sure the backend server is running.</div>`;
    }
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        loadPlayers();
        window.scrollTo({ top: 120, behavior: 'smooth' });
    }
}

function nextPage() {
    if (currentPage < totalPages) {
        currentPage++;
        loadPlayers();
        window.scrollTo({ top: 120, behavior: 'smooth' });
    }
}

// ----------------- PLAYER CARD COMPONENT -----------------

function createPlayerCard(p) {
    const card = document.createElement('div');
    const isGold = p.overall_rating >= 80;
    const style = getPositionCardStyles(p.position, p.position_category, p.overall_rating);

    card.className = `fut-card ${style.cardClass} ${isGold ? 'gold-glow' : ''} p-4 sm:p-5 flex flex-col justify-between cursor-pointer group relative`;
    card.onclick = () => openPlayerModal(p.id);

    const soldBanner = p.is_sold ? `
        <div class="mb-2 px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-300 text-[10px] font-black flex items-center justify-between shadow-sm">
            <span class="truncate mr-1"><i class="fa-solid fa-trophy text-amber-500 mr-1"></i> Sold to ${p.sold_to_manager_avatar || '👑'} ${p.sold_to_manager_name}</span>
            <span class="font-mono text-emerald-700 dark:text-emerald-400 font-bold">${formatMoney(p.sold_price)}</span>
        </div>
    ` : '';

    const actionButton = p.is_sold ? `
        <button disabled class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-400 font-black text-xs uppercase cursor-not-allowed flex items-center shadow-none">
            <i class="fa-solid fa-check mr-1 text-slate-400"></i> Sold
        </button>
    ` : `
        <button onclick="event.stopPropagation(); nominatePlayerFromCard(${p.id}, ${p.base_price})" class="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 border border-amber-300">
            <i class="fa-solid fa-gavel mr-1"></i> Auction
        </button>
    `;

    card.innerHTML = `
        <div>
            ${soldBanner}
            <!-- Top Header Strip: Left (OVR & Position Badge), Right (Nation Flag & Club Logo) -->
            <div class="flex items-center justify-between mb-1.5">
                <div class="flex items-center space-x-1.5">
                    <span class="font-['Oswald'] text-2xl sm:text-3xl font-black leading-none text-slate-900 dark:text-white drop-shadow-sm">${p.overall_rating}</span>
                    <span class="font-['Oswald'] text-xs sm:text-sm font-extrabold tracking-wider px-2 py-0.5 rounded-lg ${style.posBadgeClass}">${p.position}</span>
                </div>
                <div class="flex items-center space-x-1.5">
                    ${p.flag_url ? `<img src="${p.flag_url}" alt="${p.nationality}" class="w-5 h-3.5 object-cover rounded-sm border border-slate-300 dark:border-slate-600 shadow-sm" onerror="this.style.display='none'">` : ''}
                    <img src="${p.club_logo_url || '/assets/default_club.svg'}" alt="${p.club_name}" class="w-6 h-6 object-contain" onerror="this.onerror=null; this.src='/assets/default_club.svg';">
                </div>
            </div>

            <!-- Big Centered Player Photo Portrait with Ambient Position Halo -->
            <div class="flex justify-center my-2 relative">
                <div class="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden relative shadow-lg ${style.haloClass} transition-transform group-hover:scale-105 duration-300 bg-white/40 dark:bg-slate-800/60 border-2 ${style.borderClass}">
                    <img src="${p.photo_url || '/assets/default_player.svg'}" alt="${p.name}" class="w-full h-full object-cover object-top" onerror="this.onerror=null; this.src='/assets/default_player.svg';">
                </div>
            </div>

            <!-- Player Name & Club Info Centered -->
            <div class="text-center pt-1">
                <h3 class="font-black text-sm sm:text-base text-slate-900 dark:text-white truncate group-hover:text-amber-500 transition-colors font-['Outfit']">${p.name}</h3>
                <p class="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">${p.club_name || 'Free Agent'}</p>
            </div>

            <!-- Card Face 6 Stats (Enlarged & High-Impact) -->
            <div class="grid grid-cols-6 gap-1 mt-3 text-center bg-slate-100/95 dark:bg-slate-800/90 py-2.5 px-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-inner">
                <div class="flex flex-col items-center">
                    <span class="font-['Oswald'] text-sm sm:text-base font-black leading-tight text-slate-900 dark:text-white">${p.card_pac}</span>
                    <span class="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-black">${p.position === 'GK' ? 'DIV' : 'PAC'}</span>
                </div>
                <div class="flex flex-col items-center">
                    <span class="font-['Oswald'] text-sm sm:text-base font-black leading-tight text-slate-900 dark:text-white">${p.card_sho}</span>
                    <span class="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-black">${p.position === 'GK' ? 'HAN' : 'SHO'}</span>
                </div>
                <div class="flex flex-col items-center">
                    <span class="font-['Oswald'] text-sm sm:text-base font-black leading-tight text-slate-900 dark:text-white">${p.card_pas}</span>
                    <span class="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-black">${p.position === 'GK' ? 'KIC' : 'PAS'}</span>
                </div>
                <div class="flex flex-col items-center">
                    <span class="font-['Oswald'] text-sm sm:text-base font-black leading-tight text-slate-900 dark:text-white">${p.card_dri}</span>
                    <span class="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-black">${p.position === 'GK' ? 'REF' : 'DRI'}</span>
                </div>
                <div class="flex flex-col items-center">
                    <span class="font-['Oswald'] text-sm sm:text-base font-black leading-tight text-slate-900 dark:text-white">${p.card_def}</span>
                    <span class="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-black">${p.position === 'GK' ? 'SPE' : 'DEF'}</span>
                </div>
                <div class="flex flex-col items-center">
                    <span class="font-['Oswald'] text-sm sm:text-base font-black leading-tight text-slate-900 dark:text-white">${p.card_phy}</span>
                    <span class="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-black">${p.position === 'GK' ? 'POS' : 'PHY'}</span>
                </div>
            </div>
        </div>

        <!-- Card Footer: Base Auction Price & Action Button -->
        <div class="mt-3.5 pt-2.5 border-t border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
            <div>
                <span class="text-[9px] uppercase font-black tracking-wider text-slate-400 dark:text-slate-500 block">Base Value</span>
                <span class="font-black text-xs sm:text-sm text-amber-600 dark:text-amber-400 font-['Outfit']">${formatMoney(p.base_price)}</span>
            </div>
            ${actionButton}
        </div>
    `;

    return card;
}

// ----------------- FIFA 19 PLAYER SPECIALITIES ENGINE -----------------

function computePlayerSpecialities(p) {
    if (!p) return [];
    if (p.specialities && Array.isArray(p.specialities) && p.specialities.length > 0) {
        return p.specialities;
    }

    const specs = [];
    const acc = Number(p.acceleration) || 0;
    const spd = Number(p.sprint_speed) || 0;
    const dri = Number(p.dribbling) || 0;
    const agi = Number(p.agility) || 0;
    const bal = Number(p.balance) || 0;
    const rea = Number(p.reactions) || 0;
    const pos = Number(p.positioning) || 0;
    const fin = Number(p.finishing) || 0;
    const shp = Number(p.shot_power) || 0;
    const lgs = Number(p.long_shots) || 0;
    const vis = Number(p.vision) || 0;
    const cro = Number(p.crossing) || 0;
    const fka = Number(p.free_kick_accuracy) || 0;
    const spa = Number(p.short_passing) || 0;
    const lpa = Number(p.long_passing) || 0;
    const cur = Number(p.curve) || 0;
    const itc = Number(p.interceptions) || 0;
    const hea = Number(p.heading_accuracy) || 0;
    const stt = Number(p.standing_tackle) || 0;
    const slt = Number(p.sliding_tackle) || 0;
    const jmp = Number(p.jumping) || 0;
    const sta = Number(p.stamina) || 0;
    const str = Number(p.strength) || 0;
    const ht = Number(p.height_cm) || 180;
    const wt = Number(p.weight_kg) || 75;
    const skills = Number(p.skill_moves) || 3;
    const position = (p.position || '').toUpperCase();

    const gkd = Number(p.gk_diving) || 0;
    const gkh = Number(p.gk_handling) || 0;
    const gkp = Number(p.gk_positioning) || 0;
    const gkr = Number(p.gk_reflexes) || 0;

    if (position === 'GK') {
        if (gkd >= 86 && gkr >= 86) {
            specs.push({ name: 'Acrobatic GK', icon: 'fa-shield-cat', color: 'amber', desc: 'Spectacular diving and reflex shot-stopping' });
        }
        if (gkp >= 86 && gkh >= 86) {
            specs.push({ name: 'Traditional GK', icon: 'fa-hands', color: 'blue', desc: 'Commanding aerial handling and positional discipline' });
        }
        return specs;
    }

    if ((acc + spd) >= 180) {
        specs.push({ name: 'Speedster', icon: 'fa-bolt', color: 'amber', desc: 'Lightning pace & acceleration' });
    }
    if ((dri >= 86 && agi >= 75) || (skills >= 5 && dri >= 85)) {
        specs.push({ name: 'Dribbler', icon: 'fa-wand-magic-sparkles', color: 'purple', desc: 'Elite ball control & agility' });
    }
    if (lgs >= 86 && shp >= 86) {
        specs.push({ name: 'Distance Shooter', icon: 'fa-bullseye', color: 'rose', desc: 'Lethal long-range shooting power' });
    }
    if (vis >= 86 && spa >= 86 && lpa >= 73) {
        specs.push({ name: 'Playmaker', icon: 'fa-brain', color: 'blue', desc: 'Master of vision and chance creation' });
    }
    if (cro >= 86 && cur >= 80) {
        specs.push({ name: 'Crosser', icon: 'fa-share-nodes', color: 'cyan', desc: 'Pinpoint wing delivery & curve' });
    }
    if (fka >= 86 && (cur >= 85 || shp >= 85)) {
        specs.push({ name: 'FK Specialist', icon: 'fa-futbol', color: 'emerald', desc: 'Deadly set-piece precision' });
    }
    if ((fin >= 85 && hea >= 85 && pos >= 85) || (fin >= 88 && pos >= 88)) {
        specs.push({ name: 'Poacher', icon: 'fa-crosshairs', color: 'red', desc: 'Instinctual predator in the 18-yard box' });
    }
    if (fin >= 86 && lgs >= 80) {
        specs.push({ name: 'Clinical Finisher', icon: 'fa-fire', color: 'orange', desc: 'Ruthless accuracy in front of goal' });
    }
    if ((hea >= 90 && (jmp >= 85 || ht >= 188)) || (hea >= 86 && ht >= 185 && jmp >= 80)) {
        specs.push({ name: 'Aerial Threat', icon: 'fa-plane-departure', color: 'sky', desc: 'Dominant in the air with towering leap' });
    }
    if (stt >= 86 && slt >= 85) {
        specs.push({ name: 'Tackling', icon: 'fa-shield-halved', color: 'indigo', desc: 'Rock-solid tackling efficiency' });
    }
    if (itc >= 86 && rea >= 80) {
        specs.push({ name: 'Tactician', icon: 'fa-compass', color: 'teal', desc: 'Anticipates play with elite interceptions' });
    }
    if ((str >= 86 && wt >= 83) || str >= 90) {
        specs.push({ name: 'Strength', icon: 'fa-dumbbell', color: 'amber', desc: 'Physical powerhouse' });
    }
    if ((agi >= 90 && rea >= 80) || (agi >= 86 && jmp >= 86)) {
        specs.push({ name: 'Acrobat', icon: 'fa-person-running', color: 'fuchsia', desc: 'Extreme agility & body control' });
    }
    if (sta >= 88 && (agi >= 70 || spa >= 75)) {
        specs.push({ name: 'Engine', icon: 'fa-gauge-high', color: 'lime', desc: 'High stamina covering full pitch' });
    }

    const specNames = new Set(specs.map(s => s.name));
    if ((specNames.has('Poacher') || specNames.has('Clinical Finisher')) && 
        ['Speedster', 'Dribbler', 'Aerial Threat', 'Distance Shooter', 'Strength', 'Acrobat'].filter(x => specNames.has(x)).length >= 2) {
        specs.unshift({ name: 'Complete Forward', icon: 'fa-crown', color: 'yellow', desc: 'Ultimate all-round attacking superstar' });
    }
    if (specNames.has('Playmaker') && 
        ['Distance Shooter', 'Engine', 'Dribbler', 'Crosser', 'FK Specialist', 'Tackling', 'Tactician'].filter(x => specNames.has(x)).length >= 2) {
        specs.unshift({ name: 'Complete Midfielder', icon: 'fa-crown', color: 'yellow', desc: 'Dominates both attack and midfield control' });
    }
    if (specNames.has('Tackling') && specNames.has('Tactician') && 
        ['Aerial Threat', 'Strength', 'Speedster'].filter(x => specNames.has(x)).length >= 1) {
        specs.unshift({ name: 'Complete Defender', icon: 'fa-crown', color: 'yellow', desc: 'World-class defensive rock' });
    }

    return specs;
}

function getSpecialityBadgeStyle(color) {
    switch (color) {
        case 'yellow': return 'bg-amber-100 dark:bg-amber-950/70 border-amber-400 text-amber-950 dark:text-amber-200 font-black ring-1 ring-amber-400/50 shadow-sm';
        case 'amber': return 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 text-amber-900 dark:text-amber-200';
        case 'rose':
        case 'red': return 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 text-rose-900 dark:text-rose-200';
        case 'orange': return 'bg-orange-50 dark:bg-orange-950/50 border-orange-300 text-orange-900 dark:text-orange-200';
        case 'purple':
        case 'fuchsia': return 'bg-purple-50 dark:bg-purple-950/50 border-purple-300 text-purple-900 dark:text-purple-200';
        case 'blue':
        case 'sky':
        case 'cyan': return 'bg-blue-50 dark:bg-blue-950/50 border-blue-300 text-blue-900 dark:text-blue-200';
        case 'emerald':
        case 'lime':
        case 'teal': return 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 text-emerald-900 dark:text-emerald-200';
        case 'indigo': return 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 text-indigo-900 dark:text-indigo-200';
        default: return 'bg-slate-100 dark:bg-slate-800 border-slate-300 text-slate-900 dark:text-slate-200';
    }
}

// ----------------- PLAYER DETAIL MODAL (ALL 30+ STATS & SPECIALITIES) -----------------

async function openPlayerModal(playerId) {
    const modal = document.getElementById('player-modal');
    const content = document.getElementById('player-modal-content');
    
    modal.classList.remove('hidden');
    content.innerHTML = `<div class="py-16 text-center"><i class="fa-solid fa-circle-notch fa-spin text-4xl text-amber-500"></i></div>`;

    try {
        const res = await fetch(`/api/players/${playerId}`);
        const p = await res.json();
        const specialities = computePlayerSpecialities(p);
        
        const posColor = p.position_category === 'FWD' ? 'text-rose-600' :
                         p.position_category === 'MID' ? 'text-blue-600' :
                         p.position_category === 'DEF' ? 'text-emerald-600' : 'text-amber-600';

        const soldBanner = p.is_sold ? `
            <div class="p-3 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-center justify-between text-xs font-bold text-amber-900 shadow-sm">
                <span><i class="fa-solid fa-trophy text-amber-500 text-base mr-2"></i> Player Owned by ${p.sold_to_manager_avatar || '👑'} ${p.sold_to_manager_name}</span>
                <span class="font-['Outfit'] font-black text-emerald-700 text-sm">Bought for ${formatMoney(p.sold_price)}</span>
            </div>
        ` : '';

        const actionButton = p.is_sold ? `
            <button disabled class="px-5 py-2.5 rounded-xl bg-slate-200 text-slate-400 font-black text-xs uppercase cursor-not-allowed border border-slate-300">
                ✓ Already Auctioned (${formatMoney(p.sold_price)})
            </button>
        ` : `
            <button onclick="nominatePlayerFromCard(${p.id}, ${p.base_price}); closePlayerModal();" class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/25 transition-all border border-amber-300">
                <i class="fa-solid fa-gavel mr-1.5"></i> Put on Auction Block
            </button>
        `;

        content.innerHTML = `
            ${soldBanner}
            <!-- Modal Header -->
            <div class="flex items-center space-x-4 border-b border-slate-100 pb-5">
                <div class="w-20 h-20 rounded-2xl bg-amber-50 border-2 border-amber-300 overflow-hidden flex-shrink-0 shadow-md">
                    <img src="${p.photo_url || '/assets/default_player.svg'}" alt="${p.name}" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='/assets/default_player.svg';">
                </div>
                <div class="flex-1">
                    <div class="flex items-center space-x-2.5">
                        <h2 class="font-['Outfit'] text-2xl sm:text-3xl font-black text-slate-900">${p.name}</h2>
                        <span class="px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-800 font-black text-sm border border-amber-300 shadow-sm">${p.overall_rating} OVR</span>
                        <span class="px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 font-black text-sm border border-emerald-300 shadow-sm">${p.potential} POT</span>
                    </div>
                    <p class="text-xs font-bold text-slate-500 mt-1">
                        <span class="font-black ${posColor}">${p.position}</span> • 
                        <span>${p.club_name || 'Free Agent'}</span> • 
                        <span>${p.nationality}</span> • 
                        <span>${p.age} Years Old</span>
                    </p>
                    <div class="flex items-center space-x-4 mt-2 text-xs font-bold text-slate-600">
                        <span>Value: <strong class="text-slate-900">${formatMoney(p.value_eur)}</strong></span>
                        <span>Wage: <strong class="text-slate-900">${formatMoney(p.wage_eur)}/wk</strong></span>
                        <span>Auction Base: <strong class="text-amber-600 text-sm font-['Outfit']">${formatMoney(p.base_price)}</strong></span>
                    </div>
                </div>
            </div>

            <!-- FIFA 19 Player Specialities & Trait Badges Section -->
            <div class="bg-gradient-to-r from-slate-50 via-amber-50/50 to-slate-50 p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-2">
                <div class="flex items-center justify-between border-b border-slate-200/80 pb-2">
                    <h4 class="font-black text-xs text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                        <i class="fa-solid fa-medal text-amber-500 text-sm"></i>
                        <span>FIFA 19 Player Specialities (${specialities.length})</span>
                    </h4>
                    <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Official In-Game Traits</span>
                </div>
                <div class="flex flex-wrap gap-2 pt-1">
                    ${specialities.length > 0 ? specialities.map(s => `
                        <div class="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-black shadow-sm transition-all hover:scale-105 cursor-default ${getSpecialityBadgeStyle(s.color)}" title="${s.desc}">
                            <i class="fa-solid ${s.icon}"></i>
                            <span>${s.name}</span>
                        </div>
                    `).join('') : `
                        <div class="text-xs text-slate-400 italic py-1 flex items-center space-x-1.5">
                            <i class="fa-solid fa-circle-check text-slate-300"></i>
                            <span>Standard Player Profile (No Elite Speciality Badges)</span>
                        </div>
                    `}
                </div>
            </div>

            <!-- Profile Info & 6 Categorized Attribute Boxes -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- Physical & Skills Breakdown -->
                <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
                    <h4 class="font-black text-slate-800 uppercase tracking-wider mb-2">Player Characteristics</h4>
                    <div class="flex justify-between py-1.5 border-b border-slate-200">
                        <span class="text-slate-500 font-semibold">Preferred Foot:</span>
                        <span class="font-bold text-slate-900">${p.preferred_foot || 'Right'}</span>
                    </div>
                    <div class="flex justify-between py-1.5 border-b border-slate-200">
                        <span class="text-slate-500 font-semibold">Skill Moves:</span>
                        <span class="font-black text-amber-500 text-sm">${'★'.repeat(p.skill_moves || 3)}${'☆'.repeat(Math.max(0, 5 - (p.skill_moves || 3)))}</span>
                    </div>
                    <div class="flex justify-between py-1.5 border-b border-slate-200">
                        <span class="text-slate-500 font-semibold">Weak Foot:</span>
                        <span class="font-black text-amber-500 text-sm">${'★'.repeat(p.weak_foot || 3)}${'☆'.repeat(Math.max(0, 5 - (p.weak_foot || 3)))}</span>
                    </div>
                    <div class="flex justify-between py-1.5 border-b border-slate-200">
                        <span class="text-slate-500 font-semibold">Work Rate:</span>
                        <span class="font-bold text-slate-900">${p.work_rate || 'Medium / Medium'}</span>
                    </div>
                    <div class="flex justify-between py-1.5 border-b border-slate-200">
                        <span class="text-slate-500 font-semibold">Height / Weight:</span>
                        <span class="font-bold text-slate-900">${p.height_cm || 180} cm / ${p.weight_kg || 75} kg</span>
                    </div>
                </div>

                <!-- 6 Card Summary Attributes -->
                <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
                    <h4 class="font-black text-slate-800 uppercase tracking-wider mb-2">Card Rating Breakdown</h4>
                    <div class="space-y-2">
                        ${renderStatBar(p.position === 'GK' ? 'Diving (DIV)' : 'Pace (PAC)', p.card_pac)}
                        ${renderStatBar(p.position === 'GK' ? 'Handling (HAN)' : 'Shooting (SHO)', p.card_sho)}
                        ${renderStatBar(p.position === 'GK' ? 'Kicking (KIC)' : 'Passing (PAS)', p.card_pas)}
                        ${renderStatBar(p.position === 'GK' ? 'Reflexes (REF)' : 'Dribbling (DRI)', p.card_dri)}
                        ${renderStatBar(p.position === 'GK' ? 'Speed (SPE)' : 'Defending (DEF)', p.card_def)}
                        ${renderStatBar(p.position === 'GK' ? 'Positioning (POS)' : 'Physicality (PHY)', p.card_phy)}
                    </div>
                </div>
            </div>

            <!-- Complete Categorized 30+ In-Game Stats Grid -->
            <div class="space-y-3">
                <h4 class="font-black text-sm text-slate-900 uppercase tracking-wide">All 30+ In-Depth FIFA 19 Attributes</h4>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <!-- Pace & Shooting -->
                    <div class="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                        <span class="font-black text-rose-700 uppercase tracking-wider text-[11px] block border-b border-slate-200 pb-1">🏃 Pace & 🎯 Shooting</span>
                        <div class="space-y-1.5">
                            ${renderStatPill('Acceleration', p.acceleration)}
                            ${renderStatPill('Sprint Speed', p.sprint_speed)}
                            ${renderStatPill('Positioning', p.positioning)}
                            ${renderStatPill('Finishing', p.finishing)}
                            ${renderStatPill('Shot Power', p.shot_power)}
                            ${renderStatPill('Long Shots', p.long_shots)}
                            ${renderStatPill('Volleys', p.volleys)}
                            ${renderStatPill('Penalties', p.penalties)}
                        </div>
                    </div>

                    <!-- Passing & Dribbling -->
                    <div class="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                        <span class="font-black text-blue-700 uppercase tracking-wider text-[11px] block border-b border-slate-200 pb-1">🪄 Passing & ⚡ Dribbling</span>
                        <div class="space-y-1.5">
                            ${renderStatPill('Vision', p.vision)}
                            ${renderStatPill('Crossing', p.crossing)}
                            ${renderStatPill('Free Kick Acc', p.free_kick_accuracy)}
                            ${renderStatPill('Short Passing', p.short_passing)}
                            ${renderStatPill('Long Passing', p.long_passing)}
                            ${renderStatPill('Curve', p.curve)}
                            ${renderStatPill('Agility', p.agility)}
                            ${renderStatPill('Balance', p.balance)}
                            ${renderStatPill('Reactions', p.reactions)}
                            ${renderStatPill('Ball Control', p.ball_control)}
                            ${renderStatPill('Dribbling', p.dribbling)}
                            ${renderStatPill('Composure', p.composure)}
                        </div>
                    </div>

                    <!-- Defending, Physical & GK -->
                    <div class="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                        <span class="font-black text-emerald-700 uppercase tracking-wider text-[11px] block border-b border-slate-200 pb-1">🛡️ Defending & 💪 Physical</span>
                        <div class="space-y-1.5">
                            ${renderStatPill('Interceptions', p.interceptions)}
                            ${renderStatPill('Heading Acc', p.heading_accuracy)}
                            ${renderStatPill('Marking', p.marking)}
                            ${renderStatPill('Standing Tackle', p.standing_tackle)}
                            ${renderStatPill('Sliding Tackle', p.sliding_tackle)}
                            ${renderStatPill('Jumping', p.jumping)}
                            ${renderStatPill('Stamina', p.stamina)}
                            ${renderStatPill('Strength', p.strength)}
                            ${renderStatPill('Aggression', p.aggression)}
                            ${p.position === 'GK' ? `
                                <div class="pt-2 border-t border-slate-200">
                                    <span class="font-black text-amber-700 uppercase text-[10px] block mb-1">🧤 Goalkeeping</span>
                                    ${renderStatPill('GK Diving', p.gk_diving)}
                                    ${renderStatPill('GK Handling', p.gk_handling)}
                                    ${renderStatPill('GK Kicking', p.gk_kicking)}
                                    ${renderStatPill('GK Positioning', p.gk_positioning)}
                                    ${renderStatPill('GK Reflexes', p.gk_reflexes)}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal Action Buttons -->
            <div class="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button onclick="closePlayerModal()" class="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider transition-all">
                    Close
                </button>
                ${actionButton}
            </div>
        `;
    } catch (err) {
        console.error('Failed to load player modal:', err);
        content.innerHTML = `<div class="text-center text-rose-500 font-bold py-8">Failed to load player details.</div>`;
    }
}

function renderStatPill(name, val) {
    if (val === undefined || val === null) val = 50;
    const color = val >= 80 ? 'text-emerald-700 bg-emerald-100' :
                  val >= 70 ? 'text-amber-800 bg-amber-100' :
                  val >= 60 ? 'text-orange-800 bg-orange-100' : 'text-slate-700 bg-slate-100';
    return `
        <div class="flex items-center justify-between py-0.5">
            <span class="text-slate-600 font-semibold">${name}</span>
            <span class="px-2 py-0.5 rounded font-black font-['Oswald'] text-xs ${color}">${val}</span>
        </div>
    `;
}

function renderStatBar(name, val) {
    if (val === undefined || val === null) val = 50;
    const color = val >= 80 ? 'bg-emerald-500' : val >= 70 ? 'bg-amber-500' : val >= 60 ? 'bg-orange-400' : 'bg-rose-400';
    return `
        <div>
            <div class="flex justify-between text-[11px] font-bold mb-0.5">
                <span class="text-slate-600">${name}</span>
                <span class="text-slate-900 font-black">${val}</span>
            </div>
            <div class="w-full h-2 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                <div class="${color} h-full rounded-full transition-all" style="width: ${Math.min(100, Math.max(5, val))}%"></div>
            </div>
        </div>
    `;
}

function closePlayerModal() {
    document.getElementById('player-modal').classList.add('hidden');
}

function renderStatBar(name, val) {
    const color = val >= 80 ? 'bg-emerald-500' : val >= 70 ? 'bg-amber-500' : val >= 60 ? 'bg-orange-400' : 'bg-rose-400';
    return `
        <div>
            <div class="flex justify-between text-[11px] font-bold mb-0.5">
                <span class="text-slate-600">${name}</span>
                <span class="text-slate-900 font-black">${val}</span>
            </div>
            <div class="w-full h-2 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                <div class="${color} h-full rounded-full transition-all" style="width: ${Math.min(100, Math.max(5, val))}%"></div>
            </div>
        </div>
    `;
}

function closePlayerModal() {
    document.getElementById('player-modal').classList.add('hidden');
}

// ----------------- AUCTION ARENA & BIDDING (ZERO FLICKER) -----------------

async function loadAuctionState(forceRender = false) {
    try {
        const res = await fetch('/api/auction/state');
        const data = await res.json();
        currentAuctionState = data;
        
        updateAuctionUI(data, forceRender);
    } catch (err) {
        console.error('Error fetching auction state:', err);
    }
}

// ----------------- SOLD CELEBRATION & AUDIO FANFARE -----------------

let isInitialAuctionLoad = true;
let lastCelebratedTimestamp = 0;
let lastKnownBid = 0;
let lastKnownBidderId = null;
let bidToastTimeout = null;
let lastBidTapTime = 0;

// ----------------- POKER TABLE FELT BID TAP (2 GENTLE KNUCKLE TAPS) -----------------

function playBidTap() {
    const now = Date.now();
    if (now - lastBidTapTime < 250) return; // Prevent double-triggering
    lastBidTapTime = now;

    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();

        // Helper to produce a gentle felt table knock / poker tap
        const playPokerFeltTap = (startTime, freq) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, startTime);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.45, startTime + 0.035);

            gain.gain.setValueAtTime(0.08, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.035);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(startTime);
            osc.stop(startTime + 0.04);
        };

        // Poker table double knuckle tap (tap-tap on felt)
        playPokerFeltTap(ctx.currentTime, 220);          // Tap 1
        playPokerFeltTap(ctx.currentTime + 0.065, 260);  // Tap 2
    } catch (e) {
        console.error('Bid tap audio error:', e);
    }
}

function showBidNotificationToast(leadingBidder, newBid) {
    if (!leadingBidder) return;
    const toast = document.getElementById('live-bid-toast');
    if (!toast) return;

    playBidTap();

    document.getElementById('toast-mgr-avatar').textContent = leadingBidder.avatar || '⚡';
    document.getElementById('toast-title').textContent = 'NEW BID PLACED!';
    document.getElementById('toast-desc').textContent = `${leadingBidder.name} raised the bid`;
    document.getElementById('toast-amount').textContent = formatMoney(newBid);

    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.remove('opacity-0', '-translate-y-2');
    }, 10);

    // Flash bid display
    const bidBox = document.getElementById('stage-current-bid')?.parentElement;
    if (bidBox) {
        bidBox.classList.remove('bid-flash');
        void bidBox.offsetWidth; // trigger reflow
        bidBox.classList.add('bid-flash');
    }

    clearTimeout(bidToastTimeout);
    bidToastTimeout = setTimeout(() => {
        toast.classList.add('opacity-0', '-translate-y-2');
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, 3500);
}

// ----------------- AUTHENTIC AUCTIONEER WOODEN GAVEL STRIKE SOUND -----------------

function playAuctionGavelSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();

        // 1. Sharp wooden gavel impact click (crack)
        const snapOsc = ctx.createOscillator();
        const snapGain = ctx.createGain();
        snapOsc.type = 'triangle';
        snapOsc.frequency.setValueAtTime(900, ctx.currentTime);
        snapOsc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.035);

        snapGain.gain.setValueAtTime(0.35, ctx.currentTime);
        snapGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);

        snapOsc.connect(snapGain);
        snapGain.connect(ctx.destination);
        snapOsc.start(ctx.currentTime);
        snapOsc.stop(ctx.currentTime + 0.04);

        // 2. Resonant hardwood soundblock body (hollow wooden knock)
        const bodyOsc = ctx.createOscillator();
        const bodyGain = ctx.createGain();
        bodyOsc.type = 'sine';
        bodyOsc.frequency.setValueAtTime(240, ctx.currentTime);
        bodyOsc.frequency.exponentialRampToValueAtTime(75, ctx.currentTime + 0.12);

        bodyGain.gain.setValueAtTime(0.28, ctx.currentTime);
        bodyGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

        bodyOsc.connect(bodyGain);
        bodyGain.connect(ctx.destination);
        bodyOsc.start(ctx.currentTime);
        bodyOsc.stop(ctx.currentTime + 0.13);

        // 3. Subtle acoustic soundboard tone (warm wood ring)
        const ringOsc = ctx.createOscillator();
        const ringGain = ctx.createGain();
        ringOsc.type = 'sine';
        ringOsc.frequency.setValueAtTime(460, ctx.currentTime + 0.01);
        ringOsc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.22);

        ringGain.gain.setValueAtTime(0.12, ctx.currentTime + 0.01);
        ringGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);

        ringOsc.connect(ringGain);
        ringGain.connect(ctx.destination);
        ringOsc.start(ctx.currentTime + 0.01);
        ringOsc.stop(ctx.currentTime + 0.23);
    } catch (e) {
        console.error('Auction gavel audio error:', e);
    }
}

function triggerSoldCelebration(lastSold) {
    if (!lastSold || !lastSold.timestamp) return;
    if (lastSold.timestamp <= lastCelebratedTimestamp) return;
    lastCelebratedTimestamp = lastSold.timestamp;

    // Play crisp authentic wooden auction gavel strike (Hammer down!)
    playAuctionGavelSound();

    // Fire Confetti multi-bursts
    if (typeof confetti === 'function') {
        confetti({
            particleCount: 80,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#f59e0b', '#fbbf24', '#10b981', '#3b82f6', '#ef4444']
        });
        setTimeout(() => {
            confetti({
                particleCount: 50,
                angle: 60,
                spread: 55,
                origin: { x: 0 }
            });
            confetti({
                particleCount: 50,
                angle: 120,
                spread: 55,
                origin: { x: 1 }
            });
        }, 250);
    }

    // Populate Overlay
    document.getElementById('celebrate-p-photo').src = lastSold.player_photo || '/assets/default_player.svg';
    document.getElementById('celebrate-p-name').textContent = lastSold.player_name;
    document.getElementById('celebrate-mgr-name').textContent = `${lastSold.manager_avatar || '👑'} ${lastSold.manager_name}`;
    document.getElementById('celebrate-price').textContent = formatFullMoney(lastSold.price);

    const overlay = document.getElementById('sold-celebration-overlay');
    const box = document.getElementById('celebration-box');
    overlay.classList.remove('hidden');
    setTimeout(() => box.classList.remove('scale-95'), 20);
}

function dismissCelebration() {
    const overlay = document.getElementById('sold-celebration-overlay');
    const box = document.getElementById('celebration-box');
    box.classList.add('scale-95');
    setTimeout(() => overlay.classList.add('hidden'), 200);
}

function updateAuctionUI(data, forceRender = false) {
    const { state, current_player, leading_bidder, managers, history, last_sold, last_unsold } = data;

    // Detect new incoming bid for instant notification
    if (state.is_active && state.current_bid > lastKnownBid && lastKnownBid > 0 && leading_bidder) {
        showBidNotificationToast(leading_bidder, state.current_bid);
    }
    lastKnownBid = state.current_bid;
    lastKnownBidderId = state.current_bidder_id;

    // Check for sale or unsold outcome (ONLY on live dynamic events, not on page startup)
    if (isInitialAuctionLoad) {
        if (last_sold && last_sold.timestamp) {
            lastCelebratedTimestamp = last_sold.timestamp;
        }
        if (last_unsold && last_unsold.timestamp) {
            lastUnsoldTimestamp = last_unsold.timestamp;
        }
        isInitialAuctionLoad = false;
    } else {
        if (last_sold && last_sold.timestamp > lastCelebratedTimestamp && !state.is_active) {
            triggerSoldCelebration(last_sold);
        } else if (last_unsold && last_unsold.timestamp > lastUnsoldTimestamp && !state.is_active) {
            triggerUnsoldNotification(last_unsold);
        }
    }

    // 0. Sync Live Timer Engine
    if (state && state.server_time) {
        serverClockOffset = (Date.now() / 1000) - state.server_time;
    }
    if (state && state.timer_end_timestamp) {
        currentTimerEndTimestamp = state.timer_end_timestamp;
    }
    updateLiveTimerDisplay();
    startLiveTimerCountdown();

    // 1. Update Auction Badge in Navigation
    const badge = document.getElementById('auction-badge');
    if (badge) {
        if (state && state.is_active) {
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    // 2. Render Stage Spotlight Player ONLY when changed
    const cardContainer = document.getElementById('auction-card-container');
    const curId = (state.is_active && current_player) ? current_player.id : null;
    
    if (cardContainer && (forceRender || curId !== lastNominatedPlayerId)) {
        lastNominatedPlayerId = curId;
        if (state.is_active && current_player) {
            cardContainer.innerHTML = createBigStageCard(current_player);
        } else {
            cardContainer.innerHTML = `
                <div class="w-60 h-84 rounded-3xl border-3 border-dashed border-amber-300 bg-amber-50/60 flex flex-col items-center justify-center p-6 text-center text-slate-600 shadow-sm space-y-3">
                    <div class="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-2xl shadow-inner animate-pulse">
                        <i class="fa-solid fa-gavel"></i>
                    </div>
                    <div>
                        <h4 class="text-sm font-black uppercase text-slate-900 font-['Outfit']">Awaiting Nomination</h4>
                        <p class="text-[11px] text-slate-500 font-semibold mt-1">Select a player to put on the auction block</p>
                    </div>
                    <button onclick="quickNominateRandom()" class="px-4 py-2 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 border border-amber-300">
                        <i class="fa-solid fa-dice mr-1"></i> Spin Nominee
                    </button>
                </div>
            `;
        }
    }

    // 3. Update Current Highest Bid & Leading Bidder
    const curBidEl = document.getElementById('stage-current-bid');
    const leadingEl = document.getElementById('stage-leading-manager');
    const statusBadge = document.getElementById('auction-status-badge');

    if (curBidEl) {
        if (state.is_active) {
            curBidEl.textContent = formatFullMoney(state.current_bid);
        } else {
            curBidEl.textContent = 'Waiting...';
        }
    }

    if (leadingEl) {
        if (state.is_active) {
            if (leading_bidder) {
                const claimBadge = leading_bidder.claimed_by ? ` (Bid by ${leading_bidder.claimed_by})` : '';
                leadingEl.textContent = `${leading_bidder.avatar} ${leading_bidder.name}${claimBadge}`;
            } else {
                leadingEl.textContent = 'None (Opening Price)';
            }
        } else {
            leadingEl.textContent = 'Stage Idle';
        }
    }

    if (statusBadge) {
        if (state.is_active) {
            statusBadge.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-white animate-ping"></span><span>LIVE BIDDING IN PROGRESS</span>`;
            statusBadge.className = 'px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500 text-white border border-emerald-400 flex items-center space-x-2 shadow-md';
        } else {
            statusBadge.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span><span>WAITING FOR NOMINATION</span>`;
            statusBadge.className = 'px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300 flex items-center space-x-2';
        }
    }

    // 4. Render Live Bidding Ledger Table
    const ledgerTbody = document.getElementById('bid-ledger-tbody');
    const ledgerCount = document.getElementById('ledger-bid-count');
    
    if (ledgerTbody && history) {
        // Filter bids for the current nominated player if active, or recent bids
        const curPlayerId = state.is_active && current_player ? current_player.id : null;
        let relevantBids = curPlayerId ? history.filter(h => h.player_id === curPlayerId) : history;

        if (ledgerCount) {
            const actualBids = relevantBids.filter(h => h.bid_type === 'BID');
            ledgerCount.textContent = `${actualBids.length} ${actualBids.length === 1 ? 'BID' : 'BIDS'}`;
        }

        if (relevantBids.length === 0) {
            ledgerTbody.innerHTML = `
                <tr>
                    <td colspan="5" class="py-12 text-center text-slate-400 font-bold bg-slate-50/50">
                        <div class="flex flex-col items-center justify-center space-y-1.5">
                            <i class="fa-solid fa-hourglass-start text-amber-500 text-2xl animate-pulse"></i>
                            <span class="text-xs text-slate-600 font-extrabold font-['Outfit']">Waiting for bids from mobile managers...</span>
                            <span class="text-[11px] text-slate-400 font-semibold">Opening price: ${formatMoney(state.current_bid || 50)}</span>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            // Sort chronologically ascending to calculate raises & sequence numbers
            const chronological = [...relevantBids].reverse();
            let prevAmount = current_player ? (current_player.base_price || 50) : 50;
            let bidSeq = 1;

            const rowsWithDiff = chronological.map(h => {
                let raise = 0;
                let seq = null;
                if (h.bid_type === 'BID') {
                    raise = h.bid_amount - prevAmount;
                    prevAmount = h.bid_amount;
                    seq = bidSeq++;
                }
                return { ...h, raise, seq };
            });

            // Display in reverse chronological order (latest on top)
            const displayRows = rowsWithDiff.reverse();

            ledgerTbody.innerHTML = displayRows.map((h, idx) => {
                const isSold = h.bid_type === 'SOLD';
                const isNom = h.bid_type === 'NOMINATE';
                const isPass = h.bid_type === 'PASS';
                const isTopLeading = (idx === 0 && h.bid_type === 'BID' && state.is_active);

                let statusBadge = '';
                if (isSold) {
                    statusBadge = `<span class="px-2.5 py-1 rounded-xl bg-amber-500 text-slate-950 font-black text-[10px] uppercase shadow-sm">🏆 Sold</span>`;
                } else if (isTopLeading) {
                    statusBadge = `<span class="px-2.5 py-1 rounded-xl bg-emerald-500 text-white font-black text-[10px] uppercase shadow-sm animate-pulse">👑 Leading</span>`;
                } else if (isNom) {
                    statusBadge = `<span class="px-2 py-0.5 rounded-lg bg-blue-100 text-blue-800 font-bold text-[10px]">Nominated</span>`;
                } else if (isPass) {
                    statusBadge = `<span class="px-2 py-0.5 rounded-lg bg-slate-200 text-slate-700 font-bold text-[10px]">Passed</span>`;
                } else {
                    statusBadge = `<span class="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 font-bold text-[10px]">Outbid</span>`;
                }

                let raiseText = '-';
                if (h.bid_type === 'BID') {
                    raiseText = h.raise > 0 ? `<span class="text-emerald-600 font-black font-mono">+₹${h.raise}</span>` : `<span class="text-slate-400 font-mono">Base</span>`;
                }

                const claimBadge = h.claimed_by ? `<span class="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 text-[10px] font-extrabold ml-1.5">${h.claimed_by}</span>` : '';

                const rowBg = isTopLeading ? 'bg-emerald-50/80 font-bold' : isSold ? 'bg-amber-50/80 font-bold' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60';

                return `
                    <tr class="${rowBg} hover:bg-amber-50/40 transition-colors">
                        <td class="py-3 px-3.5 text-center font-['Oswald'] font-black text-slate-500 text-xs">
                            ${h.seq ? `#${h.seq}` : '•'}
                        </td>
                        <td class="py-3 px-3.5">
                            <div class="flex items-center space-x-2">
                                <span class="text-base">${h.manager_avatar || '⚡'}</span>
                                <div class="truncate max-w-[200px]">
                                    <span class="font-extrabold text-slate-900 text-xs">${h.manager_name || (isNom ? 'System Nomination' : 'Auctioneer')}</span>
                                    ${claimBadge}
                                </div>
                            </div>
                        </td>
                        <td class="py-3 px-3.5 text-right font-['Outfit'] font-black text-sm text-slate-900">
                            ${formatMoney(h.bid_amount)}
                        </td>
                        <td class="py-3 px-3.5 text-center text-xs">
                            ${raiseText}
                        </td>
                        <td class="py-3 px-3.5 text-center">
                            ${statusBadge}
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    // 5. Update Manager Squad Purses & Live Connection Overview
    const miniList = document.getElementById('managers-mini-list');
    if (miniList && managers) {
        miniList.className = `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${Math.min(4, Math.max(2, managers.length))} gap-3`;
        miniList.innerHTML = managers.map(m => {
            const pct = Math.max(0, Math.min(100, (m.budget / m.initial_budget) * 100));
            const onlineStatus = m.is_claimed ? 
                `<span class="text-[10px] font-black text-emerald-600 dark:text-emerald-400 flex items-center"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse"></span>${m.claimed_by || 'Online'}</span>` :
                `<span class="text-[10px] font-bold text-slate-400">Unclaimed</span>`;

            const maxBid = m.max_bid !== undefined ? m.max_bid : m.budget;
            const remainingNeeded = m.remaining_slots_needed || 0;
            const quotaBadge = (m.player_count || 0) >= 18 ? 
                `<span class="text-[9px] font-black text-emerald-600 dark:text-emerald-400">✅ 18 Met</span>` :
                `<span class="text-[9px] font-bold text-slate-500 dark:text-slate-400 font-mono">₹50×${remainingNeeded} res.</span>`;

            const crestHtml = typeof generateClubCrestSVG === 'function' ?
                generateClubCrestSVG(m.name, m.crest_color || 'gold', m.emblem || 'crown', 36, 42) :
                `<span class="text-xl">${m.avatar || '👑'}</span>`;

            return `
                <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 space-y-2 shadow-sm flex flex-col justify-between">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-2.5 min-w-0">
                            <div class="w-9 h-11 flex-shrink-0 flex items-center justify-center">${crestHtml}</div>
                            <div class="min-w-0">
                                <span class="text-xs font-black text-slate-900 dark:text-white block truncate">${m.name}</span>
                                ${onlineStatus}
                            </div>
                        </div>
                    </div>
                    <div class="space-y-1 pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
                        <div class="flex justify-between items-baseline">
                            <span class="text-[11px] font-bold text-slate-500 dark:text-slate-400">Purse Left:</span>
                            <span class="text-emerald-700 dark:text-emerald-400 font-black font-['Outfit'] text-sm">${formatMoney(m.budget)}</span>
                        </div>
                        <div class="flex justify-between items-baseline bg-amber-500/10 dark:bg-amber-500/15 px-2 py-1 rounded-lg border border-amber-400/30">
                            <span class="text-[10px] font-black uppercase text-amber-900 dark:text-amber-300">Max Bid:</span>
                            <span class="text-amber-700 dark:text-amber-400 font-black font-['Outfit'] text-xs">${formatMoney(maxBid)}</span>
                        </div>
                        <div class="flex justify-between items-center text-[10px] pt-0.5">
                            <span class="font-bold text-slate-600 dark:text-slate-400">Squad: ${m.player_count || 0}/18</span>
                            ${quotaBadge}
                        </div>
                    </div>
                    <div class="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner">
                        <div class="h-full rounded-full transition-all" style="width: ${pct}%; background-color: ${m.color};"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 6. Update Sold Counts & Refresh Sold Ledger if Active
    const totalSold = managers ? managers.reduce((sum, m) => sum + (m.player_count || 0), 0) : 0;
    const topCount = document.getElementById('top-sold-count');
    const tabCount = document.getElementById('sold-tab-count');
    if (topCount) topCount.textContent = totalSold;
    if (tabCount) tabCount.textContent = totalSold;

    if (currentLedgerView === 'sold') {
        loadSoldTransfersHistory();
    }
}

function createBigStageCard(p) {
    const style = getPositionCardStyles(p.position, p.position_category, p.overall_rating);

    return `
        <div class="big-fut-card ${style.cardClass} relative">
            <!-- Header Strip -->
            <div class="flex justify-between items-center mb-1">
                <div class="flex items-center space-x-2">
                    <span class="font-['Oswald'] text-4xl sm:text-5xl font-black text-slate-950 dark:text-white leading-none drop-shadow-sm">${p.overall_rating}</span>
                    <span class="font-['Oswald'] text-sm sm:text-base font-black px-2.5 py-0.5 rounded-lg ${style.posBadgeClass}">${p.position}</span>
                </div>
                <div class="flex items-center space-x-2">
                    ${p.flag_url ? `<img src="${p.flag_url}" alt="${p.nationality}" class="w-6 h-4 object-cover rounded border border-slate-300 dark:border-slate-600 shadow-sm" onerror="this.style.display='none'">` : ''}
                    <img src="${p.club_logo_url || '/assets/default_club.svg'}" alt="${p.club_name}" class="w-7 h-7 object-contain" onerror="this.onerror=null; this.src='/assets/default_club.svg';">
                </div>
            </div>

            <!-- Big Centered Player Photo Portrait -->
            <div class="flex justify-center my-2">
                <div class="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden relative shadow-xl ${style.haloClass} bg-white/40 dark:bg-slate-800/60 border-2 ${style.borderClass}">
                    <img src="${p.photo_url || '/assets/default_player.svg'}" alt="${p.name}" class="w-full h-full object-cover object-top" onerror="this.onerror=null; this.src='/assets/default_player.svg';">
                </div>
            </div>

            <!-- Player Name & Club Info Centered -->
            <div class="text-center border-y border-slate-300/80 dark:border-slate-700/80 py-1.5 my-1">
                <h3 class="font-['Outfit'] font-black text-xl text-slate-950 dark:text-white uppercase tracking-wider truncate">${p.name}</h3>
                <p class="text-xs font-bold text-slate-600 dark:text-slate-400 truncate">${p.club_name || 'Free Agent'} • ${p.nationality || ''}</p>
            </div>

            <!-- Enlarged 6 Stats Grid (2x3 Bold Breakdown) -->
            <div class="grid grid-cols-6 gap-1 mt-2 text-center bg-white/80 dark:bg-slate-800/90 py-2.5 px-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-inner">
                <div class="flex flex-col items-center">
                    <span class="font-['Oswald'] text-base sm:text-lg font-black leading-tight text-slate-900 dark:text-white">${p.card_pac}</span>
                    <span class="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-black">${p.position === 'GK' ? 'DIV' : 'PAC'}</span>
                </div>
                <div class="flex flex-col items-center">
                    <span class="font-['Oswald'] text-base sm:text-lg font-black leading-tight text-slate-900 dark:text-white">${p.card_sho}</span>
                    <span class="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-black">${p.position === 'GK' ? 'HAN' : 'SHO'}</span>
                </div>
                <div class="flex flex-col items-center">
                    <span class="font-['Oswald'] text-base sm:text-lg font-black leading-tight text-slate-900 dark:text-white">${p.card_pas}</span>
                    <span class="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-black">${p.position === 'GK' ? 'KIC' : 'PAS'}</span>
                </div>
                <div class="flex flex-col items-center">
                    <span class="font-['Oswald'] text-base sm:text-lg font-black leading-tight text-slate-900 dark:text-white">${p.card_dri}</span>
                    <span class="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-black">${p.position === 'GK' ? 'REF' : 'DRI'}</span>
                </div>
                <div class="flex flex-col items-center">
                    <span class="font-['Oswald'] text-base sm:text-lg font-black leading-tight text-slate-900 dark:text-white">${p.card_def}</span>
                    <span class="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-black">${p.position === 'GK' ? 'SPE' : 'DEF'}</span>
                </div>
                <div class="flex flex-col items-center">
                    <span class="font-['Oswald'] text-base sm:text-lg font-black leading-tight text-slate-900 dark:text-white">${p.card_phy}</span>
                    <span class="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-black">${p.position === 'GK' ? 'POS' : 'PHY'}</span>
                </div>
            </div>

            <!-- Extended Traits Strip -->
            <div class="grid grid-cols-3 gap-1.5 pt-2 text-[10px] font-extrabold text-slate-800 dark:text-slate-200 text-center">
                <div class="bg-slate-100/80 dark:bg-slate-800/80 py-1 px-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                    <span class="text-slate-500 dark:text-slate-400 block text-[8px] uppercase">Age</span> ${p.age || 'N/A'} yrs
                </div>
                <div class="bg-slate-100/80 dark:bg-slate-800/80 py-1 px-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                    <span class="text-slate-500 dark:text-slate-400 block text-[8px] uppercase">Skills</span> ★${p.skill_moves || 3}
                </div>
                <div class="bg-slate-100/80 dark:bg-slate-800/80 py-1 px-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                    <span class="text-slate-500 dark:text-slate-400 block text-[8px] uppercase">Weak Foot</span> ★${p.weak_foot || 3}
                </div>
            </div>

            <!-- FIFA 19 Player Specialities Strip -->
            ${(() => {
                const specs = computePlayerSpecialities(p);
                if (!specs || specs.length === 0) return '';
                return `
                    <div class="mt-2 pt-2 border-t border-slate-300/80 dark:border-slate-700/80 flex flex-wrap gap-1 justify-center items-center">
                        ${specs.slice(0, 3).map(s => `
                            <span class="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[9px] font-black shadow-xs ${getSpecialityBadgeStyle(s.color)}" title="${s.desc}">
                                <i class="fa-solid ${s.icon} text-[8px]"></i>
                                <span>${s.name}</span>
                            </span>
                        `).join('')}
                        ${specs.length > 3 ? `<span class="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 self-center">+${specs.length - 3} more</span>` : ''}
                    </div>
                `;
            })()}
        </div>
    `;
}

// ----------------- AUCTION LEDGER & SOLD HISTORY CONTROLS -----------------

function switchLedgerView(mode) {
    currentLedgerView = mode;
    const liveBtn = document.getElementById('ledger-tab-live');
    const soldBtn = document.getElementById('ledger-tab-sold');
    const liveView = document.getElementById('ledger-live-view');
    const soldView = document.getElementById('ledger-sold-view');

    if (mode === 'live') {
        if (liveBtn) liveBtn.className = 'px-3 py-1.5 rounded-xl text-xs font-black transition-all bg-amber-500 text-slate-950 shadow-sm flex items-center space-x-1';
        if (soldBtn) soldBtn.className = 'px-3 py-1.5 rounded-xl text-xs font-black transition-all text-slate-600 hover:text-slate-900 flex items-center space-x-1';
        if (liveView) liveView.classList.remove('hidden');
        if (soldView) soldView.classList.add('hidden');
    } else {
        if (liveBtn) liveBtn.className = 'px-3 py-1.5 rounded-xl text-xs font-black transition-all text-slate-600 hover:text-slate-900 flex items-center space-x-1';
        if (soldBtn) soldBtn.className = 'px-3 py-1.5 rounded-xl text-xs font-black transition-all bg-amber-500 text-slate-950 shadow-sm flex items-center space-x-1';
        if (liveView) liveView.classList.add('hidden');
        if (soldView) soldView.classList.remove('hidden');
        loadSoldTransfersHistory();
    }
}

async function loadSoldTransfersHistory() {
    try {
        const res = await fetch('/api/auction/sold_history');
        const data = await res.json();
        const soldPlayers = data.sold_players || [];

        // Update counts
        const topCount = document.getElementById('top-sold-count');
        const tabCount = document.getElementById('sold-tab-count');
        if (topCount) topCount.textContent = soldPlayers.length;
        if (tabCount) tabCount.textContent = soldPlayers.length;

        const tbody = document.getElementById('sold-transfers-tbody');
        if (!tbody) return;

        if (soldPlayers.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="py-12 text-center text-slate-400 font-bold bg-slate-50/50">
                        <div class="flex flex-col items-center justify-center space-y-1.5">
                            <i class="fa-solid fa-clock-rotate-left text-slate-400 text-2xl"></i>
                            <span class="text-xs text-slate-600 font-extrabold font-['Outfit']">No players sold yet in this auction.</span>
                            <span class="text-[11px] text-slate-400 font-semibold">Nominate and hammer down players to see the transfer ledger here.</span>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = soldPlayers.map(p => {
            const claimBadge = p.claimed_by ? `<span class="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 text-[10px] font-extrabold ml-1">${p.claimed_by}</span>` : '';
            return `
                <tr class="hover:bg-amber-50/50 transition-colors">
                    <td class="py-3 px-3.5">
                        <div class="flex items-center space-x-2.5">
                            <img src="${p.photo_url}" alt="${p.player_name}" class="w-8 h-8 rounded-full object-cover object-top border border-slate-200 bg-white shadow-sm" onerror="this.src='/assets/default_player.svg';">
                            <div>
                                <span class="font-extrabold text-slate-900 text-xs block">${p.player_name}</span>
                                <span class="text-[10px] text-slate-500 font-bold">${p.player_ovr} OVR • ${p.player_pos} • ${p.club_name || ''}</span>
                            </div>
                        </div>
                    </td>
                    <td class="py-3 px-3.5">
                        <div class="flex items-center space-x-1.5">
                            <span>${p.manager_avatar || '👑'}</span>
                            <span class="font-bold text-xs text-slate-900">${p.manager_name}</span>
                            ${claimBadge}
                        </div>
                    </td>
                    <td class="py-3 px-3.5 text-right font-['Outfit'] font-black text-sm text-emerald-600">
                        ${formatMoney(p.bought_price)}
                    </td>
                    <td class="py-3 px-3.5 text-center font-mono font-bold text-xs text-slate-600">
                        ${p.bid_count || 1} bids
                    </td>
                    <td class="py-3 px-3.5 text-center">
                        <button onclick="openPlayerLedgerModal(${p.player_id})" class="px-2.5 py-1 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-extrabold text-[11px] transition-all active:scale-95 shadow-sm">
                            <i class="fa-solid fa-receipt mr-1"></i> View Trail
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Failed to load sold history:', err);
    }
}

async function openPlayerLedgerModal(playerId) {
    try {
        const res = await fetch(`/api/auction/player_ledger/${playerId}`);
        const data = await res.json();
        if (data.error) return;

        const p = data.player;
        const soldInfo = data.sold_info;
        const bids = data.bids || [];

        // Header
        document.getElementById('modal-ledger-photo').src = p.photo_url || '/assets/default_player.svg';
        document.getElementById('modal-ledger-ovr').textContent = p.overall_rating;
        document.getElementById('modal-ledger-pos').textContent = p.position;
        document.getElementById('modal-ledger-name').textContent = p.name;
        document.getElementById('modal-ledger-sub').textContent = `${p.club_name || 'Free Agent'} • ${p.nationality || ''}`;

        if (soldInfo) {
            document.getElementById('modal-ledger-price').textContent = formatMoney(soldInfo.bought_price);
            const claim = soldInfo.claimed_by ? ` (${soldInfo.claimed_by})` : '';
            document.getElementById('modal-ledger-winner').textContent = `${soldInfo.manager_avatar || '👑'} ${soldInfo.manager_name}${claim}`;
        } else {
            document.getElementById('modal-ledger-price').textContent = 'Unsold / Active';
            document.getElementById('modal-ledger-winner').textContent = 'None';
        }

        document.getElementById('modal-ledger-bidcount').textContent = `${data.bid_count || bids.length} Total Log Entries`;

        const tbody = document.getElementById('modal-ledger-tbody');
        if (bids.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-400 font-bold">No bid entries recorded for this player.</td></tr>`;
        } else {
            let prevAmount = p.base_price || 50;
            let seq = 1;
            tbody.innerHTML = bids.map(h => {
                const isSold = h.bid_type === 'SOLD';
                const isNom = h.bid_type === 'NOMINATE';
                const isPass = h.bid_type === 'PASS';
                
                let raise = 0;
                let seqNum = '-';
                if (h.bid_type === 'BID') {
                    raise = h.bid_amount - prevAmount;
                    prevAmount = h.bid_amount;
                    seqNum = `#${seq++}`;
                } else if (isSold) {
                    seqNum = '🏆';
                }

                let outcomeBadge = '';
                if (isSold) {
                    outcomeBadge = `<span class="px-2.5 py-1 rounded-xl bg-amber-500 text-slate-950 font-black text-[10px] uppercase shadow-sm">🏆 Sold!</span>`;
                } else if (isNom) {
                    outcomeBadge = `<span class="px-2 py-0.5 rounded-lg bg-blue-100 text-blue-800 font-bold text-[10px]">Nominated</span>`;
                } else if (isPass) {
                    outcomeBadge = `<span class="px-2 py-0.5 rounded-lg bg-slate-200 text-slate-700 font-bold text-[10px]">Passed</span>`;
                } else {
                    outcomeBadge = `<span class="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 font-bold text-[10px]">Active Bid</span>`;
                }

                const claimBadge = h.claimed_by ? `<span class="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 text-[10px] font-extrabold ml-1.5">${h.claimed_by}</span>` : '';
                const raiseText = h.bid_type === 'BID' ? (raise > 0 ? `<span class="text-emerald-600 font-black font-mono">+₹${raise}</span>` : `<span class="text-slate-400 font-mono">Base</span>`) : '-';

                return `
                    <tr class="${isSold ? 'bg-amber-50/80 font-bold' : 'hover:bg-slate-50'} transition-colors">
                        <td class="py-2.5 px-3 text-center font-['Oswald'] font-black text-slate-500 text-xs">${seqNum}</td>
                        <td class="py-2.5 px-3">
                            <div class="flex items-center space-x-2">
                                <span>${h.manager_avatar || '⚡'}</span>
                                <span class="font-bold text-xs text-slate-900">${h.manager_name || (isNom ? 'Auctioneer' : 'Pass')}</span>
                                ${claimBadge}
                            </div>
                        </td>
                        <td class="py-2.5 px-3 text-right font-['Outfit'] font-black text-sm text-slate-900">${formatMoney(h.bid_amount)}</td>
                        <td class="py-2.5 px-3 text-center text-xs">${raiseText}</td>
                        <td class="py-2.5 px-3 text-center">${outcomeBadge}</td>
                    </tr>
                `;
            }).join('');
        }

        const modal = document.getElementById('player-ledger-modal');
        const box = document.getElementById('player-ledger-box');
        if (modal) modal.classList.remove('hidden');
        if (box) setTimeout(() => box.classList.remove('scale-95'), 20);
    } catch (err) {
        console.error('Failed to open player ledger modal:', err);
    }
}

function closePlayerLedgerModal() {
    const modal = document.getElementById('player-ledger-modal');
    const box = document.getElementById('player-ledger-box');
    if (box) box.classList.add('scale-95');
    setTimeout(() => {
        if (modal) modal.classList.add('hidden');
    }, 150);
}

async function openSoldHistoryModal() {
    try {
        const res = await fetch('/api/auction/sold_history');
        const data = await res.json();
        const soldPlayers = data.sold_players || [];

        const summary = document.getElementById('modal-sold-summary');
        if (summary) summary.textContent = `Total Transfers Finalized: ${soldPlayers.length}`;

        const tbody = document.getElementById('modal-sold-list-tbody');
        if (tbody) {
            if (soldPlayers.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="py-12 text-center text-slate-400 font-bold bg-slate-50/50">
                            <div class="flex flex-col items-center justify-center space-y-1">
                                <i class="fa-solid fa-clock-rotate-left text-slate-400 text-2xl"></i>
                                <span class="text-xs text-slate-600 font-extrabold font-['Outfit']">No players sold yet in this auction.</span>
                            </div>
                        </td>
                    </tr>
                `;
            } else {
                tbody.innerHTML = soldPlayers.map(p => {
                    const claimBadge = p.claimed_by ? `<span class="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 text-[10px] font-extrabold ml-1">${p.claimed_by}</span>` : '';
                    return `
                        <tr class="hover:bg-amber-50/50 transition-colors">
                            <td class="py-3 px-3.5">
                                <div class="flex items-center space-x-2.5">
                                    <img src="${p.photo_url}" alt="${p.player_name}" class="w-9 h-9 rounded-full object-cover object-top border border-slate-200 bg-white shadow-sm" onerror="this.src='/assets/default_player.svg';">
                                    <div>
                                        <span class="font-extrabold text-slate-900 text-xs block">${p.player_name}</span>
                                        <span class="text-[10px] text-slate-500 font-bold">${p.player_ovr} OVR • ${p.player_pos} • ${p.club_name || ''}</span>
                                    </div>
                                </div>
                            </td>
                            <td class="py-3 px-3.5">
                                <div class="flex items-center space-x-1.5">
                                    <span>${p.manager_avatar || '👑'}</span>
                                    <span class="font-bold text-xs text-slate-900">${p.manager_name}</span>
                                    ${claimBadge}
                                </div>
                            </td>
                            <td class="py-3 px-3.5 text-right font-['Outfit'] font-black text-sm text-emerald-600">
                                ${formatMoney(p.bought_price)}
                            </td>
                            <td class="py-3 px-3.5 text-center font-mono font-bold text-xs text-slate-600">
                                ${p.bid_count || 1} bids
                            </td>
                            <td class="py-3 px-3.5 text-center">
                                <button onclick="openPlayerLedgerModal(${p.player_id})" class="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all active:scale-95 shadow-sm">
                                    <i class="fa-solid fa-list-ol mr-1"></i> View Full Ledger
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }

        const modal = document.getElementById('sold-history-modal');
        const box = document.getElementById('sold-history-box');
        if (modal) modal.classList.remove('hidden');
        if (box) setTimeout(() => box.classList.remove('scale-95'), 20);
    } catch (err) {
        console.error('Failed to open sold history modal:', err);
    }
}

function closeSoldHistoryModal() {
    const modal = document.getElementById('sold-history-modal');
    const box = document.getElementById('sold-history-box');
    if (box) box.classList.add('scale-95');
    setTimeout(() => {
        if (modal) modal.classList.add('hidden');
    }, 150);
}

// Nominate player directly from card
async function nominatePlayerFromCard(playerId, basePrice) {
    try {
        const res = await fetch('/api/auction/nominate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player_id: playerId, starting_bid: basePrice })
        });
        const data = await res.json();
        
        if (data.error) {
            showCustomToast('Nomination Failed', data.error, 'error');
            return;
        }

        switchTab('auction');
        loadAuctionState(true);
    } catch (err) {
        console.error('Failed to nominate player:', err);
    }
}

// Bidding Actions
async function placeOpeningBid() {
    if (!currentAuctionState || !currentAuctionState.state) return;
    const curBid = currentAuctionState.state.current_bid || 50;
    const mgrId = document.getElementById('active-bidder-select')?.value || 'mgr_1';
    await sendBid(mgrId, curBid);
}

async function placeBidIncrement(inc) {
    if (!currentAuctionState || !currentAuctionState.state) return;
    
    const curBid = currentAuctionState.state.current_bid || 0;
    const newBid = curBid + inc;
    
    const mgrId = document.getElementById('active-bidder-select')?.value || 'mgr_1';
    await sendBid(mgrId, newBid);
}

async function placeCustomBid() {
    const input = document.getElementById('custom-bid-amount');
    const val = parseInt(input?.value);
    
    if (!val || isNaN(val) || val <= 0) {
        showCustomToast('Invalid Bid', 'Please enter a valid bid amount.', 'error');
        return;
    }
    
    const mgrId = document.getElementById('active-bidder-select')?.value || 'mgr_1';
    await sendBid(mgrId, val);
    if (input) input.value = '';
}

async function sendBid(managerId, bidAmount) {
    try {
        if (currentAuctionState && currentAuctionState.managers) {
            const mgr = currentAuctionState.managers.find(m => m.id === managerId);
            if (mgr && mgr.max_bid !== undefined && bidAmount > mgr.max_bid) {
                showCustomToast(
                    'Bid Exceeds Max Limit', 
                    `Bid of ₹${bidAmount} exceeds maximum allowable limit of ₹${mgr.max_bid}! (${mgr.name} currently has ${mgr.player_count || 0} players and must reserve ₹${mgr.reserved_budget || 0} for ${mgr.remaining_slots_needed || 0} remaining players to reach 18 squad).`,
                    'error'
                );
                return;
            }
        }

        const res = await fetch('/api/auction/bid', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ manager_id: managerId, bid_amount: bidAmount })
        });
        const data = await res.json();
        
        if (data.error) {
            showCustomToast('Bid Rejected', data.error, 'error');
            return;
        }

        loadAuctionState(true);
    } catch (err) {
        console.error('Failed to place bid:', err);
    }
}

async function finalizeSale() {
    try {
        const res = await fetch('/api/auction/sell', { method: 'POST' });
        const data = await res.json();
        
        if (data.error) {
            showCustomToast('Auction Error', data.error, 'error');
            return;
        }

        // Sale completed: celebration modal, confetti & fanfare will trigger smoothly with no alert popup!
        loadAuctionState(true);
    } catch (err) {
        console.error('Failed to finalize sale:', err);
    }
}

async function passPlayer() {
    try {
        const res = await fetch('/api/auction/pass', { method: 'POST' });
        await res.json();
        loadAuctionState(true);
    } catch (err) {
        console.error('Failed to pass player:', err);
    }
}

async function quickNominateRandom(mode = 'random') {
    let url = '/api/players?limit=40&sort_by=overall_rating';
    if (mode === 'top') {
        url += '&min_ovr=88';
    } else if (mode === 'wonderkid') {
        url += '&min_pot=85';
    }
    
    try {
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.players && data.players.length > 0) {
            const randomP = data.players[Math.floor(Math.random() * data.players.length)];
            await nominatePlayerFromCard(randomP.id, randomP.base_price);
        }
    } catch (err) {
        console.error('Quick nominate error:', err);
    }
}

async function searchAndNominate() {
    const input = document.getElementById('nominate-search');
    const term = input?.value?.trim();
    if (!term) return;
    
    try {
        const res = await fetch(`/api/players?search=${encodeURIComponent(term)}&limit=1`);
        const data = await res.json();
        
        if (data.players && data.players.length > 0) {
            await nominatePlayerFromCard(data.players[0].id, data.players[0].base_price);
            if (input) input.value = '';
        } else {
            showCustomToast('Player Not Found', `No player found matching "${term}"`, 'info');
        }
    } catch (err) {
        console.error('Search and nominate error:', err);
    }
}

// ----------------- MANAGER HUB, FORMATIONS & PITCH LINEUPS -----------------

const FORMATIONS = {
    '4-3-3': {
        name: '4-3-3 (Attack)',
        rows: [
            [{ idx: 0, pos: 'LW' }, { idx: 1, pos: 'ST' }, { idx: 2, pos: 'RW' }],
            [{ idx: 3, pos: 'LCM' }, { idx: 4, pos: 'CAM' }, { idx: 5, pos: 'RCM' }],
            [{ idx: 6, pos: 'LB' }, { idx: 7, pos: 'LCB' }, { idx: 8, pos: 'RCB' }, { idx: 9, pos: 'RB' }],
            [{ idx: 10, pos: 'GK' }]
        ]
    },
    '4-2-3-1': {
        name: '4-2-3-1 (3 CAMs / 2 CDMs)',
        rows: [
            [{ idx: 0, pos: 'ST' }],
            [{ idx: 1, pos: 'LAM' }, { idx: 2, pos: 'CAM' }, { idx: 3, pos: 'RAM' }],
            [{ idx: 4, pos: 'LDM' }, { idx: 5, pos: 'RDM' }],
            [{ idx: 6, pos: 'LB' }, { idx: 7, pos: 'LCB' }, { idx: 8, pos: 'RCB' }, { idx: 9, pos: 'RB' }],
            [{ idx: 10, pos: 'GK' }]
        ]
    },
    '4-4-2': {
        name: '4-4-2 (Classic Flat)',
        rows: [
            [{ idx: 0, pos: 'LS' }, { idx: 1, pos: 'RS' }],
            [{ idx: 2, pos: 'LM' }, { idx: 3, pos: 'LCM' }, { idx: 4, pos: 'RCM' }, { idx: 5, pos: 'RM' }],
            [{ idx: 6, pos: 'LB' }, { idx: 7, pos: 'LCB' }, { idx: 8, pos: 'RCB' }, { idx: 9, pos: 'RB' }],
            [{ idx: 10, pos: 'GK' }]
        ]
    },
    '4-1-2-1-2': {
        name: '4-1-2-1-2 (Diamond Midfield)',
        rows: [
            [{ idx: 0, pos: 'LS' }, { idx: 1, pos: 'RS' }],
            [{ idx: 2, pos: 'CAM' }],
            [{ idx: 3, pos: 'LM' }, { idx: 4, pos: 'RM' }],
            [{ idx: 5, pos: 'CDM' }],
            [{ idx: 6, pos: 'LB' }, { idx: 7, pos: 'LCB' }, { idx: 8, pos: 'RCB' }, { idx: 9, pos: 'RB' }],
            [{ idx: 10, pos: 'GK' }]
        ]
    },
    '3-5-2': {
        name: '3-5-2 (Wingback Attack)',
        rows: [
            [{ idx: 0, pos: 'LS' }, { idx: 1, pos: 'RS' }],
            [{ idx: 2, pos: 'CAM' }],
            [{ idx: 3, pos: 'LM' }, { idx: 4, pos: 'LCM' }, { idx: 5, pos: 'RCM' }, { idx: 6, pos: 'RM' }],
            [{ idx: 7, pos: 'LCB' }, { idx: 8, pos: 'CB' }, { idx: 9, pos: 'RCB' }],
            [{ idx: 10, pos: 'GK' }]
        ]
    },
    '4-3-2-1': {
        name: '4-3-2-1 (Christmas Tree)',
        rows: [
            [{ idx: 0, pos: 'ST' }],
            [{ idx: 1, pos: 'LF' }, { idx: 2, pos: 'RF' }],
            [{ idx: 3, pos: 'LCM' }, { idx: 4, pos: 'CM' }, { idx: 5, pos: 'RCM' }],
            [{ idx: 6, pos: 'LB' }, { idx: 7, pos: 'LCB' }, { idx: 8, pos: 'RCB' }, { idx: 9, pos: 'RB' }],
            [{ idx: 10, pos: 'GK' }]
        ]
    },
    '5-3-2': {
        name: '5-3-2 (Solid 5 Back)',
        rows: [
            [{ idx: 0, pos: 'LS' }, { idx: 1, pos: 'RS' }],
            [{ idx: 2, pos: 'LCM' }, { idx: 3, pos: 'CAM' }, { idx: 4, pos: 'RCM' }],
            [{ idx: 5, pos: 'LWB' }, { idx: 6, pos: 'LCB' }, { idx: 7, pos: 'CB' }, { idx: 8, pos: 'RCB' }, { idx: 9, pos: 'RWB' }],
            [{ idx: 10, pos: 'GK' }]
        ]
    }
};

let managerCustomLineups = JSON.parse(localStorage.getItem('fifa_manager_lineups') || '{}');
let activeAssignSlotIdx = null;
let activeAssignSlotPos = '';

function saveManagerLineups() {
    try {
        localStorage.setItem('fifa_manager_lineups', JSON.stringify(managerCustomLineups));
    } catch (e) {}
}

async function loadManagersHub() {
    try {
        const res = await fetch('/api/auction/state');
        const data = await res.json();
        
        const managers = data.managers || [];
        if (!managers.some(m => m.id === selectedSquadManagerId)) {
            selectedSquadManagerId = managers.length > 0 ? managers[0].id : null;
        }

        const cardsGrid = document.getElementById('managers-cards-grid');
        
        if (cardsGrid) {
            cardsGrid.className = `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${Math.min(4, Math.max(2, managers.length))} gap-4 sm:gap-5`;
            cardsGrid.innerHTML = managers.map(m => {
                const isSelected = m.id === selectedSquadManagerId;
                const statusBadge = m.is_claimed ?
                    `<span class="text-[10px] font-black text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse"></span>${m.claimed_by}</span>` :
                    `<span class="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Open</span>`;

                const maxBid = m.max_bid !== undefined ? m.max_bid : m.budget;
                const reserved = m.reserved_budget || 0;
                const remainingNeeded = m.remaining_slots_needed || 0;
                const quotaBadge = (m.player_count || 0) >= 18 ? 
                    `<span class="text-[10px] font-black text-emerald-700 dark:text-emerald-300">✅ 18 Squad Met</span>` :
                    `<span class="text-[10px] font-bold text-slate-500 dark:text-slate-400">Need ${remainingNeeded} more (₹${reserved} res.)</span>`;

                const crestHtml = typeof generateClubCrestSVG === 'function' ?
                    generateClubCrestSVG(m.name, m.crest_color || 'gold', m.emblem || 'crown', 46, 54) :
                    `<span class="text-3xl">${m.avatar || '👑'}</span>`;

                const canDelete = (m.player_count || 0) === 0 && managers.length > 2;

                return `
                    <div onclick="selectSquadManager('${m.id}')" class="p-5 rounded-3xl bg-white dark:bg-slate-900 border-2 ${isSelected ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-950/30 shadow-lg shadow-amber-500/15' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'} cursor-pointer transition-all flex flex-col justify-between">
                        <div>
                            <div class="flex items-center justify-between mb-3">
                                <div class="flex items-center space-x-3 min-w-0">
                                    <div class="w-11 h-13 flex-shrink-0 flex items-center justify-center">${crestHtml}</div>
                                    <div class="min-w-0">
                                        <h3 class="font-['Outfit'] font-black text-base text-slate-900 dark:text-white truncate">${m.name}</h3>
                                        <span class="text-xs font-bold text-slate-500 dark:text-slate-400">${m.player_count}/18 Players</span>
                                    </div>
                                </div>
                                <div class="flex items-center space-x-1.5 flex-shrink-0">
                                    ${statusBadge}
                                    ${canDelete ? `
                                        <button onclick="event.stopPropagation(); deleteManagerClub('${m.id}')" title="Delete Manager Club" class="w-6 h-6 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center text-[10px] transition-all">
                                            <i class="fa-solid fa-trash-can"></i>
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                            <div class="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-bold">
                                <div class="flex justify-between items-baseline">
                                    <span class="text-slate-500 dark:text-slate-400">Purse Left:</span>
                                    <span class="font-black text-emerald-600 dark:text-emerald-400 font-['Outfit'] text-sm">${formatMoney(m.budget)}</span>
                                </div>
                                <div class="flex justify-between items-baseline bg-amber-500/10 dark:bg-amber-500/15 px-2 py-1 rounded-xl border border-amber-400/30">
                                    <span class="text-amber-900 dark:text-amber-300 font-black uppercase text-[10px]">Max Allowable Bid:</span>
                                    <span class="font-black text-amber-700 dark:text-amber-400 font-['Outfit'] text-sm">${formatMoney(maxBid)}</span>
                                </div>
                                <div class="flex justify-between items-center text-[10px] pt-0.5">
                                    ${quotaBadge}
                                    <span class="font-bold text-slate-400">Spent: ${formatMoney(m.spent)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        renderSelectedManagerSquad(managers);
    } catch (err) {
        console.error('Error loading manager hub:', err);
    }
}

function openCreateManagerModal() {
    const modal = document.getElementById('create-manager-modal');
    const box = document.getElementById('create-manager-box');
    const nameInput = document.getElementById('desktop-new-club-name');
    const mgrInput = document.getElementById('desktop-new-mgr-name');
    if (nameInput) nameInput.value = '';
    if (mgrInput) mgrInput.value = '';
    updateDesktopCreateCrestPreview();
    if (modal) {
        modal.classList.remove('hidden');
        if (box) setTimeout(() => box.classList.remove('scale-95'), 20);
    }
}

function closeCreateManagerModal() {
    const modal = document.getElementById('create-manager-modal');
    const box = document.getElementById('create-manager-box');
    if (box) box.classList.add('scale-95');
    setTimeout(() => {
        if (modal) modal.classList.add('hidden');
    }, 150);
}

function updateDesktopCreateCrestPreview() {
    const clubName = document.getElementById('desktop-new-club-name')?.value || 'Royal Strikers FC';
    const emblem = document.getElementById('desktop-new-club-emblem')?.value || 'crown';
    const color = document.getElementById('desktop-new-club-color')?.value || 'gold';
    const preview = document.getElementById('desktop-create-crest-preview');
    if (preview && typeof generateClubCrestSVG === 'function') {
        preview.innerHTML = generateClubCrestSVG(clubName, color, emblem, 84, 98);
    }
}

async function submitCreateManager() {
    const clubName = document.getElementById('desktop-new-club-name')?.value?.trim();
    const mgrName = document.getElementById('desktop-new-mgr-name')?.value?.trim();
    const emblem = document.getElementById('desktop-new-club-emblem')?.value || 'crown';
    const color = document.getElementById('desktop-new-club-color')?.value || 'gold';

    if (!clubName) {
        showAppToast('Missing Club Name', 'Please enter a club name!', 'warn');
        return;
    }

    try {
        const res = await fetch('/api/managers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: clubName,
                manager_name: mgrName || 'Manager',
                emblem: emblem,
                crest_color: color
            })
        });
        const data = await res.json();
        if (data.error) {
            showAppToast('Error', data.error, 'error');
            return;
        }

        showAppToast('Club Created!', `Created ${clubName} with custom logo`, 'success');
        closeCreateManagerModal();
        selectedSquadManagerId = data.manager_id;
        loadManagersHub();
        loadAuctionState();
    } catch (e) {
        console.error('Failed to create manager:', e);
        showAppToast('Error', 'Failed to create manager club', 'error');
    }
}

async function deleteManagerClub(managerId) {
    if (!confirm('Are you sure you want to delete this manager club?')) return;
    try {
        const res = await fetch(`/api/managers/${managerId}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (data.error) {
            showAppToast('Cannot Delete', data.error, 'error');
            return;
        }

        showAppToast('Club Removed', 'Manager club deleted successfully', 'info');
        selectedSquadManagerId = null;
        loadManagersHub();
        loadAuctionState();
    } catch (e) {
        console.error('Failed to delete manager:', e);
    }
}

function selectSquadManager(mgrId) {
    selectedSquadManagerId = mgrId;
    loadManagersHub();
}

function setSquadViewMode(mode) {
    squadViewMode = mode;
    const pitchBtn = document.getElementById('squad-btn-pitch');
    const listBtn = document.getElementById('squad-btn-list');
    const pitchContainer = document.getElementById('pitch-container');
    const tableContainer = document.getElementById('roster-table-container');

    if (mode === 'pitch') {
        pitchBtn.className = 'px-3 py-1.5 rounded-xl font-extrabold bg-white text-slate-900 shadow-sm transition-all';
        listBtn.className = 'px-3 py-1.5 rounded-xl font-extrabold text-slate-500 hover:text-slate-800 transition-all';
        pitchContainer.classList.remove('hidden');
        tableContainer.classList.add('hidden');
    } else {
        listBtn.className = 'px-3 py-1.5 rounded-xl font-extrabold bg-white text-slate-900 shadow-sm transition-all';
        pitchBtn.className = 'px-3 py-1.5 rounded-xl font-extrabold text-slate-500 hover:text-slate-800 transition-all';
        pitchContainer.classList.add('hidden');
        tableContainer.classList.remove('hidden');
    }
}

function changePitchFormation() {
    const select = document.getElementById('pitch-formation-select');
    if (!select) return;
    const newForm = select.value;
    
    if (!managerCustomLineups[selectedSquadManagerId]) {
        managerCustomLineups[selectedSquadManagerId] = { formation: newForm, slots: {} };
    } else {
        managerCustomLineups[selectedSquadManagerId].formation = newForm;
    }
    saveManagerLineups();
    loadManagersHub();
}

function autoFillSquadXI() {
    if (!currentAuctionState || !currentAuctionState.managers) return;
    const mgr = currentAuctionState.managers.find(m => m.id === selectedSquadManagerId);
    if (!mgr || !mgr.roster) return;

    const formKey = managerCustomLineups[selectedSquadManagerId]?.formation || '4-3-3';
    const formDef = FORMATIONS[formKey] || FORMATIONS['4-3-3'];
    
    // Sort players by rating descending
    const sortedPlayers = [...mgr.roster].sort((a, b) => b.overall_rating - a.overall_rating);
    const assignedSlots = {};
    const usedPlayerIds = new Set();

    // Flatten all slots in formation
    const allSlots = [];
    formDef.rows.forEach(r => r.forEach(s => allSlots.push(s)));

    // Smart Match 1: Find best matching players for exact position
    allSlots.forEach(s => {
        const match = sortedPlayers.find(p => !usedPlayerIds.has(p.id) && p.position === s.pos);
        if (match) {
            assignedSlots[s.idx] = match.id;
            usedPlayerIds.add(match.id);
        }
    });

    // Smart Match 2: Find best matching players by category (FWD, MID, DEF, GK)
    allSlots.forEach(s => {
        if (!assignedSlots[s.idx]) {
            const cat = position_to_category(s.pos);
            const match = sortedPlayers.find(p => !usedPlayerIds.has(p.id) && p.position_category === cat);
            if (match) {
                assignedSlots[s.idx] = match.id;
                usedPlayerIds.add(match.id);
            }
        }
    });

    // Fill remaining slots with ANY available player (regardless of position!)
    allSlots.forEach(s => {
        if (!assignedSlots[s.idx]) {
            const match = sortedPlayers.find(p => !usedPlayerIds.has(p.id));
            if (match) {
                assignedSlots[s.idx] = match.id;
                usedPlayerIds.add(match.id);
            }
        }
    });

    managerCustomLineups[selectedSquadManagerId] = {
        formation: formKey,
        slots: assignedSlots
    };
    saveManagerLineups();
    loadManagersHub();
}

function position_to_category(pos) {
    pos = String(pos || '').toUpperCase().trim();
    if (pos === 'GK') return 'GK';
    if (['CB', 'LB', 'RB', 'LWB', 'RWB', 'LCB', 'RCB', 'SW'].includes(pos)) return 'DEF';
    if (['CM', 'CDM', 'CAM', 'LM', 'RM', 'LDM', 'RDM', 'LCM', 'RCM', 'LAM', 'RAM'].includes(pos)) return 'MID';
    return 'FWD';
}

function renderSelectedManagerSquad(managers) {
    const mgr = managers.find(m => m.id === selectedSquadManagerId) || managers[0];
    if (!mgr) return;

    const squadAvatarEl = document.getElementById('squad-mgr-avatar');
    if (squadAvatarEl) {
        squadAvatarEl.innerHTML = typeof generateClubCrestSVG === 'function' ?
            generateClubCrestSVG(mgr.name, mgr.crest_color || 'gold', mgr.emblem || 'crown', 56, 66) :
            `<span class="text-3xl">${mgr.avatar || '👑'}</span>`;
    }

    document.getElementById('squad-mgr-name').innerHTML = `
        <span>${mgr.name}</span>
        ${mgr.is_claimed ? `<span class="ml-2 text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-extrabold align-middle inline-flex items-center"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse"></span>Managed by ${mgr.claimed_by}</span>` : ''}
    `;
    document.getElementById('squad-count').textContent = mgr.player_count;
    document.getElementById('squad-spent').textContent = formatFullMoney(mgr.spent);
    document.getElementById('squad-avg-ovr').textContent = mgr.avg_rating || '0.0';

    const roster = mgr.roster || [];
    const mgrData = managerCustomLineups[mgr.id] || { formation: '4-3-3', slots: {} };
    const formKey = mgrData.formation || '4-3-3';
    const formDef = FORMATIONS[formKey] || FORMATIONS['4-3-3'];

    // Update Formation Dropdown
    const formSelect = document.getElementById('pitch-formation-select');
    if (formSelect) formSelect.value = formKey;

    // 1. Populate Roster Table View
    const tableBody = document.getElementById('roster-table-body');
    if (tableBody) {
        if (roster.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400 font-bold">No players acquired yet. Win auctions to build this squad!</td></tr>`;
        } else {
            tableBody.innerHTML = roster.map(p => `
                <tr class="hover:bg-slate-50 transition-colors">
                    <td class="p-3.5 flex items-center space-x-3">
                        <img src="${p.photo_url || '/assets/default_player.svg'}" alt="${p.name}" class="w-9 h-9 rounded-full object-cover bg-slate-100 border border-slate-300" onerror="this.onerror=null; this.src='/assets/default_player.svg';">
                        <div>
                            <span class="font-black text-slate-900 block font-['Outfit']">${p.name}</span>
                            <span class="text-xs font-semibold text-slate-500">${p.club_name}</span>
                        </div>
                    </td>
                    <td class="p-3.5 font-black text-xs text-blue-600">${p.position}</td>
                    <td class="p-3.5 font-black text-amber-600 text-base font-['Outfit']">${p.overall_rating}</td>
                    <td class="p-3.5 font-mono font-bold text-emerald-600">${formatFullMoney(p.bought_price)}</td>
                    <td class="p-3.5 flex items-center space-x-2">
                        <button onclick="openPlayerLedgerModal(${p.id})" class="text-xs px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold border border-amber-200 transition-all shadow-sm">
                            <i class="fa-solid fa-receipt mr-1"></i> Ledger
                        </button>
                        <button onclick="releasePlayer(${p.roster_id})" class="text-xs px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold border border-rose-200 transition-all">
                            Release
                        </button>
                    </td>
                </tr>
            `).join('');
        }
    }

    // 2. Map Starting XI & Bench Players
    const assignedSlots = mgrData.slots || {};
    const startingPlayerIds = new Set();
    const playerMap = {};
    roster.forEach(p => { playerMap[p.id] = p; });

    // Validate assigned slots
    Object.keys(assignedSlots).forEach(sIdx => {
        const pId = assignedSlots[sIdx];
        if (playerMap[pId]) {
            startingPlayerIds.add(pId);
        } else {
            delete assignedSlots[sIdx];
        }
    });

    // If slots are unassigned but players exist, perform default fill
    if (Object.keys(assignedSlots).length === 0 && roster.length > 0) {
        autoFillSquadXI();
        return;
    }

    // 3. Render Tactical Soccer Pitch with Formation Rows & Drag and Drop
    const pitchPlayers = document.getElementById('pitch-players');
    if (pitchPlayers) {
        pitchPlayers.innerHTML = '';
        
        formDef.rows.forEach(rowSlots => {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'flex justify-around items-center w-full my-0.5';

            rowSlots.forEach(s => {
                const pId = assignedSlots[s.idx];
                const p = playerMap[pId];
                const slotDiv = document.createElement('div');
                slotDiv.className = `pitch-slot ${p ? 'filled' : ''} cursor-pointer group`;
                slotDiv.setAttribute('data-slot-idx', s.idx);
                slotDiv.onclick = () => openSlotAssignModal(s.idx, s.pos);

                // Enable Dropping on all slots
                slotDiv.ondragover = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
                slotDiv.ondragenter = (e) => { e.preventDefault(); slotDiv.classList.add('slot-highlight'); };
                slotDiv.ondragleave = (e) => { slotDiv.classList.remove('slot-highlight'); };
                slotDiv.ondrop = (e) => handleSlotDrop(e, s.idx);

                if (p) {
                    // Enable Dragging from this slot
                    slotDiv.setAttribute('draggable', 'true');
                    slotDiv.ondragstart = (e) => handlePitchDragStart(e, p.id, s.idx);
                    slotDiv.ondragend = handleDragEnd;

                    slotDiv.innerHTML = `
                        <div class="absolute -top-2 -right-1 z-10 px-1.5 py-0.5 rounded-full bg-slate-900 text-amber-400 font-['Oswald'] font-black text-[10px] border border-amber-300 shadow pointer-events-none">
                            ${p.overall_rating}
                        </div>
                        <img src="${p.photo_url || '/assets/default_player.svg'}" alt="${p.name}" class="w-10 h-10 rounded-full object-cover -mt-1 border-2 border-amber-400 shadow-md bg-white/40 pointer-events-none" onerror="this.onerror=null; this.src='/assets/default_player.svg';">
                        <div class="text-[9px] font-black text-slate-950 px-1.5 py-0.2 bg-white/95 rounded mt-0.5 truncate max-w-[64px] shadow-sm text-center pointer-events-none">
                            ${p.name.split(' ').pop()}
                        </div>
                    `;
                } else {
                    slotDiv.innerHTML = `
                        <span class="text-xs font-black text-white/90 drop-shadow pointer-events-none">${s.pos}</span>
                        <span class="text-[9px] text-amber-300 font-bold opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 pointer-events-none">+ Assign</span>
                    `;
                }
                rowDiv.appendChild(slotDiv);
            });

            pitchPlayers.appendChild(rowDiv);
        });
    }

    // 4. Render Substitutes & Reserves Bench Cards (Below Pitch)
    const subsSection = document.getElementById('substitutes-section');
    if (subsSection) {
        subsSection.ondragover = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
        subsSection.ondrop = handleDropToBench;
    }

    const subsGrid = document.getElementById('substitutes-grid');
    const subsCountEl = document.getElementById('subs-count');
    const benchPlayers = roster.filter(p => !startingPlayerIds.has(p.id));

    if (subsCountEl) subsCountEl.textContent = benchPlayers.length;

    if (subsGrid) {
        if (benchPlayers.length === 0) {
            subsGrid.innerHTML = `
                <div class="py-6 px-4 text-center text-slate-400 font-bold text-xs w-full bg-white rounded-2xl border border-slate-200 shadow-inner">
                    ${roster.length === 0 ? 'No players in squad. Win auctions to add players!' : 'All squad players are currently in the starting XI. Drag a pitch player here to sub off.'}
                </div>
            `;
        } else {
            subsGrid.innerHTML = benchPlayers.map(p => {
                const posColor = p.position_category === 'FWD' ? 'text-rose-600' :
                                 p.position_category === 'MID' ? 'text-blue-600' :
                                 p.position_category === 'DEF' ? 'text-emerald-600' : 'text-amber-600';
                return `
                    <div class="bench-card group" draggable="true" ondragstart="handleBenchDragStart(event, ${p.id})" ondragend="handleDragEnd(event)" onclick="openSlotAssignForBench(${p.id})">
                        <div class="flex items-start justify-between pointer-events-none">
                            <span class="font-['Oswald'] text-2xl font-black text-slate-900 leading-none">${p.overall_rating}</span>
                            <span class="font-['Oswald'] text-xs font-black ${posColor}">${p.position}</span>
                        </div>
                        <div class="w-14 h-14 mx-auto my-1 relative pointer-events-none">
                            <img src="${p.photo_url || '/assets/default_player.svg'}" alt="${p.name}" class="w-full h-full object-cover rounded-full bg-slate-100 border border-slate-200" onerror="this.onerror=null; this.src='/assets/default_player.svg';">
                        </div>
                        <div class="text-center pointer-events-none">
                            <h4 class="font-['Outfit'] font-black text-xs text-slate-900 truncate">${p.name}</h4>
                            <span class="text-[10px] font-bold text-emerald-600 block">${formatMoney(p.bought_price)}</span>
                        </div>
                        <button class="mt-2 w-full py-1 rounded-xl bg-amber-50 group-hover:bg-amber-500 group-hover:text-slate-950 text-amber-800 text-[10px] font-black uppercase transition-all border border-amber-300">
                            ⇄ Drag / Swap
                        </button>
                    </div>
                `;
            }).join('');
        }
    }
}

// ----------------- DRAG AND DROP ENGINE FOR PITCH & BENCH -----------------

let currentDragData = null; // { playerId, fromSlotIdx }

function handlePitchDragStart(e, playerId, fromSlotIdx) {
    currentDragData = { playerId: parseInt(playerId), fromSlotIdx: parseInt(fromSlotIdx) };
    e.dataTransfer.setData('text/plain', JSON.stringify(currentDragData));
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('dragging');
}

function handleBenchDragStart(e, playerId) {
    currentDragData = { playerId: parseInt(playerId), fromSlotIdx: null };
    e.dataTransfer.setData('text/plain', JSON.stringify(currentDragData));
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('dragging');
}

function handleDragEnd(e) {
    if (e && e.currentTarget) e.currentTarget.classList.remove('dragging');
    document.querySelectorAll('.pitch-slot').forEach(s => s.classList.remove('slot-highlight'));
}

function handleSlotDrop(e, targetSlotIdx) {
    e.preventDefault();
    e.currentTarget.classList.remove('slot-highlight');
    if (!currentDragData) return;

    const { playerId, fromSlotIdx } = currentDragData;
    targetSlotIdx = parseInt(targetSlotIdx);

    if (!managerCustomLineups[selectedSquadManagerId]) {
        managerCustomLineups[selectedSquadManagerId] = { formation: '4-3-3', slots: {} };
    }
    const assignedSlots = managerCustomLineups[selectedSquadManagerId].slots || {};

    if (fromSlotIdx !== null) {
        // Dragged from another slot: swap
        const prevTargetPlayerId = assignedSlots[targetSlotIdx];
        if (prevTargetPlayerId) {
            assignedSlots[fromSlotIdx] = prevTargetPlayerId;
        } else {
            delete assignedSlots[fromSlotIdx];
        }
    } else {
        // Dragged from bench: remove from any prior slot if present
        Object.keys(assignedSlots).forEach(sIdx => {
            if (assignedSlots[sIdx] === playerId) {
                delete assignedSlots[sIdx];
            }
        });
    }

    assignedSlots[targetSlotIdx] = playerId;
    managerCustomLineups[selectedSquadManagerId].slots = assignedSlots;
    saveManagerLineups();

    currentDragData = null;
    loadManagersHub();
}

function handleDropToBench(e) {
    e.preventDefault();
    if (!currentDragData || currentDragData.fromSlotIdx === null) return;
    
    // Dragged from pitch to bench: remove from starting lineup
    const { fromSlotIdx } = currentDragData;
    if (managerCustomLineups[selectedSquadManagerId]?.slots) {
        delete managerCustomLineups[selectedSquadManagerId].slots[fromSlotIdx];
        saveManagerLineups();
    }
    currentDragData = null;
    loadManagersHub();
}

// ----------------- SLOT ASSIGN / SWAP MODAL HANDLERS -----------------

function openSlotAssignModal(slotIdx, slotPos) {
    activeAssignSlotIdx = slotIdx;
    activeAssignSlotPos = slotPos;

    const modal = document.getElementById('slot-assign-modal');
    const title = document.getElementById('assign-modal-slot-title');
    const list = document.getElementById('slot-assign-list');

    title.textContent = `SLOT: ${slotPos} (Position #${slotIdx + 1})`;

    if (!currentAuctionState || !currentAuctionState.managers) return;
    const mgr = currentAuctionState.managers.find(m => m.id === selectedSquadManagerId);
    if (!mgr || !mgr.roster || mgr.roster.length === 0) {
        showCustomToast('Empty Squad', 'No players in this squad to assign! Win live auctions to build your squad.', 'info');
        return;
    }

    const mgrData = managerCustomLineups[selectedSquadManagerId] || { formation: '4-3-3', slots: {} };
    const assignedSlots = mgrData.slots || {};
    const currentPlayerIdInSlot = assignedSlots[slotIdx];

    list.innerHTML = mgr.roster.map(p => {
        const isCurrentInSlot = p.id === currentPlayerIdInSlot;
        let assignedSlotLabel = 'On Bench';
        let isStarter = false;

        Object.keys(assignedSlots).forEach(sIdx => {
            if (assignedSlots[sIdx] === p.id) {
                isStarter = true;
                const formKey = mgrData.formation || '4-3-3';
                const formDef = FORMATIONS[formKey] || FORMATIONS['4-3-3'];
                let foundPos = 'Pitch';
                formDef.rows.forEach(r => r.forEach(s => { if (s.idx === parseInt(sIdx)) foundPos = s.pos; }));
                assignedSlotLabel = `Starting XI (${foundPos})`;
            }
        });

        return `
            <div onclick="assignPlayerToSlot(${p.id})" class="p-3 rounded-2xl border-2 ${isCurrentInSlot ? 'border-amber-500 bg-amber-50/50' : 'border-slate-200 hover:border-slate-300 bg-slate-50/60'} flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01]">
                <div class="flex items-center space-x-3">
                    <img src="${p.photo_url || '/assets/default_player.svg'}" alt="${p.name}" class="w-10 h-10 rounded-full object-cover bg-white border border-slate-300" onerror="this.onerror=null; this.src='/assets/default_player.svg';">
                    <div>
                        <div class="flex items-center space-x-2">
                            <span class="font-['Outfit'] font-black text-sm text-slate-900">${p.name}</span>
                            <span class="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-black font-['Oswald']">${p.overall_rating} OVR</span>
                        </div>
                        <span class="text-[11px] font-bold text-slate-500">${p.position} • ${p.club_name || 'Free Agent'}</span>
                    </div>
                </div>
                <div class="text-right">
                    <span class="text-[10px] font-black uppercase px-2 py-1 rounded-lg ${isStarter ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}">${assignedSlotLabel}</span>
                    <span class="block text-[10px] font-black text-amber-600 mt-0.5">${isCurrentInSlot ? '✓ Current' : 'Tap to Place'}</span>
                </div>
            </div>
        `;
    }).join('');

    modal.classList.remove('hidden');
}

function openSlotAssignForBench(playerId) {
    if (!currentAuctionState || !currentAuctionState.managers) return;
    const mgr = currentAuctionState.managers.find(m => m.id === selectedSquadManagerId);
    if (!mgr || !mgr.roster) return;

    const mgrData = managerCustomLineups[selectedSquadManagerId] || { formation: '4-3-3', slots: {} };
    const formKey = mgrData.formation || '4-3-3';
    const formDef = FORMATIONS[formKey] || FORMATIONS['4-3-3'];
    const assignedSlots = mgrData.slots || {};

    // Find first empty slot or default to first slot
    let targetIdx = 0;
    let targetPos = 'ST';

    for (const r of formDef.rows) {
        for (const s of r) {
            if (!assignedSlots[s.idx]) {
                targetIdx = s.idx;
                targetPos = s.pos;
                break;
            }
        }
    }

    openSlotAssignModal(targetIdx, targetPos);
}

function assignPlayerToSlot(playerId) {
    if (activeAssignSlotIdx === null) return;
    
    if (!managerCustomLineups[selectedSquadManagerId]) {
        managerCustomLineups[selectedSquadManagerId] = { formation: '4-3-3', slots: {} };
    }

    const assignedSlots = managerCustomLineups[selectedSquadManagerId].slots || {};

    // If this player was in another slot, swap or clear that other slot
    Object.keys(assignedSlots).forEach(sIdx => {
        if (assignedSlots[sIdx] === playerId && parseInt(sIdx) !== activeAssignSlotIdx) {
            // Swap: put whatever was in activeAssignSlotIdx into this other slot
            const prevInCurrent = assignedSlots[activeAssignSlotIdx];
            if (prevInCurrent) {
                assignedSlots[sIdx] = prevInCurrent;
            } else {
                delete assignedSlots[sIdx];
            }
        }
    });

    assignedSlots[activeAssignSlotIdx] = playerId;
    managerCustomLineups[selectedSquadManagerId].slots = assignedSlots;
    saveManagerLineups();

    closeSlotAssignModal();
    loadManagersHub();
}

function clearCurrentSlot() {
    if (activeAssignSlotIdx === null) return;
    if (managerCustomLineups[selectedSquadManagerId]?.slots) {
        delete managerCustomLineups[selectedSquadManagerId].slots[activeAssignSlotIdx];
        saveManagerLineups();
    }
    closeSlotAssignModal();
    loadManagersHub();
}

function closeSlotAssignModal() {
    document.getElementById('slot-assign-modal')?.classList.add('hidden');
    activeAssignSlotIdx = null;
}

async function releasePlayer(rosterId) {
    const confirmed = await showCustomConfirm({
        title: 'Release Player?',
        desc: 'Are you sure you want to release this player? They will return to the transfer pool and the full acquisition cost will be refunded to the manager.',
        icon: 'fa-user-minus',
        confirmText: 'Release & Refund',
        theme: 'rose'
    });
    if (!confirmed) return;
    
    try {
        const res = await fetch('/api/auction/release_player', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roster_id: rosterId })
        });
        const data = await res.json();
        
        if (data.error) {
            showCustomToast('Error', data.error, 'error');
            return;
        }

        showCustomToast('Player Released', data.message || 'Player released and refunded successfully!', 'success');
        loadManagersHub();
    } catch (err) {
        console.error('Failed to release player:', err);
        showCustomToast('Error', 'Failed to release player.', 'error');
    }
}

async function releaseAllPlayersForSelectedManager() {
    if (!selectedSquadManagerId) return;
    if (!currentAuctionState || !currentAuctionState.managers) return;
    const mgr = currentAuctionState.managers.find(m => m.id === selectedSquadManagerId);
    if (!mgr || !mgr.roster || mgr.roster.length === 0) {
        showCustomToast('No Players', `${mgr ? mgr.name : 'This squad'} has no acquired players to release.`, 'info');
        return;
    }

    const detailsHtml = `
        <div class="space-y-1.5">
            <div class="flex justify-between items-center"><span class="text-slate-500">Club:</span><span class="font-black text-slate-900">${mgr.avatar} ${mgr.name}</span></div>
            <div class="flex justify-between items-center"><span class="text-slate-500">Players Released:</span><span class="font-black text-rose-600">${mgr.roster.length} Players</span></div>
            <div class="flex justify-between items-center pt-1 border-t border-slate-100"><span class="text-slate-500">Refund to Purse:</span><span class="font-black text-emerald-600 font-mono text-sm">+${formatMoney(mgr.spent)}</span></div>
        </div>
    `;

    const confirmed = await showCustomConfirm({
        title: `Release Full Squad?`,
        desc: `Are you sure you want to release all acquired players from ${mgr.name}?`,
        detailsHtml: detailsHtml,
        icon: 'fa-trash-can',
        confirmText: `Release All (${mgr.roster.length})`,
        theme: 'rose'
    });
    if (!confirmed) return;

    try {
        const res = await fetch('/api/auction/release_team_roster', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ manager_id: selectedSquadManagerId })
        });
        const data = await res.json();
        if (data.error) {
            showCustomToast('Error', data.error, 'error');
            return;
        }

        // Clear local slot memory for this manager
        if (managerCustomLineups[selectedSquadManagerId]) {
            managerCustomLineups[selectedSquadManagerId].slots = {};
            saveManagerLineups();
        }

        showCustomToast('Squad Released', data.message || 'All players released and refunded successfully!', 'success');
        loadManagersHub();
    } catch (err) {
        console.error('Failed to release squad players:', err);
        showCustomToast('Error', 'Failed to release squad players.', 'error');
    }
}

// ----------------- SETTINGS & RESET -----------------

async function loadSettingsView() {
    try {
        const res = await fetch('/api/auction/state');
        const data = await res.json();
        
        const list = document.getElementById('settings-managers-list');
        if (list && data.managers) {
            list.innerHTML = data.managers.map(m => `
                <div class="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <div class="flex items-center space-x-3">
                        <span class="text-2xl">${m.avatar}</span>
                        <span class="font-black text-slate-900 text-sm font-['Outfit']">${m.name}</span>
                    </div>
                    <div class="flex items-center space-x-3 text-xs font-bold">
                        <span class="text-emerald-700 font-mono text-sm">${formatMoney(m.budget)}</span>
                    </div>
                </div>
            `).join('');
        }
    } catch (err) {
        console.error('Settings load error:', err);
    }
}

// ----------------- CONNECT REMOTE FRIENDS & QR CODE -----------------

let qrcodeInstance = null;
let connectMode = 'cloudflare'; // 'cloudflare' or 'local'
let cachedHostInfo = null;
let hostInfoPollInterval = null;

async function fetchHostInfoData() {
    try {
        const res = await fetch('/api/host_info');
        if (res.ok) {
            cachedHostInfo = await res.json();
            return cachedHostInfo;
        }
    } catch (e) {
        console.error('Host info fetch error:', e);
    }
    return cachedHostInfo || {};
}

function renderConnectQR(url) {
    const qrContainer = document.getElementById('qrcode-container');
    if (qrContainer && typeof QRCode !== 'undefined') {
        qrContainer.innerHTML = '';
        qrcodeInstance = new QRCode(qrContainer, {
            text: url,
            width: 156,
            height: 156,
            colorDark: '#0f172a',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });
    }
}

function updateConnectModalUI() {
    const input = document.getElementById('share-bidder-url');
    const label = document.getElementById('share-bidder-label');
    const qrLabel = document.getElementById('connect-qr-label');
    const statusBadge = document.getElementById('connect-tunnel-status-badge');
    const btnCloudflare = document.getElementById('btn-mode-cloudflare');
    const btnLocal = document.getElementById('btn-mode-local');

    const info = cachedHostInfo || {};
    const curOrigin = window.location.origin ? window.location.origin.replace(/\/+$/, '') : '';
    const curHostname = window.location.hostname || '';

    // Check if hosted on a public domain (like PythonAnywhere, custom domain, Render, etc.)
    const isPublicDomain = Boolean(
        curHostname && 
        curHostname !== 'localhost' && 
        curHostname !== '127.0.0.1' && 
        !curHostname.startsWith('192.168.') && 
        !curHostname.startsWith('10.') && 
        !curHostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)
    );

    // Prefer Cloudflare tunnel, then public origin (PythonAnywhere, etc.), then info local bidder url
    const tunnelUrl = info.public_tunnel_url || (isPublicDomain ? curOrigin : '');
    const publicBidderUrl = tunnelUrl ? `${tunnelUrl}/bidder` : (isPublicDomain ? `${curOrigin}/bidder` : '');
    const localBidderUrl = (isPublicDomain ? `${curOrigin}/bidder` : (info.local_bidder_url || `${curOrigin}/bidder`));

    const isLivePublic = Boolean(publicBidderUrl && (isPublicDomain || info.is_public_cloud || (tunnelUrl && tunnelUrl.includes('trycloudflare.com'))));

    if (btnCloudflare) {
        if (isPublicDomain) {
            btnCloudflare.innerHTML = `<i class="fa-solid fa-earth-americas text-emerald-600"></i><span>Online Link (${curHostname})</span>`;
        } else {
            btnCloudflare.innerHTML = '<i class="fa-solid fa-earth-americas text-emerald-600"></i><span>Cloudflare Online (Internet)</span>';
        }
    }

    if (btnLocal) {
        if (isPublicDomain) {
            btnLocal.innerHTML = '<i class="fa-solid fa-link text-blue-600"></i><span>Direct Web Link</span>';
        } else {
            btnLocal.innerHTML = '<i class="fa-solid fa-wifi text-blue-600"></i><span>Same Home Wi-Fi</span>';
        }
    }

    if (isLivePublic) {
        if (statusBadge) {
            statusBadge.className = 'inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black border border-emerald-300';
            if (isPublicDomain) {
                statusBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span><span>Live Online Server Active (${curHostname})</span>`;
            } else {
                statusBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span><span>Cloudflare Live Tunnel Active</span>';
            }
        }
    } else {
        if (statusBadge) {
            statusBadge.className = 'inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-black border border-amber-300';
            statusBadge.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-amber-600 mr-1"></i><span>Establishing Cloudflare Link...</span>';
        }
    }

    let activeUrl = '';
    if (connectMode === 'cloudflare') {
        if (btnCloudflare) btnCloudflare.className = 'flex-1 py-2 px-3 rounded-xl font-black transition-all flex items-center justify-center space-x-1.5 bg-white text-slate-900 shadow-sm';
        if (btnLocal) btnLocal.className = 'flex-1 py-2 px-3 rounded-xl font-bold transition-all flex items-center justify-center space-x-1.5 text-slate-500 hover:text-slate-900';
        
        activeUrl = publicBidderUrl || localBidderUrl;
        if (label) label.textContent = isPublicDomain ? `Online Bidding URL (${curHostname})` : 'Cloudflare Online Bidding URL';
        if (qrLabel) qrLabel.textContent = isLivePublic ? `Scan with Phone Camera to Join from Anywhere!` : 'Connecting to Cloudflare... Scan for Local Link';
    } else {
        if (btnLocal) btnLocal.className = 'flex-1 py-2 px-3 rounded-xl font-black transition-all flex items-center justify-center space-x-1.5 bg-white text-slate-900 shadow-sm';
        if (btnCloudflare) btnCloudflare.className = 'flex-1 py-2 px-3 rounded-xl font-bold transition-all flex items-center justify-center space-x-1.5 text-slate-500 hover:text-slate-900';

        activeUrl = localBidderUrl;
        if (label) label.textContent = isPublicDomain ? 'Direct Bidding URL' : 'Same Wi-Fi Local Bidding URL';
        if (qrLabel) qrLabel.textContent = isPublicDomain ? 'Scan to Join Online Auction' : 'Scan for Same Home Wi-Fi Network Link';
    }

    if (input) input.value = activeUrl;
    renderConnectQR(activeUrl);
}

function switchConnectMode(mode) {
    connectMode = mode;
    updateConnectModalUI();
}

async function openConnectModal() {
    const modal = document.getElementById('connect-modal');
    if (!modal) return;
    modal.classList.remove('hidden');

    connectMode = 'cloudflare';
    await fetchHostInfoData();
    updateConnectModalUI();

    // If Cloudflare tunnel isn't captured yet, poll every 1s for up to 12s
    if (hostInfoPollInterval) clearInterval(hostInfoPollInterval);
    let pollCount = 0;
    hostInfoPollInterval = setInterval(async () => {
        pollCount++;
        const info = await fetchHostInfoData();
        if (info.public_tunnel_url || pollCount > 12) {
            clearInterval(hostInfoPollInterval);
            hostInfoPollInterval = null;
        }
        updateConnectModalUI();
    }, 1000);
}

function closeConnectModal() {
    if (hostInfoPollInterval) {
        clearInterval(hostInfoPollInterval);
        hostInfoPollInterval = null;
    }
    const modal = document.getElementById('connect-modal');
    if (modal) modal.classList.add('hidden');
}

function copyBidderUrl() {
    const input = document.getElementById('share-bidder-url');
    if (!input) return;
    input.select();
    input.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(input.value);
    showCustomToast('Link Copied! 📋', 'Mobile Bidding URL copied to clipboard. Share it with your friends!', 'success');
}

// ----------------- PLAYER COMPARISON ENGINE -----------------

let comparePlayer1Id = 237067; // Pelé
let comparePlayer2Id = 237068; // Maradona
let compareSearchTimer1 = null;
let compareSearchTimer2 = null;

function loadComparisonPair(p1Id, p2Id) {
    comparePlayer1Id = p1Id;
    comparePlayer2Id = p2Id;
    loadComparisonView();
}

function searchComparePlayer(slotNum) {
    const input = document.getElementById(`compare-search-${slotNum}`);
    const resultsContainer = document.getElementById(`compare-results-${slotNum}`);
    const term = input?.value?.trim();

    if (!term || term.length < 2) {
        if (resultsContainer) resultsContainer.classList.add('hidden');
        return;
    }

    const timer = slotNum === 1 ? compareSearchTimer1 : compareSearchTimer2;
    clearTimeout(timer);

    const newTimer = setTimeout(async () => {
        try {
            const res = await fetch(`/api/players?search=${encodeURIComponent(term)}&limit=6`);
            const data = await res.json();
            const players = data.players || [];

            if (players.length === 0) {
                resultsContainer.innerHTML = `<div class="p-3 text-center text-slate-400 font-bold">No players found</div>`;
            } else {
                resultsContainer.innerHTML = players.map(p => `
                    <div onclick="selectComparePlayer(${slotNum}, ${p.id})" class="p-2.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors">
                        <div class="flex items-center space-x-2.5">
                            <img src="${p.photo_url || '/assets/default_player.svg'}" class="w-8 h-8 rounded-full object-cover bg-slate-100 border border-slate-200" onerror="this.src='/assets/default_player.svg';">
                            <div>
                                <span class="font-black text-slate-900 block">${p.name}</span>
                                <span class="text-[10px] text-slate-500 font-bold">${p.position} • ${p.club_name || 'Free Agent'}</span>
                            </div>
                        </div>
                        <span class="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-black font-['Oswald'] text-xs">${p.overall_rating} OVR</span>
                    </div>
                `).join('');
            }
            resultsContainer.classList.remove('hidden');
        } catch (e) {
            console.error('Compare search error:', e);
        }
    }, 250);

    if (slotNum === 1) compareSearchTimer1 = newTimer;
    else compareSearchTimer2 = newTimer;
}

function selectComparePlayer(slotNum, playerId) {
    if (slotNum === 1) comparePlayer1Id = playerId;
    else comparePlayer2Id = playerId;

    const resultsContainer = document.getElementById(`compare-results-${slotNum}`);
    const input = document.getElementById(`compare-search-${slotNum}`);
    if (resultsContainer) resultsContainer.classList.add('hidden');
    if (input) input.value = '';

    loadComparisonView();
}

async function loadComparisonView() {
    const arena = document.getElementById('compare-arena-container');
    if (!arena) return;

    arena.innerHTML = `<div class="py-16 text-center"><i class="fa-solid fa-circle-notch fa-spin text-4xl text-amber-500"></i></div>`;

    try {
        const [res1, res2] = await Promise.all([
            fetch(`/api/players/${comparePlayer1Id}`),
            fetch(`/api/players/${comparePlayer2Id}`)
        ]);

        const p1 = await res1.json();
        const p2 = await res2.json();

        // Update Labels
        const l1 = document.getElementById('compare-p1-label');
        const l2 = document.getElementById('compare-p2-label');
        if (l1) l1.textContent = `${p1.name} (${p1.overall_rating})`;
        if (l2) l2.textContent = `${p2.name} (${p2.overall_rating})`;

        // Render Head to Head comparison matrix
        arena.innerHTML = renderComparisonMatrix(p1, p2);

    } catch (err) {
        console.error('Failed to load comparison view:', err);
        arena.innerHTML = `<div class="p-8 text-center text-rose-500 font-bold">Failed to load comparison data.</div>`;
    }
}

function calcTotalStats(p) {
    const keys = [
        'acceleration', 'sprint_speed', 'agility', 'balance', 'reactions', 'ball_control', 'dribbling', 'composure',
        'positioning', 'finishing', 'shot_power', 'long_shots', 'volleys', 'penalties', 'vision', 'crossing',
        'free_kick_accuracy', 'short_passing', 'long_passing', 'curve', 'interceptions', 'heading_accuracy',
        'marking', 'standing_tackle', 'sliding_tackle', 'jumping', 'stamina', 'strength', 'aggression'
    ];
    return keys.reduce((sum, k) => sum + (p[k] || 0), 0);
}

function renderComparisonMatrix(p1, p2) {
    const p1Total = calcTotalStats(p1);
    const p2Total = calcTotalStats(p2);
    const diffTotal = p1Total - p2Total;

    const p1Action = p1.is_sold ?
        `<span class="text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1 rounded-xl">✓ Sold to ${p1.sold_to_manager_name}</span>` :
        `<button onclick="nominatePlayerFromCard(${p1.id}, ${p1.base_price})" class="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-black text-xs uppercase shadow border border-amber-300 active:scale-95 transition-all"><i class="fa-solid fa-gavel mr-1"></i> Auction ${p1.name.split(' ').pop()}</button>`;

    const p2Action = p2.is_sold ?
        `<span class="text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1 rounded-xl">✓ Sold to ${p2.sold_to_manager_name}</span>` :
        `<button onclick="nominatePlayerFromCard(${p2.id}, ${p2.base_price})" class="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-black text-xs uppercase shadow border border-blue-400 active:scale-95 transition-all"><i class="fa-solid fa-gavel mr-1"></i> Auction ${p2.name.split(' ').pop()}</button>`;

    return `
        <!-- 1. Top Comparison Cards & Total Summary -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
            <!-- Player 1 Card -->
            <div class="bg-gradient-to-b from-white via-amber-50/20 to-white border-2 border-amber-400 rounded-3xl p-5 shadow-xl space-y-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <div class="w-16 h-16 rounded-2xl bg-amber-100 border border-amber-300 overflow-hidden shadow-sm">
                            <img src="${p1.photo_url || '/assets/default_player.svg'}" class="w-full h-full object-cover" onerror="this.src='/assets/default_player.svg';">
                        </div>
                        <div>
                            <h3 class="font-['Outfit'] font-black text-xl text-slate-900">${p1.name}</h3>
                            <span class="text-xs font-bold text-slate-500">${p1.position} • ${p1.club_name || 'Free Agent'} • ${p1.nationality}</span>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="font-['Oswald'] text-4xl font-black text-amber-600 leading-none">${p1.overall_rating}</span>
                        <span class="text-[10px] font-bold text-slate-400 block uppercase">Overall</span>
                    </div>
                </div>

                <div class="grid grid-cols-3 gap-2 text-center text-xs font-bold bg-white p-3 rounded-2xl border border-amber-200">
                    <div><span class="text-[10px] text-slate-400 uppercase block">Base Price</span><strong class="text-amber-700 font-black">${formatMoney(p1.base_price)}</strong></div>
                    <div><span class="text-[10px] text-slate-400 uppercase block">Potential</span><strong class="text-emerald-600 font-black">${p1.potential} POT</strong></div>
                    <div><span class="text-[10px] text-slate-400 uppercase block">Total Stats</span><strong class="text-slate-900 font-black">${p1Total.toLocaleString()}</strong></div>
                </div>

                <div class="flex items-center justify-between pt-1">
                    <span class="text-xs font-bold text-slate-500">${p1.age} yrs • ${p1.height_cm || 180}cm</span>
                    ${p1Action}
                </div>
            </div>

            <!-- Player 2 Card -->
            <div class="bg-gradient-to-b from-white via-blue-50/20 to-white border-2 border-blue-400 rounded-3xl p-5 shadow-xl space-y-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <div class="w-16 h-16 rounded-2xl bg-blue-100 border border-blue-300 overflow-hidden shadow-sm">
                            <img src="${p2.photo_url || '/assets/default_player.svg'}" class="w-full h-full object-cover" onerror="this.src='/assets/default_player.svg';">
                        </div>
                        <div>
                            <h3 class="font-['Outfit'] font-black text-xl text-slate-900">${p2.name}</h3>
                            <span class="text-xs font-bold text-slate-500">${p2.position} • ${p2.club_name || 'Free Agent'} • ${p2.nationality}</span>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="font-['Oswald'] text-4xl font-black text-blue-600 leading-none">${p2.overall_rating}</span>
                        <span class="text-[10px] font-bold text-slate-400 block uppercase">Overall</span>
                    </div>
                </div>

                <div class="grid grid-cols-3 gap-2 text-center text-xs font-bold bg-white p-3 rounded-2xl border border-blue-200">
                    <div><span class="text-[10px] text-slate-400 uppercase block">Base Price</span><strong class="text-amber-700 font-black">${formatMoney(p2.base_price)}</strong></div>
                    <div><span class="text-[10px] text-slate-400 uppercase block">Potential</span><strong class="text-emerald-600 font-black">${p2.potential} POT</strong></div>
                    <div><span class="text-[10px] text-slate-400 uppercase block">Total Stats</span><strong class="text-slate-900 font-black">${p2Total.toLocaleString()}</strong></div>
                </div>

                <div class="flex items-center justify-between pt-1">
                    <span class="text-xs font-bold text-slate-500">${p2.age} yrs • ${p2.height_cm || 180}cm</span>
                    ${p2Action}
                </div>
            </div>
        </div>

        <!-- 2. Overall Total Stats Comparison Banner -->
        <div class="bg-white border border-slate-200 rounded-3xl p-5 shadow-md flex items-center justify-between text-xs font-bold">
            <div class="flex items-center space-x-2">
                <span class="w-3 h-3 rounded-full bg-indigo-500"></span>
                <span class="font-black text-slate-900 uppercase font-['Outfit'] text-sm">Total In-Game Attributes:</span>
            </div>
            <div class="flex items-center space-x-4">
                <span class="font-['Outfit'] font-black text-base text-amber-700">${p1.name.split(' ').pop()}: ${p1Total}</span>
                <span class="text-slate-300">vs</span>
                <span class="font-['Outfit'] font-black text-base text-blue-700">${p2.name.split(' ').pop()}: ${p2Total}</span>
                <span class="px-2.5 py-1 rounded-xl ${diffTotal >= 0 ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-blue-100 text-blue-900 border border-blue-300'} font-extrabold text-[11px]">
                    ${diffTotal >= 0 ? `+${diffTotal} for ${p1.name.split(' ').pop()}` : `+${Math.abs(diffTotal)} for ${p2.name.split(' ').pop()}`}
                </span>
            </div>
        </div>

        <!-- 3. Six Main Card Attributes Comparison (PAC, SHO, PAS, DRI, DEF, PHY) -->
        <div class="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 class="font-['Outfit'] font-black text-base text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-3">
                Card Rating Face Comparison
            </h3>
            <div class="space-y-3">
                ${renderCompareRow('Pace (PAC)', p1.card_pac, p2.card_pac, p1.name, p2.name)}
                ${renderCompareRow('Shooting (SHO)', p1.card_sho, p2.card_sho, p1.name, p2.name)}
                ${renderCompareRow('Passing (PAS)', p1.card_pas, p2.card_pas, p1.name, p2.name)}
                ${renderCompareRow('Dribbling (DRI)', p1.card_dri, p2.card_dri, p1.name, p2.name)}
                ${renderCompareRow('Defending (DEF)', p1.card_def, p2.card_def, p1.name, p2.name)}
                ${renderCompareRow('Physicality (PHY)', p1.card_phy, p2.card_phy, p1.name, p2.name)}
            </div>
        </div>

        <!-- 4. In-Depth 30+ Attribute Matrix (Categorized) -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
            <!-- Pace & Shooting -->
            <div class="bg-white border border-slate-200 rounded-3xl p-5 shadow-lg space-y-3">
                <span class="font-black text-rose-700 uppercase tracking-wider text-xs block border-b border-slate-100 pb-2">🏃 Pace & 🎯 Shooting</span>
                <div class="space-y-2 text-xs">
                    ${renderCompareRow('Acceleration', p1.acceleration, p2.acceleration)}
                    ${renderCompareRow('Sprint Speed', p1.sprint_speed, p2.sprint_speed)}
                    ${renderCompareRow('Positioning', p1.positioning, p2.positioning)}
                    ${renderCompareRow('Finishing', p1.finishing, p2.finishing)}
                    ${renderCompareRow('Shot Power', p1.shot_power, p2.shot_power)}
                    ${renderCompareRow('Long Shots', p1.long_shots, p2.long_shots)}
                    ${renderCompareRow('Volleys', p1.volleys, p2.volleys)}
                    ${renderCompareRow('Penalties', p1.penalties, p2.penalties)}
                </div>
            </div>

            <!-- Passing & Dribbling -->
            <div class="bg-white border border-slate-200 rounded-3xl p-5 shadow-lg space-y-3">
                <span class="font-black text-blue-700 uppercase tracking-wider text-xs block border-b border-slate-100 pb-2">🪄 Passing & ⚡ Dribbling</span>
                <div class="space-y-2 text-xs">
                    ${renderCompareRow('Vision', p1.vision, p2.vision)}
                    ${renderCompareRow('Crossing', p1.crossing, p2.crossing)}
                    ${renderCompareRow('Free Kick', p1.free_kick_accuracy, p2.free_kick_accuracy)}
                    ${renderCompareRow('Short Pass', p1.short_passing, p2.short_passing)}
                    ${renderCompareRow('Long Pass', p1.long_passing, p2.long_passing)}
                    ${renderCompareRow('Curve', p1.curve, p2.curve)}
                    ${renderCompareRow('Agility', p1.agility, p2.agility)}
                    ${renderCompareRow('Balance', p1.balance, p2.balance)}
                    ${renderCompareRow('Reactions', p1.reactions, p2.reactions)}
                    ${renderCompareRow('Ball Control', p1.ball_control, p2.ball_control)}
                    ${renderCompareRow('Dribbling', p1.dribbling, p2.dribbling)}
                    ${renderCompareRow('Composure', p1.composure, p2.composure)}
                </div>
            </div>

            <!-- Defending & Physical -->
            <div class="bg-white border border-slate-200 rounded-3xl p-5 shadow-lg space-y-3">
                <span class="font-black text-emerald-700 uppercase tracking-wider text-xs block border-b border-slate-100 pb-2">🛡️ Defending & 💪 Physical</span>
                <div class="space-y-2 text-xs">
                    ${renderCompareRow('Interceptions', p1.interceptions, p2.interceptions)}
                    ${renderCompareRow('Heading', p1.heading_accuracy, p2.heading_accuracy)}
                    ${renderCompareRow('Marking', p1.marking, p2.marking)}
                    ${renderCompareRow('Stand Tackle', p1.standing_tackle, p2.standing_tackle)}
                    ${renderCompareRow('Slide Tackle', p1.sliding_tackle, p2.sliding_tackle)}
                    ${renderCompareRow('Jumping', p1.jumping, p2.jumping)}
                    ${renderCompareRow('Stamina', p1.stamina, p2.stamina)}
                    ${renderCompareRow('Strength', p1.strength, p2.strength)}
                    ${renderCompareRow('Aggression', p1.aggression, p2.aggression)}
                </div>
            </div>
        </div>
    `;
}

function renderCompareRow(statName, v1, v2) {
    if (v1 === undefined || v1 === null) v1 = 50;
    if (v2 === undefined || v2 === null) v2 = 50;

    const diff = v1 - v2;
    const isP1Win = diff > 0;
    const isP2Win = diff < 0;

    const p1Pill = isP1Win ?
        `bg-emerald-500 text-white font-black shadow-sm` :
        `bg-slate-100 text-slate-700 font-bold`;

    const p2Pill = isP2Win ?
        `bg-emerald-500 text-white font-black shadow-sm` :
        `bg-slate-100 text-slate-700 font-bold`;

    const diffBadge = diff !== 0 ?
        `<span class="text-[9px] font-black font-mono px-1.5 py-0.5 rounded ${isP1Win ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}">${isP1Win ? `+${diff}` : `-${Math.abs(diff)}`}</span>` :
        `<span class="text-[9px] font-bold text-slate-400 font-mono">=</span>`;

    return `
        <div class="space-y-1">
            <div class="flex items-center justify-between text-[11px] font-bold">
                <span class="px-2 py-0.5 rounded-lg font-['Oswald'] text-xs ${p1Pill}">${v1}</span>
                <div class="flex items-center space-x-1.5">
                    <span class="text-slate-600">${statName}</span>
                    ${diffBadge}
                </div>
                <span class="px-2 py-0.5 rounded-lg font-['Oswald'] text-xs ${p2Pill}">${v2}</span>
            </div>
            <!-- Dual comparative progress gauge -->
            <div class="grid grid-cols-2 gap-1.5 h-1.5">
                <div class="w-full bg-slate-100 rounded-full overflow-hidden flex justify-end">
                    <div class="${isP1Win ? 'bg-amber-500' : 'bg-slate-300'} h-full rounded-full transition-all" style="width: ${Math.min(100, Math.max(5, v1))}%"></div>
                </div>
                <div class="w-full bg-slate-100 rounded-full overflow-hidden flex justify-start">
                    <div class="${isP2Win ? 'bg-blue-500' : 'bg-slate-300'} h-full rounded-full transition-all" style="width: ${Math.min(100, Math.max(5, v2))}%"></div>
                </div>
            </div>
        </div>
    `;
}

async function confirmResetAuction() {
    const detailsHtml = `
        <div class="space-y-1.5 text-rose-700">
            <p>• All manager acquired rosters will be cleared.</p>
            <p>• Manager purses will be refunded back to ₹1,500 INR.</p>
            <p>• Auction bid transaction logs will be cleared.</p>
        </div>
    `;

    const confirmed = await showCustomConfirm({
        title: 'Reset Auction Season?',
        desc: 'WARNING: This will completely reset all team rosters, refund all purses back to ₹1,500 INR, and restart the season.',
        detailsHtml: detailsHtml,
        icon: 'fa-skull-crossbones',
        confirmText: 'Reset Everything',
        theme: 'rose'
    });
    if (!confirmed) return;
    
    try {
        const res = await fetch('/api/auction/reset', { method: 'POST' });
        const data = await res.json();
        managerCustomLineups = {};
        saveManagerLineups();
        showCustomToast('Season Reset', data.message || 'Auction season reset to ₹1,500 INR!', 'success');
        switchTab('explorer');
    } catch (err) {
        console.error('Failed to reset auction:', err);
        showCustomToast('Error', 'Failed to reset auction season.', 'error');
    }
}

// ----------------- CUSTOM ACTION CONFIRMATION & TOAST ENGINE -----------------

let confirmModalResolver = null;

function showCustomConfirm({ title, desc, detailsHtml, icon = 'fa-triangle-exclamation', confirmText = 'Confirm', cancelText = 'Cancel', theme = 'rose' }) {
    return new Promise((resolve) => {
        confirmModalResolver = resolve;

        const modal = document.getElementById('custom-confirm-modal');
        const box = document.getElementById('custom-confirm-box');
        const titleEl = document.getElementById('confirm-title');
        const descEl = document.getElementById('confirm-desc');
        const detailsBox = document.getElementById('confirm-details-box');
        const iconContainer = document.getElementById('confirm-icon-container');
        const iconEl = document.getElementById('confirm-icon');
        const okBtn = document.getElementById('confirm-ok-btn');
        const cancelBtn = document.getElementById('confirm-cancel-btn');

        if (titleEl) titleEl.textContent = title || 'Confirm Action';
        if (descEl) descEl.textContent = desc || 'Are you sure you want to proceed?';

        if (detailsBox) {
            if (detailsHtml) {
                detailsBox.innerHTML = detailsHtml;
                detailsBox.classList.remove('hidden');
            } else {
                detailsBox.classList.add('hidden');
            }
        }

        if (iconEl) iconEl.className = `fa-solid ${icon}`;
        if (okBtn) okBtn.textContent = confirmText;
        if (cancelBtn) cancelBtn.textContent = cancelText;

        if (theme === 'amber') {
            if (iconContainer) iconContainer.className = 'w-16 h-16 rounded-3xl bg-amber-50 border-2 border-amber-300 text-amber-600 flex items-center justify-center mx-auto text-2xl shadow-inner';
            if (okBtn) okBtn.className = 'w-full py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/25 transition-all border border-amber-300 active:scale-95';
        } else if (theme === 'blue') {
            if (iconContainer) iconContainer.className = 'w-16 h-16 rounded-3xl bg-blue-50 border-2 border-blue-300 text-blue-600 flex items-center justify-center mx-auto text-2xl shadow-inner';
            if (okBtn) okBtn.className = 'w-full py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-blue-500/25 transition-all border border-blue-400 active:scale-95';
        } else {
            // Default rose / danger
            if (iconContainer) iconContainer.className = 'w-16 h-16 rounded-3xl bg-rose-50 border-2 border-rose-200 text-rose-600 flex items-center justify-center mx-auto text-2xl shadow-inner';
            if (okBtn) okBtn.className = 'w-full py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-rose-600/25 transition-all border border-rose-400 active:scale-95';
        }

        if (modal) modal.classList.remove('hidden');
        if (box) setTimeout(() => box.classList.remove('scale-95'), 20);
    });
}

function closeConfirmModal(confirmed) {
    const modal = document.getElementById('custom-confirm-modal');
    const box = document.getElementById('custom-confirm-box');
    if (box) box.classList.add('scale-95');
    setTimeout(() => {
        if (modal) modal.classList.add('hidden');
        if (confirmModalResolver) {
            confirmModalResolver(confirmed);
            confirmModalResolver = null;
        }
    }, 150);
}

let toastTimeout = null;
function showCustomToast(title, message, type = 'success') {
    const toast = document.getElementById('custom-app-toast');
    const heading = document.getElementById('toast-heading');
    const msg = document.getElementById('toast-message');
    const iconWrapper = document.getElementById('toast-icon-wrapper');
    const icon = document.getElementById('toast-status-icon');

    if (!toast) return;

    if (heading) heading.textContent = title;
    if (msg) msg.textContent = message;

    if (type === 'success') {
        if (iconWrapper) iconWrapper.className = 'w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center flex-shrink-0 text-sm mt-0.5';
        if (icon) icon.className = 'fa-solid fa-check';
    } else if (type === 'error') {
        if (iconWrapper) iconWrapper.className = 'w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center flex-shrink-0 text-sm mt-0.5';
        if (icon) icon.className = 'fa-solid fa-circle-exclamation';
    } else if (type === 'info') {
        if (iconWrapper) iconWrapper.className = 'w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-400 flex items-center justify-center flex-shrink-0 text-sm mt-0.5';
        if (icon) icon.className = 'fa-solid fa-info';
    }

    toast.classList.remove('hidden');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(hideAppToast, 4000);
}

function hideAppToast() {
    const toast = document.getElementById('custom-app-toast');
    if (toast) toast.classList.add('hidden');
}
