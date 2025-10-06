// Variabile globale
let currentMatchId = null;
let currentView = 'setup';

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
        container.innerHTML = '<p class="text-center">Selectează un meci din lista de meciuri pentru a începe</p>';
        return;
    }

    fetch(`ajax.php?action=get_match_details&match_id=${currentMatchId}`)
        .then(r => r.json())
        .then(data => {
            if (!data.match) {
                container.innerHTML = '<p class="text-center">Meciul selectat nu a fost găsit.</p>';
                return;
            }
            renderLiveMatch(data);
        })
        .catch(() => {
            container.innerHTML = '<p class="text-center">Eroare la încărcarea meciului.</p>';
        });
}

function renderLiveMatch(data) {
    const { match, sets, points } = data;
    const container = document.getElementById('live-match-container');
    if (!container) return;

    const isCompleted = match.status === 'completed';
    const currentSet = sets.length ? Math.max(...sets.map(set => set.set_number)) : 1;
    const setsToWin = Math.ceil(match.match_format / 2);

    const setsRows = sets.length ? sets.map(set => `
        <tr class="${set.winner ? 'set-complete' : ''}">
            <td>Set ${set.set_number}</td>
            <td>${set.score_team1}</td>
            <td>${set.score_team2}</td>
            <td>${set.winner ? (set.winner === 'team1' ? match.team1_name : match.team2_name) : '-'}</td>
        </tr>
    `).join('') : `
        <tr>
            <td colspan="4">Setul 1 încă nu a început.</td>
        </tr>
    `;

    const pointsBySet = (points || []).reduce((acc, point) => {
        if (!acc[point.set_number]) acc[point.set_number] = [];
        acc[point.set_number].push(point);
        return acc;
    }, {});

    const pointsHistory = Object.keys(pointsBySet).length ? Object.entries(pointsBySet)
        .map(([setNumber, setPoints]) => `
            <div class="set-history">
                <h4>Set ${setNumber}</h4>
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

    container.innerHTML = `
        <div class="live-header">
            <h2>${match.team1_name} vs ${match.team2_name}</h2>
            <p>Primul la ${setsToWin} seturi câștigate. ${isCompleted ? 'Meci finalizat.' : `Set curent: ${currentSet}`}</p>
        </div>
        <div class="live-score">
            <div class="team-score">
                <h3>${match.team1_name}</h3>
                <span class="score">${match.sets_team1}</span>
            </div>
            <div class="separator">-</div>
            <div class="team-score">
                <h3>${match.team2_name}</h3>
                <span class="score">${match.sets_team2}</span>
            </div>
        </div>
        ${!isCompleted ? `
            <div class="live-controls">
                <button class="btn btn-success" onclick="addPointLive('team1')">+1 ${match.team1_name}</button>
                <button class="btn btn-success" onclick="addPointLive('team2')">+1 ${match.team2_name}</button>
            </div>
        ` : `
            <div class="winner-banner">Câștigător: <strong>${match.winner_name}</strong></div>
        `}
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
        <div class="points-history">
            <h3>Istoric puncte</h3>
            ${pointsHistory}
        </div>
    `;
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
    .then(() => {
        loadLiveMatch();
        loadMatches();
        if (currentView === 'standings') loadStandings();
        if (currentView === 'stats') loadStats();
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
