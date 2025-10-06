// Variabile globale
let currentMatchId = null;
let currentView = 'setup';
let liveTimerInterval = null;

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
    if (totalSeconds == null || !Number.isFinite(totalSeconds) || totalSeconds < 0) {
        return '--:--';
    }

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

        if (isLive) {
            end = new Date();
        }

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

    if (!start) {
        isLive = false;
    }

    if (isLive) {
        end = new Date();
    }

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

// Inițializare după încărcarea paginii
document.addEventListener('DOMContentLoaded', () => {
    loadTeams();
    loadMatches();
});

// Schimbă view-ul
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const view = this.dataset.view;
        switchView(view);
    });
});

function switchView(view) {
    currentView = view;

    // Update butoane navigare
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === view) {
            btn.classList.add('active');
        }
    });

    // Update views
    document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('active');
    });
    document.getElementById('view-' + view).classList.add('active');

    // Încarcă date pentru view
    if (view !== 'live') {
        stopLiveTimers();
    }

    if (view === 'matches') loadMatches();
    if (view === 'standings') loadStandings();
    if (view === 'stats') loadStats();
    if (view === 'live') loadLiveMatch();
}

// Încarcă echipe
function loadTeams() {
    fetch('ajax.php?action=get_teams')
        .then(r => r.json())
        .then(data => {
            const container = document.getElementById('teams-list');
            if (!container) return;

            document.getElementById('team-count').textContent = data.teams.length;

            container.innerHTML = data.teams.map(team => `
                <div class="team-item">
                    <span><strong>${team.name}</strong></span>
                    <button onclick="deleteTeam(${team.id})">🗑️</button>
                </div>
            `).join('');
        })
        .catch(() => {
            const container = document.getElementById('teams-list');
            if (container) {
                container.innerHTML = '<p class="text-center">Eroare la încărcarea echipelor.</p>';
            }
        });
}

// Adaugă echipă
function addTeam() {
    const input = document.getElementById('team-name');
    const name = input.value.trim();

    if (!name) {
        alert('Introdu numele echipei!');
        return;
    }

    const formData = new FormData();
    formData.append('action', 'add_team');
    formData.append('name', name);

    fetch('ajax.php', {
        method: 'POST',
        body: formData
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            input.value = '';
            loadTeams();
        }
    });
}

// Șterge echipă
function deleteTeam(id) {
    if (!confirm('Sigur vrei să ștergi această echipă?')) return;

    const formData = new FormData();
    formData.append('action', 'delete_team');
    formData.append('id', id);

    fetch('ajax.php', {
        method: 'POST',
        body: formData
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            loadTeams();
            loadMatches();
            if (currentView === 'standings') loadStandings();
            if (currentView === 'stats') loadStats();
        }
    });
}

// Generează meciuri
function generateMatches() {
    const format = document.querySelector('input[name="format"]:checked').value;

    if (!confirm('Generează meciurile? Meciurile existente vor fi șterse!')) return;

    const formData = new FormData();
    formData.append('action', 'generate_matches');
    formData.append('format', format);

    fetch('ajax.php', {
        method: 'POST',
        body: formData
    })
    .then(r => r.json())
    .then(data => {
        if (!data.success) {
            alert(data.message || 'Eroare la generarea meciurilor.');
            return;
        }

        let message = 'Meciuri generate cu succes!';
        if (data.warning) {
            message += `\n\n${data.warning}`;
        }

        alert(message);
        loadMatches();
        switchView('matches');
    })
    .catch(() => {
        alert('Eroare la generarea meciurilor.');
    });
}

