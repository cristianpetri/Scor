const isAdminUser = document.body ? document.body.getAttribute('data-is-admin') === '1' : false;

// Variabile globale
let currentMatchId = null;
let currentView = 'matches';
let liveTimerInterval = null;
let lastStandings = [];
let lastStatsData = { teams: [], matches: [] };
let matchesCache = [];
let liveMatchAutoRefreshInterval = null;
const LIVE_MATCH_REFRESH_INTERVAL_MS = 3000;
let pendingLiveMatchId = null;
let manualLiveSelectionActive = false;
let authPanel = null;
let authToggleButton = null;
let authDropdownInitialized = false;

const APP_TITLE_STORAGE_KEY = 'tournament_app_title';
const DEFAULT_APP_TITLE = '🏐 Manager Turneu Volei';

function parseStatValue(value) {
    const numericValue = Number(value);
    return Number.isNaN(numericValue) ? 0 : numericValue;
}

function computeStandingsMetrics(rawTeam) {
    const wins = parseStatValue(rawTeam.wins);
    const losses = parseStatValue(rawTeam.losses);
    const setsWon = parseStatValue(rawTeam.sets_won);
    const setsLost = parseStatValue(rawTeam.sets_lost);
    const pointsWon = parseStatValue(rawTeam.points_won);
    const pointsLost = parseStatValue(rawTeam.points_lost);

    const rankingPoints = (wins * 2) + losses;

    let setRatioValue = 0;
    if (setsWon === 0 && setsLost === 0) {
        setRatioValue = 0;
    } else if (setsLost === 0) {
        setRatioValue = Number.POSITIVE_INFINITY;
    } else {
        setRatioValue = setsWon / setsLost;
    }

    let pointRatioValue = 0;
    if (pointsWon === 0 && pointsLost === 0) {
        pointRatioValue = 0;
    } else if (pointsLost === 0) {
        pointRatioValue = Number.POSITIVE_INFINITY;
    } else {
        pointRatioValue = pointsWon / pointsLost;
    }

    const setRatioDisplay = (setsWon === 0 && setsLost === 0)
        ? '0.00'
        : (setsLost === 0 ? '∞' : setRatioValue.toFixed(2));
    const pointRatioDisplay = (pointsWon === 0 && pointsLost === 0)
        ? '0.00'
        : (pointsLost === 0 ? '∞' : pointRatioValue.toFixed(2));

    const setDiff = setsWon - setsLost;
    const pointDiff = pointsWon - pointsLost;

    return {
        ...rawTeam,
        wins,
        losses,
        sets_won: setsWon,
        sets_lost: setsLost,
        points_won: pointsWon,
        points_lost: pointsLost,
        ranking_points: rankingPoints,
        set_ratio_value: setRatioValue,
        point_ratio_value: pointRatioValue,
        set_ratio_display: setRatioDisplay,
        point_ratio_display: pointRatioDisplay,
        set_diff: setDiff,
        point_diff: pointDiff
    };
}

function compareDescNumeric(left, right) {
    if (left === right) return 0;
    if (left === Number.POSITIVE_INFINITY) return -1;
    if (right === Number.POSITIVE_INFINITY) return 1;
    if (Number.isNaN(left) && Number.isNaN(right)) return 0;
    if (Number.isNaN(left)) return 1;
    if (Number.isNaN(right)) return -1;
    return left > right ? -1 : 1;
}

function sortTeamsForStandings(teams) {
    const sorted = teams.slice();
    sorted.sort((a, b) => {
        let result = compareDescNumeric(a.ranking_points, b.ranking_points);
        if (result !== 0) return result;

        result = compareDescNumeric(a.set_ratio_value, b.set_ratio_value);
        if (result !== 0) return result;

        result = compareDescNumeric(a.point_ratio_value, b.point_ratio_value);
        if (result !== 0) return result;

        result = compareDescNumeric(a.set_diff, b.set_diff);
        if (result !== 0) return result;

        result = compareDescNumeric(a.point_diff, b.point_diff);
        if (result !== 0) return result;

        return a.name.localeCompare(b.name, 'ro', { sensitivity: 'base' });
    });
    return sorted;
}

function formatDifference(value) {
    if (value > 0) return `+${value}`;
    if (value === 0) return '0';
    return `${value}`;
}

function normalizeMatchId(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function updateCurrentMatchId(value) {
    const normalized = normalizeMatchId(value);
    currentMatchId = normalized;
    return normalized;
}

function updateMatchesCacheWithMatch(matchDetails) {
    if (!matchDetails) return;
    const matchId = normalizeMatchId(matchDetails.id);
    if (matchId === null) return;
    let updated = false;
    matchesCache = Array.isArray(matchesCache) ? matchesCache.map(match => {
        if (normalizeMatchId(match.id) === matchId) {
            updated = true;
            return { ...match, ...matchDetails };
        }
        return match;
    }) : [];
    if (!updated) {
        matchesCache.push({ ...matchDetails });
    }
}

function autoSelectLiveMatch() {
    if (!Array.isArray(matchesCache) || !matchesCache.length) return false;
    const liveMatch = matchesCache.find(match => String(match.status).toLowerCase() === 'live');
    if (!liveMatch) return false;
    const liveMatchId = normalizeMatchId(liveMatch.id);
    if (liveMatchId === null) return false;
    const currentMatch = matchesCache.find(match => normalizeMatchId(match.id) === currentMatchId) || null;
    const currentIsLive = currentMatch && String(currentMatch.status).toLowerCase() === 'live';
    if (!currentIsLive || currentMatchId !== liveMatchId) {
        currentMatchId = liveMatchId;
        return true;
    }
    return false;
}

function stopLiveAutoRefresh() {
    if (liveMatchAutoRefreshInterval) {
        clearInterval(liveMatchAutoRefreshInterval);
        liveMatchAutoRefreshInterval = null;
    }
}

function startLiveAutoRefresh() {
    if (liveMatchAutoRefreshInterval || !currentMatchId || currentView !== 'live') {
        return;
    }
    liveMatchAutoRefreshInterval = setInterval(() => {
        if (currentView !== 'live' || !currentMatchId) {
            return;
        }
        loadLiveMatch();
    }, LIVE_MATCH_REFRESH_INTERVAL_MS);
}

function restartLiveAutoRefresh() {
    stopLiveAutoRefresh();
    if (!currentMatchId) return;
    startLiveAutoRefresh();
}

function refreshMatchesCacheSilently() {
    return fetch('ajax.php?action=get_matches')
        .then(r => r.json())
        .then(data => {
            matchesCache = Array.isArray(data.matches) ? data.matches : [];
            return matchesCache;
        })
        .catch(() => {
            matchesCache = [];
            return matchesCache;
        });
}

// Funcții pentru titlu aplicație
function getStoredAppTitle() {
    try {
        const storedTitle = localStorage.getItem(APP_TITLE_STORAGE_KEY);
        if (storedTitle && storedTitle.trim()) {
            return storedTitle.trim();
        }
    } catch (error) {
        console.warn('Nu am putut accesa titlul salvat:', error);
    }
    return DEFAULT_APP_TITLE;
}

function applyAppTitle(title) {
    const sanitizedTitle = title && title.trim() ? title.trim() : DEFAULT_APP_TITLE;
    const heading = document.getElementById('app-title');
    if (heading) {
        heading.textContent = sanitizedTitle;
    }
    document.title = sanitizedTitle;
}

function initializeAppTitle() {
    const storedTitle = getStoredAppTitle();
    applyAppTitle(storedTitle);
    const input = document.getElementById('app-title-input');
    if (input) {
        input.value = storedTitle;
    }
}

function saveAppTitle() {
    const input = document.getElementById('app-title-input');
    if (!input) return;
    const value = input.value.trim();
    const finalTitle = value || DEFAULT_APP_TITLE;
    try {
        localStorage.setItem(APP_TITLE_STORAGE_KEY, finalTitle);
    } catch (error) {
        console.warn('Nu am putut salva titlul:', error);
    }
    applyAppTitle(finalTitle);
    input.value = finalTitle;
    showAppTitleFeedback('Titlul a fost salvat!');
}

function showAppTitleFeedback(message) {
    const feedback = document.getElementById('app-title-feedback');
    if (!feedback) return;
    feedback.textContent = message;
    feedback.classList.add('visible');
    setTimeout(() => {
        feedback.textContent = '';
        feedback.classList.remove('visible');
    }, 2500);
}

// Autentificare
function setAuthPanelState(shouldOpen) {
    if (!authPanel || !authToggleButton) return;
    const open = typeof shouldOpen === 'boolean' ? shouldOpen : !authPanel.classList.contains('open');
    authPanel.classList.toggle('open', open);
    authPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
    authToggleButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
        const usernameInput = authPanel.querySelector('#login-username');
        if (usernameInput) {
            try {
                usernameInput.focus({ preventScroll: true });
            } catch (error) {
                usernameInput.focus();
            }
        }
    }
}

