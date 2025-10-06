// Variabile globale
let currentMatchId = null;
let currentView = 'setup';

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
}

// Încarcă echipe
function loadTeams() {
    fetch('ajax.php?action=get_teams')
        .then(r => r.json())
        .then(data => {
            const container = document.getElementById('teams-list');
            document.getElementById('team-count').textContent = data.teams.length;
            
            container.innerHTML = data.teams.map(team => `
                <div class="team-item">
                    <span><strong>${team.name}</strong></span>
                    <button onclick="deleteTeam(${team.id})">🗑️</button>
                </div>
            `).join('');
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
        if (data.success) loadTeams();
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
        if (data.success) {
            alert('Meciuri generate cu succes!');
            switchView('matches');
        }
    });
}

// Încarcă meciuri
function loadMatches() {
    fetch('ajax.php?action=get_matches')
        .then(r => r.json())
        .then(data => {
            const container = document.getElementById('matches-list');
            
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
                                    ${idx > 0 ? `<button onclick="moveMatch(${match.id}, ${match.match_order - 1})">⬆️</button>` : ''}
                                    ${idx < data.matches.length - 1 ? `<button onclick="moveMatch(${match.id}, ${match.match_order + 1})">⬇️</button>` : ''}
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
    switchView('live');
    loadLiveMatch();
}

// Continuare în următorul mesaj...