// Încarcă meciuri
function loadMatches() {
    fetch('ajax.php?action=get_matches')
        .then(r => r.json())
        .then(data => {
            const container = document.getElementById('matches-list');
            if (!container) return;

            if (data.matches.length === 0) {
                container.innerHTML = '<p class="text-center">Nu există meciuri generate. Mergi la Setup pentru a genera meciuri.</p>';
                return;
            }

            container.innerHTML = data.matches.map((match, idx) => `
                <div class="match-item ${match.status === 'completed' ? 'completed' : ''}">
                    <div class="match-header">
                        <div class="match-info">
                            <span style="color: #6b7280;">Meci #${match.match_order}</span>
                            <h3>${match.team1_name} vs ${match.team2_name}</h3>
                            ${match.status === 'completed' ? `
                                <div class="winner">Câștigător: ${match.winner_name} (${match.sets_team1}-${match.sets_team2})</div>
                            ` : ''}
                        </div>
                        <div class="match-actions">
                            ${match.status === 'pending' ? `
                                <div class="match-controls">
                                    ${idx > 0 ? `<button onclick=\"moveMatch(${match.id}, ${match.match_order - 1})\">⬆️</button>` : ''}
                                    ${idx < data.matches.length - 1 ? `<button onclick=\"moveMatch(${match.id}, ${match.match_order + 1})\">⬇️</button>` : ''}
                                </div>
                                <button class="btn btn-primary" onclick="startMatch(${match.id})">▶️ Start</button>
                            ` : `
                                <button class="btn btn-secondary" onclick="viewMatchStats(${match.id})">📊 Detalii</button>
                            `}
                        </div>
                    </div>
                </div>
            `).join('');
        });
}

// Mută meci
function moveMatch(matchId, newOrder) {
    const formData = new FormData();
    formData.append('action', 'update_match_order');
    formData.append('match_id', matchId);
    formData.append('new_order', newOrder);

    fetch('ajax.php', {
        method: 'POST',
        body: formData
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) loadMatches();
    });
}

// Start meci
function startMatch(matchId) {
    currentMatchId = matchId;

    const formData = new FormData();
    formData.append('action', 'start_match');
    formData.append('match_id', matchId);

    fetch('ajax.php', {
        method: 'POST',
        body: formData
    })
    .then(r => r.json())
    .then(data => {
        if (!data.success) {
            alert(data.message || 'Nu am putut porni meciul.');
            currentMatchId = null;
            return;
        }

        switchView('live');
        loadMatches();
    })
    .catch(() => {
        alert('Nu am putut porni meciul.');
        currentMatchId = null;
    });
}

// Vizualizare meci finalizat sau live
function viewMatchStats(matchId) {
    currentMatchId = matchId;
    switchView('live');
}

// Încarcă detalii meci live
function loadLiveMatch() {
    const container = document.getElementById('live-match-container');
    if (!container) return;

    if (!currentMatchId) {
        stopLiveTimers();
        container.innerHTML = '<p class="text-center">Selectează un meci din lista de meciuri pentru a începe</p>';
        return;
    }

    fetch(`ajax.php?action=get_match_details&match_id=${currentMatchId}`)
        .then(r => r.json())
        .then(data => {
            if (!data.match) {
                stopLiveTimers();
                container.innerHTML = '<p class="text-center">Meciul selectat nu a fost găsit.</p>';
                return;
            }
            renderLiveMatch(data);
        })
        .catch(() => {
            stopLiveTimers();
            container.innerHTML = '<p class="text-center">Eroare la încărcarea meciului.</p>';
        });
}