function setupAuthDropdown() {
    if (authDropdownInitialized) return;
    authPanel = document.getElementById('auth-panel');
    authToggleButton = document.getElementById('auth-toggle');
    if (!authPanel || !authToggleButton) return;
    authDropdownInitialized = true;

    authToggleButton.addEventListener('click', event => {
        event.preventDefault();
        setAuthPanelState();
    });

    document.addEventListener('click', event => {
        if (!authPanel.classList.contains('open')) return;
        if (authPanel.contains(event.target) || authToggleButton.contains(event.target)) return;
        setAuthPanelState(false);
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && authPanel.classList.contains('open')) {
            setAuthPanelState(false);
        }
    });
}

function showLoginFeedback(message, type = 'error') {
    const feedback = document.getElementById('login-feedback');
    if (!feedback) return;
    setAuthPanelState(true);
    feedback.textContent = message;
    feedback.classList.remove('auth-feedback-error', 'auth-feedback-success', 'visible');
    if (message) {
        const className = type === 'success' ? 'auth-feedback-success' : 'auth-feedback-error';
        feedback.classList.add(className, 'visible');
    }
}

function showPasswordChangeFeedback(message, type = 'error') {
    const feedback = document.getElementById('password-change-feedback');
    if (!feedback) return;
    feedback.textContent = message;
    feedback.classList.remove('auth-feedback-error', 'auth-feedback-success', 'visible');
    if (message) {
        const className = type === 'success' ? 'auth-feedback-success' : 'auth-feedback-error';
        feedback.classList.add(className, 'visible');
    }
}

function handleLoginSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    formData.append('action', 'login');
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    setAuthPanelState(true);
    showLoginFeedback('Se verifică datele...', 'success');

    fetch('ajax.php', { method: 'POST', body: formData })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                showLoginFeedback('Autentificare reușită. Se reîncarcă...', 'success');
                window.location.reload();
                return;
            }
            if (submitButton) submitButton.disabled = false;
            showLoginFeedback(data.message || 'Autentificarea a eșuat.');
        })
        .catch(() => {
            if (submitButton) submitButton.disabled = false;
            showLoginFeedback('Nu am putut realiza autentificarea.');
        });
}

function handleLogout(event) {
    event.preventDefault();
    const formData = new FormData();
    formData.append('action', 'logout');
    fetch('ajax.php', { method: 'POST', body: formData })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                window.location.reload();
                return;
            }
            alert(data.message || 'Nu am putut realiza deconectarea.');
        })
        .catch(() => alert('Nu am putut realiza deconectarea.'));
}

function handlePasswordChangeSubmit(event) {
    event.preventDefault();
    if (!ensureAdminClient()) return;

    const form = event.target;
    const formData = new FormData(form);
    const currentPassword = (formData.get('current_password') || '').toString();
    const newPassword = (formData.get('new_password') || '').toString();
    const confirmPassword = (formData.get('confirm_password') || '').toString();
    const submitButton = form.querySelector('button[type="submit"]');

    if (submitButton) submitButton.disabled = true;

    if (!currentPassword || !newPassword || !confirmPassword) {
        showPasswordChangeFeedback('Completează toate câmpurile.');
        if (submitButton) submitButton.disabled = false;
        return;
    }

    if (newPassword.length < 8) {
        showPasswordChangeFeedback('Parola nouă trebuie să aibă cel puțin 8 caractere.');
        if (submitButton) submitButton.disabled = false;
        return;
    }

    if (newPassword !== confirmPassword) {
        showPasswordChangeFeedback('Confirmarea parolei nu corespunde.');
        if (submitButton) submitButton.disabled = false;
        return;
    }

    formData.append('action', 'change_password');
    showPasswordChangeFeedback('Se actualizează parola...', 'success');

    fetch('ajax.php', { method: 'POST', body: formData })
        .then(r => r.json())
        .then(data => {
            if (handleUnauthorizedResponse(data)) return;
            if (data.success) {
                showPasswordChangeFeedback(data.message || 'Parola a fost actualizată.', 'success');
                form.reset();
                return;
            }
            showPasswordChangeFeedback(data.message || 'Nu am putut actualiza parola.');
        })
        .catch(() => {
            showPasswordChangeFeedback('Nu am putut actualiza parola.');
        })
        .finally(() => {
            if (submitButton) submitButton.disabled = false;
        });
}

// Timere
function stopLiveTimers() {
    if (liveTimerInterval) {
        clearInterval(liveTimerInterval);
        liveTimerInterval = null;
    }
}

function parseDateTime(value) {
    if (!value) return null;
    const normalized = value.replace(' ', 'T');
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatDuration(totalSeconds) {
    if (totalSeconds == null || !Number.isFinite(totalSeconds) || totalSeconds < 0) return '--:--';
    const seconds = Math.floor(totalSeconds);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function updateLiveTimers() {
    document.querySelectorAll('[data-duration-start]').forEach(node => {
        const start = parseDateTime(node.dataset.durationStart || '');
        let end = parseDateTime(node.dataset.durationEnd || '');
        const isLive = node.dataset.durationLive === 'true';
        if (isLive) end = new Date();
        if (!start || !end) {
            node.textContent = '⏱️ --:--';
            return;
        }
        const diffSeconds = Math.max(0, (end.getTime() - start.getTime()) / 1000);
        node.textContent = `⏱️ ${formatDuration(diffSeconds)}`;
    });
}

function scheduleLiveTimers(isCompleted) {
    stopLiveTimers();
    updateLiveTimers();
    if (!isCompleted) {
        liveTimerInterval = setInterval(updateLiveTimers, 1000);
    }
}

function buildDurationInfo(startValue, endValue, shouldRun) {
    const start = parseDateTime(startValue || '');
    let end = parseDateTime(endValue || '');
    let isLive = Boolean(shouldRun && start);
    if (!start) isLive = false;
    if (isLive) end = new Date();
    let display = '--:--';
    if (start && (end || isLive)) {
        const diffSeconds = Math.max(0, ((isLive ? Date.now() : end.getTime()) - start.getTime()) / 1000);
        display = formatDuration(diffSeconds);
    }
    return {
        start: start && startValue ? startValue : '',
        end: !isLive && end && endValue ? endValue : '',
        live: isLive,
        display
    };
}

function durationAttributes(info) {
    return `data-duration-start="${info.start}" data-duration-end="${info.end}" data-duration-live="${info.live ? 'true' : 'false'}"`;
}

// Inițializare
document.addEventListener('DOMContentLoaded', () => {
    initializeAppTitle();
    setupAuthDropdown();

    const titleInput = document.getElementById('app-title-input');
    if (titleInput) {
        titleInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveAppTitle();
            }
        });
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
    }

    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }

    const passwordForm = document.getElementById('password-change-form');
    if (passwordForm) {
        passwordForm.addEventListener('submit', handlePasswordChangeSubmit);
    }

    // Încarcă datele inițiale
    loadTeams();
    loadMatches();
    if (isAdminUser) {
        loadAdminMatches();
    }
});

