<?php require_once 'functions.php'; ?>
<!DOCTYPE html>
<html lang="ro">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Manager Turneu Volei</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <header>
            <h1>🏐 Manager Turneu Volei</h1>
            <nav>
                <button class="nav-btn active" data-view="setup">⚙️ Setup</button>
                <button class="nav-btn" data-view="matches">📋 Meciuri</button>
                <button class="nav-btn" data-view="live">⚡ Meci Live</button>
                <button class="nav-btn" data-view="standings">🏆 Clasament</button>
                <button class="nav-btn" data-view="stats">📊 Statistici</button>
            </nav>
        </header>

        <!-- VIEW: SETUP -->
        <div id="view-setup" class="view active">
            <div class="card">
                <h2>Configurare Turneu</h2>
                
                <div class="form-group">
                    <label>Format Meci:</label>
                    <div class="radio-group">
                        <label><input type="radio" name="format" value="3" checked> Best of 3</label>
                        <label><input type="radio" name="format" value="5"> Best of 5</label>
                    </div>
                </div>

                <div class="form-group">
                    <label>Adaugă Echipă:</label>
                    <div class="input-group">
                        <input type="text" id="team-name" placeholder="Numele echipei..." />
                        <button onclick="addTeam()" class="btn btn-primary">➕ Adaugă</button>
                    </div>
                </div>

                <div class="form-group">
                    <h3>Echipe Înregistrate (<span id="team-count">0</span>)</h3>
                    <div id="teams-list" class="teams-grid"></div>
                </div>

                <button onclick="generateMatches()" class="btn btn-success btn-full">
                    🎮 Generează Meciuri
                </button>
            </div>
        </div>

        <!-- VIEW: MATCHES -->
        <div id="view-matches" class="view">
            <div class="card">
                <h2>Program Meciuri</h2>
                <p class="info">💡 Poți modifica ordinea meciurilor folosind săgețile</p>
                <div id="matches-list"></div>
            </div>
        </div>

        <!-- VIEW: LIVE -->
        <div id="view-live" class="view">
            <div class="card">
                <div id="live-match-container">
                    <p class="text-center">Selectează un meci din lista de meciuri pentru a începe</p>
                </div>
            </div>
        </div>

        <!-- VIEW: STANDINGS -->
        <div id="view-standings" class="view">
            <div class="card">
                <h2>🏆 Clasament General</h2>
                <div class="standings-actions">
                    <button onclick="exportTable('standings-table', 'clasament')" class="btn btn-secondary">
                        📸 Export JPG
                    </button>
                    <button onclick="shareStandingsWhatsApp()" class="btn btn-whatsapp">
                        📤 Distribuie pe WhatsApp
                    </button>
                </div>
                <div id="standings-table" class="standings-table"></div>
                <div class="standings-info">
                    <h3>ℹ️ Cum se calculează clasamentul</h3>
                    <ul>
                        <li><strong>Puncte clasament</strong>: fiecare victorie valorează 2 puncte, iar o înfrângere adaugă 1 punct pentru participare.</li>
                        <li><strong>Raport seturi</strong>: seturile câștigate împărțite la seturile pierdute (∞ dacă nu ai pierdut niciun set).</li>
                        <li><strong>Raport puncte</strong>: punctele câștigate împărțite la cele pierdute (∞ dacă nu ai pierdut niciun punct).</li>
                        <li><strong>Departajare</strong>: se aplică în ordine – puncte clasament, raport seturi, raport puncte, diferență de seturi, diferență de puncte, apoi ordine alfabetică.</li>
                    </ul>
                </div>
            </div>
        </div>

        <!-- VIEW: STATS -->
        <div id="view-stats" class="view">
            <div class="card">
                <h2>📊 Statistici Detaliate</h2>
                <div id="stats-summary" class="stats-grid"></div>
                <h3>Istoric Meciuri Complete</h3>
                <div id="stats-matches"></div>
            </div>
        </div>
    </div>

    <script src="https://html2canvas.hertzen.com/dist/html2canvas.min.js"></script>
    <script src="script.js"></script>
</body>
</html>