function renderLiveMatch(data) {
    const { match, sets = [], points = [] } = data;
    const container = document.getElementById('live-match-container');
    if (!container) return;

    const isCompleted = match.status === 'completed';
    const completedSetsCount = Number(match.sets_team1) + Number(match.sets_team2);
    const currentSetNumber = isCompleted ? Math.max(completedSetsCount, 1) : completedSetsCount + 1;
    const currentSetData = (sets.find(set => Number(set.set_number) === currentSetNumber) || {
        set_number: currentSetNumber,
        score_team1: 0,
        score_team2: 0,
        winner: null
    });
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
        setsRows += `
            <tr class="set-current">
                <td>Set ${currentSetNumber}</td>
                <td>0</td>
                <td>0</td>
                <td>În așteptare</td>
            </tr>
        `;
    }

    if (!setsRows) {
        setsRows = `
            <tr class="set-current">
                <td>Set 1</td>
                <td>0</td>
                <td>0</td>
                <td>În așteptare</td>
            </tr>
        `;
    }

    const winnerId = match.winner_id ? Number(match.winner_id) : null;
    const team1Winner = isCompleted && winnerId && winnerId === Number(match.team1_id);
    const team2Winner = isCompleted && winnerId && winnerId === Number(match.team2_id);
    const pointsLabel = isCompleted ? 'Puncte în ultimul set' : `Puncte în setul ${currentSetNumber}`;
    const team1WinnerTag = team1Winner ? '<span class="winner-tag">Câștigător</span>' : '';
    const team2WinnerTag = team2Winner ? '<span class="winner-tag">Câștigător</span>' : '';

    const pointsBySet = (points || []).reduce((acc, point) => {
        if (!acc[point.set_number]) acc[point.set_number] = [];
        acc[point.set_number].push(point);
        return acc;
    }, {});

    const pointsHistoryMarkup = Object.keys(pointsBySet).length ? Object.entries(pointsBySet)
        .map(([setNumber, setPoints]) => `
            <div class="set-history">
                <div class="set-history-header">
                    <span>Set ${setNumber}</span>
                    <span>${match.team1_name} ${setPoints[setPoints.length - 1]?.score_team1 ?? 0} - ${setPoints[setPoints.length - 1]?.score_team2 ?? 0} ${match.team2_name}</span>
                </div>
                <ul>
                    ${setPoints.map(point => `
                        <li>
                            <strong>${point.scorer === 'team1' ? match.team1_name : match.team2_name}</strong>
                            &ndash; scor ${point.score_team1}-${point.score_team2}
                        </li>
                    `).join('')}
                </ul>
            </div>
        `).join('') : '<p>Încă nu au fost înregistrate puncte.</p>';

    const matchDurationInfo = buildDurationInfo(
        points[0]?.created_at || '',
        points.length ? points[points.length - 1].created_at : '',
        !isCompleted && points.length > 0
    );

    const matchDurationAttrs = durationAttributes(matchDurationInfo);
    const matchDurationText = `⏱️ ${matchDurationInfo.display}`;
    const secondaryMetaLabel = isCompleted ? 'Seturi jucate' : 'Set curent';
    const secondaryMetaValue = isCompleted ? completedSetsCount : currentSetNumber;
    const removePointButton = (!isCompleted && points.length) ? '<button class="btn-undo" onclick="removeLastPoint()">↩️ Anulează ultimul punct</button>' : '';

    const setNumbers = Array.from(new Set([
        ...sortedSets.map(set => Number(set.set_number)),
        ...Object.keys(pointsBySet).map(Number),
        !isCompleted ? currentSetNumber : null
    ].filter(Boolean))).sort((a, b) => a - b);

    const timelineMarkup = setNumbers.length ? setNumbers.map(setNumber => {
        const setDetails = sortedSets.find(set => Number(set.set_number) === setNumber) || null;
        const setPoints = (pointsBySet[setNumber] || []).slice().sort((a, b) => Number(a.point_number) - Number(b.point_number));
        const highlightActive = !isCompleted && setNumber === currentSetNumber;
        const totalColumns = setPoints.length;
        const latestIndex = totalColumns - 1;
        const setStartTime = setPoints[0]?.created_at || '';
        const setEndTime = totalColumns ? setPoints[totalColumns - 1].created_at : '';
        const durationInfo = buildDurationInfo(setStartTime, setEndTime, highlightActive && totalColumns > 0);
        const durationAttrs = durationAttributes(durationInfo);
        const durationText = `⏱️ ${durationInfo.display}`;
        const displayScoreTeam1 = Number(setDetails?.score_team1 ?? (setPoints[totalColumns - 1]?.score_team1 ?? 0));
        const displayScoreTeam2 = Number(setDetails?.score_team2 ?? (setPoints[totalColumns - 1]?.score_team2 ?? 0));
        const gridColumnsStyle = totalColumns ? ` style="--columns:${totalColumns}"` : '';

        if (!totalColumns) {
            return `
                <div class="set-timeline ${highlightActive ? 'set-timeline-live' : ''}">
                    <div class="set-timeline-header">
                        <span class="set-title">Set ${setNumber}</span>
                        <span class="set-score">${displayScoreTeam1}-${displayScoreTeam2}</span>
                        <span class="set-duration" ${durationAttrs}>⏱️ --:--</span>
                    </div>
                    <p class="timeline-empty">Încă nu s-au marcat puncte în acest set.</p>
                </div>
            `;
        }

        const team1Badges = setPoints.map((point, idx) => {
            if (point.scorer === 'team1') {
                const badgeClasses = ['point-badge', 'team1'];
                if (highlightActive && idx === latestIndex) {
                    badgeClasses.push('latest');
                }
                return `<span class="${badgeClasses.join(' ')}">${point.score_team1}</span>`;
            }
            return '<span class="point-badge placeholder"></span>';
        }).join('');

        const team2Badges = setPoints.map((point, idx) => {
            if (point.scorer === 'team2') {
                const badgeClasses = ['point-badge', 'team2'];
                if (highlightActive && idx === latestIndex) {
                    badgeClasses.push('latest');
                }
                return `<span class="${badgeClasses.join(' ')}">${point.score_team2}</span>`;
            }
            return '<span class="point-badge placeholder"></span>';
        }).join('');

        return `
            <div class="set-timeline ${highlightActive ? 'set-timeline-live' : ''}">
                <div class="set-timeline-header">
                    <span class="set-title">Set ${setNumber}</span>
                    <span class="set-score">${displayScoreTeam1}-${displayScoreTeam2}</span>
                    <span class="set-duration" ${durationAttrs}>${durationText}</span>
                </div>
                <div class="timeline-row">
                    <span class="team-label">${match.team1_name}</span>
                    <div class="timeline-points"${gridColumnsStyle}>${team1Badges}</div>
                </div>
                <div class="timeline-row">
                    <span class="team-label">${match.team2_name}</span>
                    <div class="timeline-points"${gridColumnsStyle}>${team2Badges}</div>
                </div>
            </div>
        `;
    }).join('') : '<p>Nu există date pentru acest meci.</p>';

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
                    <div class="team-name">${match.team1_name}</div>
                    <div class="team-points">${currentPointsTeam1}</div>
                    <div class="team-meta">${pointsLabel}</div>
                    ${!isCompleted ? `<button class="btn-score" onclick="addPointLive('team1')">+ Punct</button>` : ''}
                </div>
                <div class="team-card team2 ${team2Winner ? 'winner' : ''}">
                    ${team2WinnerTag}
                    <div class="team-name">${match.team2_name}</div>
                    <div class="team-points">${currentPointsTeam2}</div>
                    <div class="team-meta">${pointsLabel}</div>
                    ${!isCompleted ? `<button class="btn-score" onclick="addPointLive('team2')">+ Punct</button>` : ''}
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
            ${removePointButton ? `<div class="scoreboard-actions">${removePointButton}</div>` : ''}
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
        ${isCompleted ? `
            <div class="points-timeline">
                <h3>Istoric puncte detaliat</h3>
                ${timelineMarkup}
            </div>
        ` : `
            <div class="points-sections">
                <div class="points-history">
                    <h3>Istoric puncte</h3>
                    ${pointsHistoryMarkup}
                </div>
                <div class="points-timeline live">
                    <h3>Istoric puncte detaliat</h3>
                    ${timelineMarkup}
                </div>
            </div>
        `}
    `;

    scheduleLiveTimers(isCompleted);
}

function addPointLive(teamKey) {
    if (!currentMatchId) return;

    const formData = new FormData();
    formData.append('action', 'add_point');
    formData.append('match_id', currentMatchId);
    formData.append('scorer', teamKey);

    fetch('ajax.php', {
        method: 'POST',
        body: formData
    })
    .then(r => r.json())
    .then(data => {
        if (!data.success) {
            alert(data.message || 'Nu am putut adăuga punctul.');
            return;
        }
        loadLiveMatch();
        loadMatches();
        if (currentView === 'standings') loadStandings();
        if (currentView === 'stats') loadStats();
    })
    .catch(() => {
        alert('Nu am putut adăuga punctul.');
    });
}

function removeLastPoint() {
    if (!currentMatchId) return;
    if (!confirm('Ești sigur că vrei să anulezi ultimul punct înregistrat?')) return;

    const formData = new FormData();
    formData.append('action', 'remove_last_point');
    formData.append('match_id', currentMatchId);

    fetch('ajax.php', {
        method: 'POST',
        body: formData
    })
    .then(r => r.json())
    .then(data => {
        if (!data.success) {
            alert(data.message || 'Nu am putut șterge ultimul punct.');
            return;
        }

        loadLiveMatch();
        loadMatches();
    })
    .catch(() => {
        alert('Nu am putut șterge ultimul punct.');
    });
}

// Încarcă clasamentul
function loadStandings() {
    fetch('ajax.php?action=get_teams')
        .then(r => r.json())
        .then(data => {
            const container = document.getElementById('standings-table');
            if (!container) return;

            if (data.teams.length === 0) {
                container.innerHTML = '<p class="text-center">Nu există echipe înregistrate.</p>';
                return;
            }

            container.innerHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Echipă</th>
                            <th>Victorii</th>
                            <th>Înfrângeri</th>
                            <th>Seturi (+/-)</th>
                            <th>Puncte (+/-)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.teams.map((team, idx) => `
                            <tr>
                                <td>${idx + 1}</td>
                                <td>${team.name}</td>
                                <td>${team.wins}</td>
                                <td>${team.losses}</td>
                                <td>${team.sets_won}-${team.sets_lost}</td>
                                <td>${team.points_won}-${team.points_lost}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        });
}