// Navigare
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        switchView(this.dataset.view);
    });
});

document.querySelectorAll('.mobile-quick-action').forEach(btn => {
    btn.addEventListener('click', function() {
        switchView(this.dataset.view);
    });
});

function switchView(view) {
    currentView = view;
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === view) {
            btn.classList.add('active');
        }
    });
    document.querySelectorAll('.mobile-quick-action').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('active');
    });
    const targetView = document.getElementById('view-' + view);
    if (targetView) {
        targetView.classList.add('active');
    }
    if (view !== 'live') {
        stopLiveTimers();
        stopLiveAutoRefresh();
        manualLiveSelectionActive = false;
    }
    if (view === 'matches') loadMatches();
    if (view === 'standings') loadStandings();
    if (view === 'stats') loadStats();
    if (view === 'live') {
        if (pendingLiveMatchId !== null) {
            const normalized = updateCurrentMatchId(pendingLiveMatchId);
            manualLiveSelectionActive = normalized !== null;
            pendingLiveMatchId = null;
        } else if (!manualLiveSelectionActive) {
            const selected = autoSelectLiveMatch();
            if (!selected && (!Array.isArray(matchesCache) || matchesCache.length === 0)) {
                loadMatches();
            }
        }
        loadLiveMatch();
        restartLiveAutoRefresh();
    }
    if (view === 'admin' && isAdminUser) {
        loadTeams();
        loadAdminMatches();
    }
}

function ensureAdminClient() {
    if (isAdminUser) return true;
    alert('Această acțiune este disponibilă doar administratorilor.');
    return false;
}

function handleUnauthorizedResponse(data) {
    if (data && data.error === 'unauthorized') {
        alert(data.message || 'Această acțiune necesită autentificare.');
        return true;
    }
    return false;
}

// Echipe
function loadTeams() {
    fetch('ajax.php?action=get_teams')
        .then(r => r.json())
        .then(data => {
            const teams = Array.isArray(data.teams) ? data.teams : [];
            const countElement = document.getElementById('team-count');
            if (countElement) countElement.textContent = teams.length;
            const container = document.getElementById('teams-list');
            if (!container) return;
            if (teams.length === 0) {
                container.innerHTML = '<p class="text-center" style="color: #6b7280;">Nu există echipe înregistrate.</p>';
                return;
            }
            container.innerHTML = teams.map(team => `
                <div class="team-item">
                    <span><strong>${team.name}</strong></span>
                    <button onclick="deleteTeam(${team.id})">🗑️</button>
                </div>
            `).join('');
        });
}

function addTeam() {
    if (!ensureAdminClient()) return;
    const input = document.getElementById('team-name');
    if (!input) return;
    const name = input.value.trim();
    if (!name) {
        alert('Introdu numele echipei!');
        return;
    }
    const formData = new FormData();
    formData.append('action', 'add_team');
    formData.append('name', name);
    fetch('ajax.php', { method: 'POST', body: formData })
        .then(r => r.json())
        .then(data => {
            if (handleUnauthorizedResponse(data)) return;
            if (data.success) {
                input.value = '';
                loadTeams();
                loadAdminMatches();
            }
            if (!data.success && data.message) alert(data.message);
        });
}

function deleteTeam(id) {
    if (!ensureAdminClient()) return;
    if (!confirm('Sigur vrei să ștergi această echipă?')) return;
    const formData = new FormData();
    formData.append('action', 'delete_team');
    formData.append('id', id);
    fetch('ajax.php', { method: 'POST', body: formData })
        .then(r => r.json())
        .then(data => {
            if (handleUnauthorizedResponse(data)) return;
            if (data.success) {
                loadTeams();
                loadMatches();
                loadAdminMatches();
                if (currentView === 'standings') loadStandings();
                if (currentView === 'stats') loadStats();
            }
            if (!data.success && data.message) alert(data.message);
        });
}

function generateMatches() {
    if (!ensureAdminClient()) return;
    const selectedFormat = document.querySelector('input[name="format"]:checked');
    const format = selectedFormat ? selectedFormat.value : '3';
    if (!confirm('Generează meciurile? Meciurile existente vor fi șterse!')) return;
    const formData = new FormData();
    formData.append('action', 'generate_matches');
    formData.append('format', format);
    fetch('ajax.php', { method: 'POST', body: formData })
        .then(r => r.json())
        .then(data => {
            if (handleUnauthorizedResponse(data)) return;
            if (!data.success) {
                alert(data.message || 'Eroare la generarea meciurilor.');
                return;
            }
            let message = 'Meciuri generate cu succes!';
            if (data.warning) message += `\n\n${data.warning}`;
            alert(message);
            loadMatches();
            loadAdminMatches();
            switchView('matches');
        });
}

// Meciuri
function loadMatches() {
    return fetch('ajax.php?action=get_matches')
        .then(r => r.json())
        .then(data => {
            const container = document.getElementById('matches-list');
            if (!container) return;
            const matches = Array.isArray(data.matches) ? data.matches : [];
            matchesCache = matches;
            if (matches.length === 0) {
                container.innerHTML = '<p class="text-center">Nu există meciuri generate.</p>';
                return;
            }
            container.innerHTML = matches.map((match) => {
                const statusBadge = match.status === 'completed' 
                    ? '<span class="match-status match-status-completed">Finalizat</span>'
                    : match.status === 'live' 
                        ? '<span class="match-status match-status-live">În desfășurare</span>'
                        : '<span class="match-status match-status-pending">Programat</span>';
                const winnerInfo = match.status === 'completed' 
                    ? `<div class="winner">Câștigător: ${match.winner_name} (${match.sets_team1}-${match.sets_team2})</div>`
                    : '';
                return `
                <div class="match-item ${match.status}">
                    <div class="match-header">
                        <div class="match-info">
                            <div class="match-meta">
                                <span class="match-number">Meci #${match.match_order}</span>
                                ${statusBadge}
                            </div>
                            <h3>${match.team1_name} vs ${match.team2_name}</h3>
                            ${winnerInfo}
                        </div>
                        <div class="match-actions">
                            <button class="btn btn-secondary" onclick="viewMatchStats(${match.id})">📊 Detalii</button>
                        </div>
                    </div>
                </div>
                `;
            }).join('');
            if (currentView === 'live' && !manualLiveSelectionActive) {
                const changed = autoSelectLiveMatch();
                if (changed) {
                    loadLiveMatch();
                    restartLiveAutoRefresh();
                }
            }
        })
        .catch(() => {
            matchesCache = [];
        });
}

