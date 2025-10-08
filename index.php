<?php
require_once 'functions.php';

$currentUser = getCurrentUser();
$isAdmin = isAdmin();
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
        <div class="auth-bar">
            <?php if ($currentUser): ?>
                <div class="auth-status-badge" aria-live="polite">
                    <span class="auth-status-icon" aria-hidden="true">👤</span>
                    <div class="auth-status-text">
                        <span class="auth-status-label">Autentificat</span>
                        <strong><?= htmlspecialchars($currentUser['username'], ENT_QUOTES, 'UTF-8') ?></strong>
                        <span class="auth-status-role"><?= htmlspecialchars($currentUser['role'], ENT_QUOTES, 'UTF-8') ?></span>
                    </div>
                </div>
                <button id="logout-button" class="btn btn-secondary auth-button" type="button">🔓 Deconectare</button>
            <?php else: ?>
                <div class="auth-dropdown">
                    <button id="auth-toggle" class="auth-toggle" type="button" aria-haspopup="true" aria-expanded="false">
                        <span class="auth-toggle-icon" aria-hidden="true">🔐</span>
                        <span class="auth-toggle-text">Autentificare Admin</span>
                    </button>
                    <div id="auth-panel" class="auth-panel" role="dialog" aria-modal="false" aria-hidden="true">
                        <form id="login-form" class="auth-form" autocomplete="off">
                            <div class="auth-form-group">
                                <label for="login-username">Utilizator</label>
                                <input id="login-username" name="username" type="text" placeholder="Ex: admin" required>
                            </div>
                            <div class="auth-form-group">
                                <label for="login-password">Parolă</label>
                                <input id="login-password" name="password" type="password" placeholder="Parolă" required>
                            </div>
                            <button type="submit" class="btn btn-primary auth-button btn-full">Autentifică-te</button>
                        </form>
                        <p id="login-feedback" class="auth-feedback" role="status" aria-live="polite"></p>
                        <p class="auth-hint">Cont implicit: <strong>admin</strong> / <strong>admin123</strong></p>
                    </div>
                </div>
            <?php endif; ?>
        </div>
        <header>
            <h1 id="app-title">🏐 Manager Turneu Volei</h1>
            <nav>
                <button class="nav-btn active" data-view="matches">📋 Meciuri</button>
                <button class="nav-btn" data-view="live">⚡ Meci Live</button>
                <button class="nav-btn" data-view="standings">🏆 Clasament</button>
                <button class="nav-btn" data-view="stats">📊 Statistici</button>
                <?php if ($isAdmin): ?>
                    <button class="nav-btn nav-btn-admin" data-view="admin">⚙️ Administrare</button>
                <?php endif; ?>
            </nav>
        </header>

        <!-- VIEW: MATCHES (Public) -->
        <div id="view-matches" class="view active">
            <div class="card">
                <h2>📋 Program Meciuri</h2>
                <p class="info">ℹ️ Programul meciurilor din turneu. <?= $isAdmin ? 'Folosește secțiunea Administrare pentru modificări.' : '' ?></p>
                <div id="matches-list"></div>
            </div>
        </div>

        <!-- VIEW: LIVE (Public) -->
        <div id="view-live" class="view">
            <div class="card">
                <div id="live-match-container">
                    <p class="text-center">Selectează un meci din lista de meciuri pentru a urmări</p>
                </div>
            </div>
        </div>

        <!-- VIEW: STANDINGS (Public) -->
        <div id="view-standings" class="view">
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

        <!-- VIEW: STATS (Public) -->
        <div id="view-stats" class="view">
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

        <!-- VIEW: ADMIN (Only for admins) -->
        <?php if ($isAdmin): ?>
        <div id="view-admin" class="view">
            <div class="card">
                <h2>⚙️ Panou de Administrare</h2>
                
                <div class="admin-section">
                    <h3>🎨 Configurare Aplicație</h3>
                    <div class="form-group">
                        <label for="app-title-input">Titlu aplicație:</label>
                        <div class="input-group">
                            <input type="text" id="app-title-input" placeholder="Ex: Turneul de la Liceu" />
                            <button onclick="saveAppTitle()" class="btn btn-secondary">💾 Salvează</button>
                        </div>
                        <p class="form-hint">Titlul va apărea în antet și în bara de titlu a browserului.</p>
                        <p id="app-title-feedback" class="form-feedback" role="status" aria-live="polite"></p>
                    </div>
                </div>

                <div class="admin-section">
                    <h3>👥 Gestionare Echipe</h3>
                    <div class="form-group">
                        <label>Adaugă Echipă:</label>
                        <div class="input-group">
                            <input type="text" id="team-name" placeholder="Numele echipei..." />
                            <button onclick="addTeam()" class="btn btn-primary">➕ Adaugă</button>
                        </div>
                    </div>

                    <div class="form-group">
                        <h4>Echipe Înregistrate (<span id="team-count">0</span>)</h4>
                        <div id="teams-list" class="teams-grid"></div>
                    </div>
                </div>

                <div class="admin-section">
                    <h3>🎮 Configurare Meciuri</h3>
                    <div class="form-group">
                        <label>Format Meci:</label>
                        <div class="radio-group">
                            <label><input type="radio" name="format" value="3" checked> Best of 3</label>
                            <label><input type="radio" name="format" value="5"> Best of 5</label>
                        </div>
                    </div>

                    <button onclick="generateMatches()" class="btn btn-success btn-full">
                        🎮 Generează Meciuri
                    </button>
                </div>

                <div class="admin-section">
                    <h3>📋 Gestionare Meciuri</h3>
                    <p class="info">💡 Modifică ordinea meciurilor sau pornește meciuri noi</p>
                    <div id="admin-matches-list"></div>
                </div>

                <div class="admin-section" id="admin-live-section" style="display: none;">
                    <h3>⚡ Control Meci Live</h3>
                    <div id="admin-live-controls"></div>
                </div>
            </div>
        </div>
        <?php endif; ?>
    </div>

    <script src="https://html2canvas.hertzen.com/dist/html2canvas.min.js"></script>
    <script src="script.js"></script>