// Încarcă statistici
function loadStats() {
    Promise.all([
        fetch('ajax.php?action=get_teams').then(r => r.json()),
        fetch('ajax.php?action=get_matches').then(r => r.json())
    ]).then(([teamsData, matchesData]) => {
        const summaryContainer = document.getElementById('stats-summary');
        const matchesContainer = document.getElementById('stats-matches');
        if (!summaryContainer || !matchesContainer) return;

        const totalTeams = teamsData.teams.length;
        const completedMatches = matchesData.matches.filter(match => match.status === 'completed');
        const totalPoints = teamsData.teams.reduce((acc, team) => acc + team.points_won, 0);

        summaryContainer.innerHTML = `
            <div class="stat-card">
                <h3>Echipe</h3>
                <p>${totalTeams}</p>
            </div>
            <div class="stat-card">
                <h3>Meciuri Finalizate</h3>
                <p>${completedMatches.length}</p>
            </div>
            <div class="stat-card">
                <h3>Puncte Marcate</h3>
                <p>${totalPoints}</p>
            </div>
        `;

        if (matchesData.matches.length === 0) {
            matchesContainer.innerHTML = '<p class="text-center">Nu există meciuri înregistrate.</p>';
            return;
        }

        matchesContainer.innerHTML = matchesData.matches.map(match => `
            <div class="match-stat ${match.status}">
                <div>
                    <strong>Meci #${match.match_order}</strong> &ndash; ${match.team1_name} vs ${match.team2_name}
                </div>
                <div>
                    ${match.status === 'completed' ? `Scor final: ${match.sets_team1}-${match.sets_team2}` : 'Încă nu a fost jucat.'}
                </div>
            </div>
        `).join('');
    });
}