function loadAdminMatches() {
    if (!isAdminUser) return;
    fetch('ajax.php?action=get_matches')
        .then(r => r.json())
        .then(data => {
            const container = document.getElementById('admin-matches-list');
            if (!container) return;
            const matches = Array.isArray(data.matches) ? data.matches : [];
            if (matches.length === 0) {
                container.innerHTML = '<p class="text-center">Nu există meciuri generate.</p>';
                return;
            }
            container.innerHTML = matches.map((match, idx) => {
                const statusText = match.status === 'completed' 
                    ? `Finalizat - ${match.winner_name} (${match.sets_team1}-${match.sets_team2})`
                    : match.status === 'live' ? 'În desfășurare' : 'Programat';
                const reorderControls = match.status === 'pending' ? `
                    <div class="match-controls">
                        ${idx > 0 ? `<button onclick="moveMatch(${match.id}, ${match.match_order - 1})" class="btn btn-secondary" style="padding: 8px 12px;">⬆️</button>` : ''}
                        ${idx < matches.length - 1 ? `<button onclick="moveMatch(${match.id}, ${match.match_order + 1})" class="btn btn-secondary" style="padding: 8px 12px;">⬇️</button>` : ''}
                    </div>
                ` : '';
                const actionButton = match.status === 'pending'
                    ? `<button class="btn btn-success" onclick="startMatchAdmin(${match.id})">▶️ Pornește</button>`
                    : match.status === 'live'
                        ? `<button class="btn btn-primary" onclick="controlLiveMatch(${match.id})">⚡ Control Live</button>`
                        : '';
                return `
                <div class="admin-match-item ${match.status}">
                    <div class="admin-match-info">
                        <h4>Meci #${match.match_order}: ${match.team1_name} vs ${match.team2_name}</h4>
                        <p>${statusText}</p>
                    </div>
                    <div class="admin-match-actions">
                        ${reorderControls}
                        ${actionButton}
                    </div>
                </div>
                `;
            }).join('');
        });
}

function moveMatch(matchId, newOrder) {
    if (!ensureAdminClient()) return;
    const formData = new FormData();
    formData.append('action', 'update_match_order');
    formData.append('match_id', matchId);
    formData.append('new_order', newOrder);
    fetch('ajax.php', { method: 'POST', body: formData })
        .then(r => r.json())
        .then(data => {
            if (handleUnauthorizedResponse(data)) return;
            if (data.success) {
                loadMatches();
                loadAdminMatches();
            }
        });
}

function startMatchAdmin(matchId) {
    if (!ensureAdminClient()) return;
    const normalizedId = updateCurrentMatchId(matchId);
    const formData = new FormData();
    formData.append('action', 'start_match');
    if (normalizedId !== null) {
        formData.append('match_id', normalizedId);
    } else {
        formData.append('match_id', matchId);
    }
    fetch('ajax.php', { method: 'POST', body: formData })
        .then(r => r.json())
        .then(data => {
            if (handleUnauthorizedResponse(data)) return;
            if (!data.success) {
                alert(data.message || 'Nu am putut porni meciul.');
                return;
            }
            loadAdminMatches();
            loadMatches();
            if (normalizedId !== null) {
                controlLiveMatch(normalizedId);
            }
        });
}

function buildPointsTimelineSection(match, sets = [], points = [], options = {}) {
    if (!match) return '';

    const {
        isCompleted: forcedCompleted,
        currentSetNumber: forcedCurrentSet,
        highlightLiveSet = true,
        emptyMessage = 'Nu există date pentru acest meci.',
        headingTag = 'h3',
        additionalClasses = '',
        showLegend = true
    } = options;

    const isCompleted = typeof forcedCompleted === 'boolean'
        ? forcedCompleted
        : match.status === 'completed';
    const completedSetsCount = Number(match.sets_team1) + Number(match.sets_team2);
    const activeSetNumber = typeof forcedCurrentSet === 'number' && Number.isFinite(forcedCurrentSet)
        ? forcedCurrentSet
        : (isCompleted ? Math.max(completedSetsCount, 1) : completedSetsCount + 1);

    const setsArray = Array.isArray(sets) ? sets : [];
    const pointsArray = Array.isArray(points) ? points : [];

    const pointsBySet = pointsArray.reduce((acc, point) => {
        const setNumber = Number(point.set_number);
        if (!Number.isFinite(setNumber)) {
            return acc;
        }
        if (!acc[setNumber]) {
            acc[setNumber] = [];
        }
        acc[setNumber].push(point);
        return acc;
    }, {});

    const setNumbers = Array.from(new Set([
        ...setsArray.map(set => Number(set.set_number)),
        ...Object.keys(pointsBySet).map(Number),
        !isCompleted ? activeSetNumber : null
    ].filter(value => Number.isFinite(value) && value > 0))).sort((a, b) => a - b);

    const timelineSetsMarkup = setNumbers.length ? setNumbers.map(setNumber => {
        const setDetails = setsArray.find(set => Number(set.set_number) === setNumber) || null;
        const setPoints = (pointsBySet[setNumber] || []).slice().sort((a, b) => Number(a.point_number) - Number(b.point_number));
        const highlightActive = highlightLiveSet && !isCompleted && setNumber === activeSetNumber;
        const totalPoints = setPoints.length;
        const latestIndex = totalPoints - 1;
        const setStartTime = setPoints[0]?.created_at || '';
        const setEndTime = totalPoints ? setPoints[totalPoints - 1].created_at : '';
        const durationInfo = buildDurationInfo(setStartTime, setEndTime, highlightActive && totalPoints > 0);
        const durationAttrs = durationAttributes(durationInfo);
        const durationText = `⏱️ ${durationInfo.display}`;
        const displayScoreTeam1 = Number(setDetails?.score_team1 ?? (setPoints[latestIndex]?.score_team1 ?? 0));
        const displayScoreTeam2 = Number(setDetails?.score_team2 ?? (setPoints[latestIndex]?.score_team2 ?? 0));

        if (!totalPoints) {
            return `
                <div class="set-timeline ${highlightActive ? 'set-timeline-live' : ''}">
                    <div class="set-timeline-header">
                        <span class="set-title">Set ${setNumber}</span>
                        <div class="set-score">${displayScoreTeam1}<span>-</span>${displayScoreTeam2}</div>
                        <span class="set-duration" ${durationAttrs}>⏱️ --:--</span>
                    </div>
                    <p class="timeline-empty">Încă nu s-au marcat puncte în acest set.</p>
                </div>
            `;
        }

        const sequenceBadges = setPoints.map((point, idx) => {
            const scorerClass = point.scorer === 'team1' ? 'team1' : 'team2';
            const badgeClasses = ['point-badge', scorerClass];
            if (highlightActive && idx === latestIndex) {
                badgeClasses.push('latest');
            }
            const displayScoreTeam1Point = Number(point.score_team1 || 0);
            const displayScoreTeam2Point = Number(point.score_team2 || 0);
            const scoreLabel = `${displayScoreTeam1Point}-${displayScoreTeam2Point}`;
            const tooltip = `${match.team1_name} ${displayScoreTeam1Point} - ${match.team2_name} ${displayScoreTeam2Point}`;
            return `<span class="${badgeClasses.join(' ')}" title="${tooltip}">${scoreLabel}</span>`;
        }).join('');

        return `
            <div class="set-timeline ${highlightActive ? 'set-timeline-live' : ''}">
                <div class="set-timeline-header">
                    <span class="set-title">Set ${setNumber}</span>
                    <div class="set-score">${displayScoreTeam1}<span>-</span>${displayScoreTeam2}</div>
                    <span class="set-duration" ${durationAttrs}>${durationText}</span>
                </div>
                <div class="timeline-team-info">
                    <span class="team-label"><span class="team-dot team1"></span>${match.team1_name}</span>
                    <span class="team-label"><span class="team-dot team2"></span>${match.team2_name}</span>
                </div>
                <div class="timeline-sequence">${sequenceBadges}</div>
            </div>
        `;
    }).join('') : '';

    const legendMarkup = showLegend && timelineSetsMarkup
        ? `
            <div class="timeline-legend" aria-label="Legendă culori echipe">
                <span class="legend-item"><span class="legend-dot team1"></span>${match.team1_name}</span>
                <span class="legend-item"><span class="legend-dot team2"></span>${match.team2_name}</span>
            </div>
        `
        : '';

    const content = timelineSetsMarkup
        ? `
            <div class="points-timeline-content">
                ${legendMarkup}
                <div class="timeline-sets">${timelineSetsMarkup}</div>
            </div>
        `
        : `<p class="timeline-empty">${emptyMessage}</p>`;

    const heading = typeof headingTag === 'string' && /^h[1-6]$/i.test(headingTag)
        ? headingTag.toLowerCase()
        : 'h3';

    const wrapperClasses = ['points-timeline'];
    if (!isCompleted && highlightLiveSet) {
        wrapperClasses.push('live');
    }
    if (additionalClasses) {
        wrapperClasses.push(additionalClasses);
    }

    return `
        <div class="${wrapperClasses.join(' ')}">
            <${heading}>Istoric puncte detaliat</${heading}>
            ${content}
        </div>
    `;
}