</body>
</html>

<!-- Stiluri suplimentare pentru secțiunea admin -->
<style>
.nav-btn-admin {
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: white;
    border-color: transparent;
}

.nav-btn-admin:hover {
    background: linear-gradient(135deg, #d97706, #b45309);
}

.nav-btn-admin.active {
    background: linear-gradient(135deg, #b45309, #92400e);
}

.admin-section {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 24px;
}

.admin-section h3 {
    color: #1e293b;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.admin-section h4 {
    color: #334155;
    margin-bottom: 12px;
    font-size: 16px;
}

.admin-match-item {
    background: #ffffff;
    border: 2px solid #e5e7eb;
    border-radius: 10px;
    padding: 16px;
    margin-bottom: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
}

.admin-match-item.pending {
    border-left: 4px solid #3b82f6;
}

.admin-match-item.live {
    border-left: 4px solid #22c55e;
    background: #f0fdf4;
}

.admin-match-item.completed {
    border-left: 4px solid #ef4444;
    background: #fef2f2;
}

.admin-match-info {
    flex: 1;
}

.admin-match-info h4 {
    margin: 0 0 4px 0;
    color: #1f2937;
}

.admin-match-info p {
    margin: 0;
    font-size: 14px;
    color: #6b7280;
}

.admin-match-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.admin-live-scoreboard {
    background: linear-gradient(135deg, #1e293b, #334155);
    border-radius: 16px;
    padding: 24px;
    color: white;
    margin-bottom: 20px;
}

.admin-live-teams {
    display: flex;
    justify-content: space-around;
    gap: 20px;
    margin-bottom: 20px;
}

.admin-live-team {
    text-align: center;
}

.admin-live-team h4 {
    margin: 0 0 12px 0;
    font-size: 20px;
}

.admin-live-score {
    font-size: 48px;
    font-weight: bold;
    margin: 12px 0;
}

.admin-live-team button {
    margin-top: 12px;
}

@media (max-width: 768px) {
    .admin-match-item {
        flex-direction: column;
        align-items: stretch;
    }
    
    .admin-match-actions {
        width: 100%;
    }
    
    .admin-match-actions button {
        flex: 1;
    }
}
</style>