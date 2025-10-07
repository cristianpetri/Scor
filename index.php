<?php
require_once 'functions.php';

$currentUser = getCurrentUser();
$isAdmin = $currentUser && ($currentUser['role'] ?? '') === 'admin';
$defaultView = $isAdmin ? 'setup' : 'matches';
?>
<!DOCTYPE html>
<html lang="ro">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Manager Turneu Volei</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body data-is-admin="<?= $isAdmin ? '1' : '0' ?>">
    <div class="container">
        <header>
            <h1 id="app-title">🏐 Manager Turneu Volei</h1>
            <nav>
                <?php if ($isAdmin): ?>
                    <button class="nav-btn <?= $defaultView === 'setup' ? 'active' : '' ?>" data-view="setup">⚙️ Setup</button>
                <?php endif; ?>
                <button class="nav-btn <?= $defaultView === 'matches' ? 'active' : '' ?>" data-view="matches">📋 Meciuri</button>
                <button class="nav-btn <?= $defaultView === 'live' ? 'active' : '' ?>" data-view="live">⚡ Meci Live</button>
                <button class="nav-btn <?= $defaultView === 'standings' ? 'active' : '' ?>" data-view="standings">🏆 Clasament</button>
                <button class="nav-btn <?= $defaultView === 'stats' ? 'active' : '' ?>" data-view="stats">📊 Statistici</button>
            </nav>
            <div class="auth-bar">
                <?php if ($currentUser): ?>
                    <span class="auth-status">Autentificat ca <strong><?= htmlspecialchars($currentUser['username'], ENT_QUOTES, 'UTF-8') ?></strong> (<?= htmlspecialchars($currentUser['role'], ENT_QUOTES, 'UTF-8') ?>)</span>
                    <button id="logout-button" class="btn btn-secondary auth-button" type="button">🔓 Deconectare</button>
                <?php else: ?>
                    <form id="login-form" class="auth-form" autocomplete="off">
                        <label class="sr-only" for="login-username">Utilizator</label>
                        <input id="login-username" name="username" type="text" placeholder="Utilizator" required>
                        <label class="sr-only" for="login-password">Parolă</label>
                        <input id="login-password" name="password" type="password" placeholder="Parolă" required>
                        <button type="submit" class="btn btn-primary auth-button">🔐 Autentificare</button>
                    </form>
                    <p id="login-feedback" class="auth-feedback" role="status" aria-live="polite"></p>
                <?php endif; ?>
            </div>
        </header>

        <!-- VIEW: SETUP -->
        <?php if ($isAdmin): ?>
        <div id="view-setup" class="view <?= $defaultView === 'setup' ? 'active' : '' ?>">
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
                    <label for="app-title-input">Titlu aplicație:</label>
                    <div class="input-group">
                        <input type="text" id="app-title-input" placeholder="Ex: Turneul de la Liceu" />
                        <button onclick="saveAppTitle()" class="btn btn-secondary">💾 Salvează</button>
                    </div>
                    <p class="form-hint">Titlul va apărea în antet și în bara de titlu a browserului.</p>
                    <p id="app-title-feedback" class="form-feedback" role="status" aria-live="polite"></p>
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
        <?php endif; ?>

        <!-- VIEW: MATCHES -->
        <div id="view-matches" class="view <?= $defaultView === 'matches' ? 'active' : '' ?>">
            <div class="card">
                <h2>Program Meciuri</h2>
                <?php if ($isAdmin): ?>
                    <p class="info">💡 Poți modifica ordinea meciurilor folosind săgețile</p>
                <?php else: ?>
                    <p class="info">ℹ️ Programul este gestionat de administrator. Poți urmări meciurile programate mai jos.</p>
                <?php endif; ?>
                <div id="matches-list"></div>
            </div>
        </div>

        <!-- VIEW: LIVE -->
        <div id="view-live" class="view <?= $defaultView === 'live' ? 'active' : '' ?>">
            <div class="card">
                <div id="live-match-container">
                    <p class="text-center">Selectează un meci din lista de meciuri pentru a începe</p>
                </div>
            </div>
        </div>

        <!-- VIEW: STANDINGS -->
        <div id="view-standings" class="view <?= $defaultView === 'standings' ? 'active' : '' ?>">
            <div class="card">
                <h2>🏆 Clasament General</h2>
                <div class="standings-actions">
                    <button onclick="exportStandingsImage()" class="btn btn-secondary">
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
        <div id="view-stats" class="view <?= $defaultView === 'stats' ? 'active' : '' ?>">
            <div class="card">
                <h2>📊 Statistici Detaliate</h2>
                <div class="stats-actions">
                    <button onclick="exportStatsImage()" class="btn btn-secondary">
                        📸 Export JPG
                    </button>
                    <button onclick="shareStatsWhatsApp()" class="btn btn-whatsapp">
                        📤 Distribuie pe WhatsApp
                    </button>
                </div>
                <div id="stats-summary" class="stats-grid"></div>
                <div id="stats-teams" class="team-stats-section"></div>
                <h3>Istoric Meciuri Complete</h3>
                <div id="stats-matches"></div>
            </div>
        </div>
    </div>

    <script src="https://html2canvas.hertzen.com/dist/html2canvas.min.js"></script>
    <script src="script.js"></script>
</body>
</html>