function controlLiveMatch(matchId) {
    if (!ensureAdminClient()) return;
    const normalizedId = updateCurrentMatchId(matchId);
    if (normalizedId === null) return;
    fetch(`ajax.php?action=get_match_details&match_id=${normalizedId}`)
        .then(r => r.json())
        .then(data => {
            if (!data.match) {
                alert('Meciul nu a fost găsit.');
                return;
            }
            const liveSection = document.getElementById('admin-live-section');
            const liveControls = document.getElementById('admin-live-controls');
            if (!liveSection || !liveControls) return;
            liveSection.style.display = 'block';
            const match = data.match;
            const sets = data.sets || [];
            const points = data.points || [];
            const isCompletedMatch = match.status === 'completed';
            const completedSetsCount = Number(match.sets_team1) + Number(match.sets_team2);
            const currentSetNumber = isCompletedMatch
                ? Math.max(completedSetsCount, 1)
                : completedSetsCount + 1;
            const currentSetData = sets.find(set => Number(set.set_number) === currentSetNumber) || {
                score_team1: 0, score_team2: 0
            };
            const currentPointsTeam1 = Number(currentSetData.score_team1) || 0;
            const currentPointsTeam2 = Number(currentSetData.score_team2) || 0;
            const timelineSection = buildPointsTimelineSection(match, sets, points, {
                isCompleted: isCompletedMatch,
                currentSetNumber,
                additionalClasses: 'admin-live-timeline',
                emptyMessage: 'Nu există puncte înregistrate pentru acest meci.'
            });
            const statusLine = isCompletedMatch
                ? `Meci finalizat · Seturi: ${match.sets_team1}-${match.sets_team2}`
                : `Set curent: ${currentSetNumber} | Seturi: ${match.sets_team1}-${match.sets_team2}`;
            liveControls.innerHTML = `
                <div class="admin-live-scoreboard">
                    <h4 style="text-align: center; margin-bottom: 20px;">${match.team1_name} vs ${match.team2_name}</h4>
                    <p style="text-align: center; margin-bottom: 20px;">${statusLine}</p>
                    <div class="admin-live-teams">
                        <div class="admin-live-team">
                            <h4>${match.team1_name}</h4>
                            <div class="admin-live-score">${currentPointsTeam1}</div>
                            <button class="btn btn-primary btn-full" onclick="addPointLive('team1')">+ Punct</button>
                        </div>
                        <div class="admin-live-team">
                            <h4>${match.team2_name}</h4>
                            <div class="admin-live-score">${currentPointsTeam2}</div>
                            <button class="btn btn-danger btn-full" onclick="addPointLive('team2')">+ Punct</button>
                        </div>
                    </div>
                    ${points.length > 0 ? `
                        <div style="text-align: center; margin-top: 20px;">
                            <button class="btn btn-warning" onclick="removeLastPoint()">↩️ Anulează ultimul punct</button>
                        </div>
                    ` : ''}
                </div>
                ${timelineSection}
                <div style="text-align: center; margin-top: 16px;">
                    <button class="btn btn-secondary" onclick="viewMatchStats(${normalizedId})">📊 Vezi detalii complete</button>
                </div>
            `;
            scheduleLiveTimers(isCompletedMatch);
            liveSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
}

function viewMatchStats(matchId) {
    const normalized = updateCurrentMatchId(matchId);
    if (normalized === null) return;
    pendingLiveMatchId = normalized;
    manualLiveSelectionActive = true;
    switchView('live');
}

function loadLiveMatch() {
    const container = document.getElementById('live-match-container');
    if (!container) return;
    if (!currentMatchId) {
        stopLiveTimers();
        stopLiveAutoRefresh();
        container.innerHTML = '<p class="text-center">Selectează un meci din lista de meciuri pentru a urmări</p>';
        return;
    }
    fetch(`ajax.php?action=get_match_details&match_id=${currentMatchId}`)
        .then(r => r.json())
        .then(data => {
            if (!data.match) {
                stopLiveTimers();
                stopLiveAutoRefresh();
                container.innerHTML = '<p class="text-center">Meciul nu a fost găsit.</p>';
                return;
            }
            renderLiveMatch(data);
        });
}

function getAdaptiveTeamNameClass(name) {
    if (!name) return '';
    const trimmed = name.trim();
    const length = trimmed.length;
    if (length > 28) return 'team-name--xsmall';
    if (length > 20) return 'team-name--small';
    if (length > 14) return 'team-name--medium';
    return '';
}

function renderLiveMatch(data) {
    const { match, sets = [], points = [] } = data;
    const container = document.getElementById('live-match-container');
    if (!container) return;
    updateMatchesCacheWithMatch(match);
    const isCompleted = match.status === 'completed';
    const completedSetsCount = Number(match.sets_team1) + Number(match.sets_team2);
    const currentSetNumber = isCompleted ? Math.max(completedSetsCount, 1) : completedSetsCount + 1;
    const currentSetData = sets.find(set => Number(set.set_number) === currentSetNumber) || {
        set_number: currentSetNumber, score_team1: 0, score_team2: 0, winner: null
    };
    const setsToWin = Math.ceil(match.match_format / 2);
    const statusText = isCompleted
        ? `Meci finalizat. Scor seturi: ${match.sets_team1}-${match.sets_team2}`
        : `Set curent: ${currentSetNumber} · Seturi câștigate: ${match.sets_team1}-${match.sets_team2}`;
    const currentPointsTeam1 = Number(currentSetData.score_team1) || 0;
    const currentPointsTeam2 = Number(currentSetData.score_team2) || 0;
    const sortedSets = [...sets].sort((a, b) => Number(a.set_number) - Number(b.set_number));
    let setsRows = sortedSets.map(set => `
        <tr class="${set.winner ? 'set-complete' : (Number(set.set_number) === currentSetNumber && !isCompleted ? 'set-current' : '')}">
            <td>Set ${set.set_number}</td>
            <td>${set.score_team1}</td>
            <td>${set.score_team2}</td>
            <td>${set.winner ? (set.winner === 'team1' ? match.team1_name : match.team2_name) : (Number(set.set_number) === currentSetNumber && !isCompleted ? 'În desfășurare' : '-')}</td>
        </tr>
    `).join('');
    if (!isCompleted && !sortedSets.some(set => Number(set.set_number) === currentSetNumber)) {
        setsRows += `<tr class="set-current"><td>Set ${currentSetNumber}</td><td>0</td><td>0</td><td>În așteptare</td></tr>`;
    }
    if (!setsRows) {
        setsRows = `<tr class="set-current"><td>Set 1</td><td>0</td><td>0</td><td>În așteptare</td></tr>`;
    }
    const winnerId = match.winner_id ? Number(match.winner_id) : null;
    const team1Winner = isCompleted && winnerId && winnerId === Number(match.team1_id);
    const team2Winner = isCompleted && winnerId && winnerId === Number(match.team2_id);
    const pointsLabel = isCompleted ? 'Puncte în ultimul set' : `Puncte în setul ${currentSetNumber}`;
    const team1WinnerTag = team1Winner ? '<span class="winner-tag">Câștigător</span>' : '';
    const team2WinnerTag = team2Winner ? '<span class="winner-tag">Câștigător</span>' : '';
    const matchDurationInfo = buildDurationInfo(
        points[0]?.created_at || '',
        points.length ? points[points.length - 1].created_at : '',
        !isCompleted && points.length > 0
    );
    const matchDurationAttrs = durationAttributes(matchDurationInfo);
    const matchDurationText = `⏱️ ${matchDurationInfo.display}`;
    const secondaryMetaLabel = isCompleted ? 'Seturi jucate' : 'Set curent';
    const secondaryMetaValue = isCompleted ? completedSetsCount : currentSetNumber;
    const timelineSection = buildPointsTimelineSection(match, sets, points, {
        isCompleted,
        currentSetNumber,
        emptyMessage: 'Nu există date pentru acest meci.'
    });
    const team1NameClass = getAdaptiveTeamNameClass(match.team1_name);
    const team2NameClass = getAdaptiveTeamNameClass(match.team2_name);
    const scoreboard = `
        <div class="scoreboard">
            <div class="scoreboard-header">
                <div class="scoreboard-title">
                    <h2>${match.team1_name} vs ${match.team2_name}</h2>
                    <p>${statusText}</p>
                    <span class="scoreboard-subtitle">Primul la ${setsToWin} seturi câștigate</span>
                </div>
                <div class="scoreboard-sets">
                    <div class="set-counter team1">
                        <span class="set-label">Seturi ${match.team1_name}</span>
                        <span class="set-value">${match.sets_team1}</span>
                    </div>
                    <div class="set-counter team2">
                        <span class="set-label">Seturi ${match.team2_name}</span>
                        <span class="set-value">${match.sets_team2}</span>
                    </div>
                </div>
            </div>
            <div class="scoreboard-main">
                <div class="team-card team1 ${team1Winner ? 'winner' : ''}">
                    ${team1WinnerTag}
                    <div class="team-name ${team1NameClass}">${match.team1_name}</div>
                    <div class="team-points">${currentPointsTeam1}</div>
                    <div class="team-meta">${pointsLabel}</div>
                </div>
                <div class="team-card team2 ${team2Winner ? 'winner' : ''}">
                    ${team2WinnerTag}
                    <div class="team-name ${team2NameClass}">${match.team2_name}</div>
                    <div class="team-points">${currentPointsTeam2}</div>
                    <div class="team-meta">${pointsLabel}</div>
                </div>
            </div>
            <div class="scoreboard-meta">
                <div class="meta-item">
                    <span class="meta-label">Durată meci</span>
                    <span class="meta-value" id="match-duration" ${matchDurationAttrs}>${matchDurationText}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-label">${secondaryMetaLabel}</span>
                    <span class="meta-value">${secondaryMetaValue}</span>
                </div>
            </div>
        </div>
    `;
    container.innerHTML = `
        ${scoreboard}
        ${isCompleted ? `<div class="winner-banner">Câștigător: <strong>${match.winner_name}</strong></div>` : ''}
        <div class="sets-table">
            <h3>Scor pe seturi</h3>
            <table>
                <thead>
                    <tr>
                        <th>Set</th>
                        <th>${match.team1_name}</th>
                        <th>${match.team2_name}</th>
                        <th>Câștigător</th>
                    </tr>
                </thead>
                <tbody>
                    ${setsRows}
                </tbody>
            </table>
        </div>
        ${timelineSection}
    `;
    scheduleLiveTimers(isCompleted);
    if (isCompleted) {
        stopLiveAutoRefresh();
        if (!manualLiveSelectionActive) {
            refreshMatchesCacheSilently().then(() => {
                if (currentView !== 'live') return;
                const changed = autoSelectLiveMatch();
                if (changed) {
                    loadLiveMatch();
                    restartLiveAutoRefresh();
                }
            });
        }
    } else {
        startLiveAutoRefresh();
    }
}

function addPointLive(teamKey) {
    if (!ensureAdminClient()) return;
    if (!currentMatchId) return;
    const formData = new FormData();
    formData.append('action', 'add_point');
    formData.append('match_id', currentMatchId);
    formData.append('scorer', teamKey);
    fetch('ajax.php', { method: 'POST', body: formData })
        .then(r => r.json())
        .then(data => {
            if (handleUnauthorizedResponse(data)) return;
            if (!data.success) {
                alert(data.message || 'Nu am putut adăuga punctul.');
                return;
            }
            controlLiveMatch(currentMatchId);
            loadMatches();
            loadAdminMatches();
            if (currentView === 'live') loadLiveMatch();
            if (currentView === 'standings') loadStandings();
            if (currentView === 'stats') loadStats();
        });
}

function removeLastPoint() {
    if (!ensureAdminClient()) return;
    if (!currentMatchId) return;
    if (!confirm('Ești sigur că vrei să anulezi ultimul punct înregistrat?')) return;
    const formData = new FormData();
    formData.append('action', 'remove_last_point');
    formData.append('match_id', currentMatchId);
    fetch('ajax.php', { method: 'POST', body: formData })
        .then(r => r.json())
        .then(data => {
            if (handleUnauthorizedResponse(data)) return;
            if (!data.success) {
                alert(data.message || 'Nu am putut șterge ultimul punct.');
                return;
            }
            controlLiveMatch(currentMatchId);
            loadMatches();
            loadAdminMatches();
            if (currentView === 'live') loadLiveMatch();
        });
}

function loadStandings() {
    fetch('ajax.php?action=get_teams')
        .then(r => r.json())
        .then(data => {
            const container = document.getElementById('standings-table');
            if (!container) return;
            const rawTeams = Array.isArray(data.teams) ? data.teams : [];
            if (!rawTeams.length) {
                lastStandings = [];
                container.innerHTML = '<p class="text-center">Nu există echipe înregistrate.</p>';
                return;
            }
            const processedTeams = rawTeams.map(computeStandingsMetrics);
            const orderedTeams = sortTeamsForStandings(processedTeams);
            lastStandings = orderedTeams;
            container.innerHTML = `
                <div class="standings-table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Echipă</th>
                                <th>Puncte Clasament</th>
                                <th>Victorii</th>
                                <th>Înfrângeri</th>
                                <th>Seturi (+/-)</th>
                                <th>Raport Seturi</th>
                                <th>Puncte (+/-)</th>
                                <th>Raport Puncte</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${orderedTeams.map((team, idx) => {
                                const rank = idx + 1;
                                const medalClass = rank === 1 ? 'standings-gold' : rank === 2 ? 'standings-silver' : rank === 3 ? 'standings-bronze' : '';
                                const setsDiff = Number(team.set_diff ?? (team.sets_won - team.sets_lost));
                                const pointsDiff = Number(team.point_diff ?? (team.points_won - team.points_lost));
                                return `
                                    <tr class="standings-row ${medalClass}">
                                        <td class="standings-rank" data-label="Loc"><span class="rank-badge">#${rank}</span></td>
                                        <td class="standings-team" data-label="Echipă"><span class="team-name">${team.name}</span></td>
                                        <td class="standings-points" data-label="Puncte clasament"><span class="points-pill">${team.ranking_points} pct</span></td>
                                        <td data-label="Victorii">${team.wins}</td>
                                        <td data-label="Înfrângeri">${team.losses}</td>
                                        <td data-label="Seturi (+/-)">
                                            <div class="stat-line">
                                                <span class="stat-line-main">${team.sets_won}-${team.sets_lost}</span>
                                                <span class="stat-line-diff ${setsDiff > 0 ? 'positive' : setsDiff < 0 ? 'negative' : ''}">${formatDifference(setsDiff)}</span>
                                            </div>
                                        </td>
                                        <td data-label="Raport seturi">${team.set_ratio_display}</td>
                                        <td data-label="Puncte (+/-)">
                                            <div class="stat-line">
                                                <span class="stat-line-main">${team.points_won}-${team.points_lost}</span>
                                                <span class="stat-line-diff ${pointsDiff > 0 ? 'positive' : pointsDiff < 0 ? 'negative' : ''}">${formatDifference(pointsDiff)}</span>
                                            </div>
                                        </td>
                                        <td data-label="Raport puncte">${team.point_ratio_display}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        });
}

function loadStats() {
    fetch('ajax.php?action=get_stats')
        .then(r => r.json())
        .then(data => {
            const summaryContainer = document.getElementById('stats-summary');
            const matchesContainer = document.getElementById('stats-matches');
            const teamsContainer = document.getElementById('stats-teams');
            if (!summaryContainer || !matchesContainer) return;
            const teamsRaw = Array.isArray(data.teams) ? data.teams : [];
            const processedTeams = teamsRaw.map(computeStandingsMetrics);
            const orderedTeams = sortTeamsForStandings(processedTeams);
            const matchesWithHistory = Array.isArray(data.matches) ? data.matches : [];
            lastStatsData = {
                teams: orderedTeams,
                matches: matchesWithHistory
            };
            const totalTeams = lastStatsData.teams.length;
            const completedMatches = lastStatsData.matches.filter(match => match.status === 'completed');
            const totalPoints = lastStatsData.teams.reduce((acc, team) => acc + (team.points_won || 0), 0);
            summaryContainer.innerHTML = `
                <div class="stat-card"><h3>Echipe</h3><p>${totalTeams}</p></div>
                <div class="stat-card"><h3>Meciuri Finalizate</h3><p>${completedMatches.length}</p></div>
                <div class="stat-card"><h3>Puncte Marcate</h3><p>${totalPoints}</p></div>
            `;
            if (teamsContainer) {
                if (!lastStatsData.teams.length) {
                    teamsContainer.innerHTML = '<p class="text-center">Nu există echipe înregistrate.</p>';
                } else {
                    const teamCards = lastStatsData.teams.map(team => {
                        const matchesPlayed = Number(team.wins || 0) + Number(team.losses || 0);
                        const setsDiff = Number(team.set_diff ?? (team.sets_won - team.sets_lost));
                        const pointsDiff = Number(team.point_diff ?? (team.points_won - team.points_lost));
                        const badges = matchesPlayed ? [...Array(Number(team.wins || 0)).fill('win'), ...Array(Number(team.losses || 0)).fill('loss')].map(result => {
                            const isWin = result === 'win';
                            const classes = ['point-badge', isWin ? 'team1' : 'team2'];
                            const label = isWin ? 'V' : 'Î';
                            const title = isWin ? 'Victorie' : 'Înfrângere';
                            return `<span class="${classes.join(' ')}" title="${title}">${label}</span>`;
                        }).join('') : '';
                        const badgesMarkup = matchesPlayed ? `<div class="team-results-badges">${badges}</div>` : '<p class="no-team-results">Nu există meciuri jucate.</p>';
                        return `
                            <div class="team-stat-card">
                                <div class="team-stat-header">
                                    <h4>${team.name}</h4>
                                    <span class="team-stat-record">${Number(team.wins || 0)}-${Number(team.losses || 0)}</span>
                                </div>
                                <div class="team-stat-meta">
                                    <span class="stat-pill">${Number(team.ranking_points || 0)} pct</span>
                                    <span class="stat-pill matches">${matchesPlayed} meci${matchesPlayed === 1 ? '' : 'uri'} jucate</span>
                                </div>
                                <div class="team-stat-results">${badgesMarkup}</div>
                                <div class="team-stat-details">
                                    <div class="team-stat-detail">
                                        <span class="detail-label">Seturi</span>
                                        <span class="detail-value">${Number(team.sets_won || 0)}-${Number(team.sets_lost || 0)} (<span class="diff ${setsDiff > 0 ? 'positive' : setsDiff < 0 ? 'negative' : ''}">${formatDifference(setsDiff)}</span>)</span>
                                    </div>
                                    <div class="team-stat-detail">
                                        <span class="detail-label">Raport seturi</span>
                                        <span class="detail-value">${team.set_ratio_display || '0'}</span>
                                    </div>
                                    <div class="team-stat-detail">
                                        <span class="detail-label">Puncte</span>
                                        <span class="detail-value">${Number(team.points_won || 0)}-${Number(team.points_lost || 0)} (<span class="diff ${pointsDiff > 0 ? 'positive' : pointsDiff < 0 ? 'negative' : ''}">${formatDifference(pointsDiff)}</span>)</span>
                                    </div>
                                    <div class="team-stat-detail">
                                        <span class="detail-label">Raport puncte</span>
                                        <span class="detail-value">${team.point_ratio_display || '0'}</span>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('');
                    teamsContainer.innerHTML = `<h3>Statistici pe echipe</h3><div class="team-stats-grid">${teamCards}</div>`;
                }
            }
            if (!matchesWithHistory.length) {
                matchesContainer.innerHTML = '<p class="text-center">Nu există meciuri înregistrate.</p>';
                return;
            }
            matchesContainer.innerHTML = matchesWithHistory.map(match => {
                const statusLabel = match.status === 'completed' ? `Finalizat${match.winner_name ? ` – Câștigător: ${match.winner_name}` : ''}` : match.status === 'live' ? 'În desfășurare' : 'Neînceput';
                const finalScore = (match.sets_team1 || match.sets_team2) ? `${match.sets_team1}-${match.sets_team2}` : '0-0';
                const sortedSets = Array.isArray(match.points_history)
                    ? match.points_history.slice().sort((a, b) => Number(a.set_number || 0) - Number(b.set_number || 0))
                    : [];
                const setsHtml = sortedSets.map(set => {
                    const points = Array.isArray(set.points)
                        ? set.points.slice().sort((a, b) => Number(a.point_number || 0) - Number(b.point_number || 0))
                        : [];
                    const totalColumns = points.length;
                    const sequenceBadges = points.map(point => {
                        const scorerClass = point.scorer === 'team1' ? 'team1' : 'team2';
                        const displayScoreTeam1 = Number(point.score_team1 || 0);
                        const displayScoreTeam2 = Number(point.score_team2 || 0);
                        const scoreLabel = `${displayScoreTeam1}-${displayScoreTeam2}`;
                        const tooltip = `${match.team1_name} ${displayScoreTeam1} - ${match.team2_name} ${displayScoreTeam2}`;
                        return `<span class="point-badge ${scorerClass}" title="${tooltip}">${scoreLabel}</span>`;
                    }).join('');
                    const pointsMarkup = totalColumns ? `
                        <div class="timeline-team-info">
                            <span class="team-label"><span class="team-dot team1"></span>${match.team1_name}</span>
                            <span class="team-label"><span class="team-dot team2"></span>${match.team2_name}</span>
                        </div>
                        <div class="timeline-sequence">${sequenceBadges}</div>
                    ` : '<p class="empty-points">Nu sunt puncte înregistrate.</p>';
                    return `
                        <div class="set-timeline">
                            <div class="set-timeline-header">
                                <span class="set-title">Set ${set.set_number}</span>
                                <span class="set-score">${Number(set.score_team1 || 0)}-${Number(set.score_team2 || 0)}</span>
                            </div>
                            ${pointsMarkup}
                        </div>
                    `;
                }).join('');
                const historyBody = setsHtml ? `<div class="points-timeline">${setsHtml}</div>` : '<p class="empty-points">Nu există istoric de puncte.</p>';
                return `
                    <div class="match-history-card ${match.status}">
                        <div class="match-history-header">
                            <div><strong>Meci #${match.match_order}</strong> &ndash; ${match.team1_name} vs ${match.team2_name}</div>
                            <div class="match-history-meta">
                                <span>${statusLabel}</span>
                                <span>Seturi: ${finalScore}</span>
                            </div>
                        </div>
                        <div class="match-history-body">${historyBody}</div>
                    </div>
                `;
            }).join('');
        });
}

// Export și share
function buildStandingsShareMessage() {
    const lines = lastStandings.map((team, idx) => {
        const rank = idx + 1;
        const setsDiff = Number(team.set_diff ?? (team.sets_won - team.sets_lost));
        const pointsDiff = Number(team.point_diff ?? (team.points_won - team.points_lost));
        const setRatioDisplay = team.set_ratio_display ?? computeStandingsMetrics(team).set_ratio_display;
        const pointRatioDisplay = team.point_ratio_display ?? computeStandingsMetrics(team).point_ratio_display;
        return `${rank}. ${team.name} – ${team.ranking_points} pct | Victorii: ${team.wins}-${team.losses} | Seturi: ${team.sets_won}-${team.sets_lost} (${formatDifference(setsDiff)}) | Raport seturi: ${setRatioDisplay} | Puncte: ${team.points_won}-${team.points_lost} (${formatDifference(pointsDiff)}) | Raport puncte: ${pointRatioDisplay}`;
    });
    return `Clasament turneu volei:\n${lines.join('\n')}`;
}

function captureStandingsCard() {
    const card = document.querySelector('#view-standings .card');
    if (!card) return Promise.reject(new Error('Nu am găsit zona de clasament.'));
    card.classList.add('standings-export-mode');
    return html2canvas(card, {
        backgroundColor: '#ffffff',
        scale: window.devicePixelRatio < 2 ? 2 : window.devicePixelRatio
    }).then(canvas => {
        card.classList.remove('standings-export-mode');
        return canvas;
    }).catch(error => {
        card.classList.remove('standings-export-mode');
        throw error;
    });
}

function canvasToJpegBlob(canvas) {
    return new Promise((resolve, reject) => {
        if (canvas.toBlob) {
            canvas.toBlob(blob => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Nu am putut genera datele imaginii.'));
                }
            }, 'image/jpeg', 0.92);
            return;
        }
        try {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
            const base64 = dataUrl.split(',')[1];
            const binary = atob(base64);
            const length = binary.length;
            const buffer = new ArrayBuffer(length);
            const view = new Uint8Array(buffer);
            for (let i = 0; i < length; i += 1) {
                view[i] = binary.charCodeAt(i);
            }
            resolve(new Blob([buffer], { type: 'image/jpeg' }));
        } catch (error) {
            reject(error);
        }
    });
}

function exportStandingsImage() {
    if (!lastStandings.length) {
        alert('Nu există date în clasament pentru export.');
        return;
    }
    const fileName = `clasament-${new Date().toISOString().slice(0, 10)}.jpg`;
    captureStandingsCard()
        .then(canvas => {
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/jpeg', 0.92);
            link.download = fileName;
            link.click();
        })
        .catch(() => {
            alert('Nu am putut genera imaginea pentru export.');
        });
}

function shareStandingsWhatsApp() {
    if (!lastStandings.length) {
        alert('Nu există date în clasament pentru a fi partajate.');
        return;
    }
    const fileName = `clasament-${new Date().toISOString().slice(0, 10)}.jpg`;
    const fallbackShare = () => {
        const message = buildStandingsShareMessage();
        const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };
    captureStandingsCard()
        .then(canvas => canvasToJpegBlob(canvas))
        .then(blob => {
            const file = new File([blob], fileName, { type: 'image/jpeg' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                navigator.share({
                    files: [file],
                    title: 'Clasament turneu volei',
                    text: 'Clasament turneu volei'
                }).catch(fallbackShare);
                return;
            }
            fallbackShare();
        })
        .catch(() => {
            alert('Nu am putut genera imaginea pentru partajare.');
        });
}

function buildStatsShareMessage() {
    const totalTeams = lastStatsData.teams.length;
    const completedMatches = lastStatsData.matches.filter(match => match.status === 'completed').length;
    const totalPoints = lastStatsData.teams.reduce((acc, team) => acc + (team.points_won || 0), 0);
    const header = `Statistici turneu volei:\nEchipe: ${totalTeams}\nMeciuri finalizate: ${completedMatches}\nPuncte marcate: ${totalPoints}`;
    if (!totalTeams) return header;
    const teamLines = lastStatsData.teams.map(team => {
        const matchesPlayed = Number(team.wins || 0) + Number(team.losses || 0);
        const setsDiff = Number(team.set_diff ?? (team.sets_won - team.sets_lost));
        const pointsDiff = Number(team.point_diff ?? (team.points_won - team.points_lost));
        return `${team.name}: ${team.ranking_points} pct | Victorii: ${team.wins}-${team.losses} (${matchesPlayed} meci${matchesPlayed === 1 ? '' : 'uri'}) | Seturi: ${team.sets_won}-${team.sets_lost} (${formatDifference(setsDiff)}) | Puncte: ${team.points_won}-${team.points_lost} (${formatDifference(pointsDiff)})`;
    });
    return `${header}\n\nEchipe:\n${teamLines.join('\n')}`;
}

function captureStatsCard() {
    const card = document.querySelector('#view-stats .card');
    if (!card) return Promise.reject(new Error('Nu am găsit zona de statistici.'));
    card.classList.add('stats-export-mode');
    return html2canvas(card, {
        backgroundColor: '#ffffff',
        scale: window.devicePixelRatio < 2 ? 2 : window.devicePixelRatio
    }).then(canvas => {
        card.classList.remove('stats-export-mode');
        return canvas;
    }).catch(error => {
        card.classList.remove('stats-export-mode');
        throw error;
    });
}

function exportStatsImage() {
    captureStatsCard()
        .then(canvas => {
            const fileName = `statistici-${new Date().toISOString().slice(0, 10)}.jpg`;
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/jpeg', 0.92);
            link.download = fileName;
            link.click();
        })
        .catch(() => {
            alert('Nu am putut genera imaginea pentru export.');
        });
}

function shareStatsWhatsApp() {
    if (!lastStatsData.teams.length && !lastStatsData.matches.length) {
        alert('Nu există date în statistici pentru a fi partajate.');
        return;
    }
    const fileName = `statistici-${new Date().toISOString().slice(0, 10)}.jpg`;
    const fallbackShare = () => {
        const message = buildStatsShareMessage();
        const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };
    captureStatsCard()
        .then(canvas => canvasToJpegBlob(canvas))
        .then(blob => {
            const file = new File([blob], fileName, { type: 'image/jpeg' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                navigator.share({
                    files: [file],
                    title: 'Statistici turneu volei',
                    text: 'Statistici turneu volei'
                }).catch(fallbackShare);
                return;
            }
            fallbackShare();
        })
        .catch(() => {
            alert('Nu am putut genera imaginea pentru partajare.');
        });
}