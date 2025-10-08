<?php
session_start();

// Configurare bază de date
define('DB_HOST', 'localhost');
define('DB_USER', 'dataconsult_scor');
define('DB_PASS', 'max0766426369');
define('DB_NAME', 'dataconsult_volei_turneu');

// Conexiune la baza de date
try {
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
        DB_USER,
        DB_PASS,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]
    );
} catch(PDOException $e) {
    die("Eroare conexiune: " . $e->getMessage());
}

// Inițializează infrastructura de autentificare
function initializeAuthentication(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE username = ?");
    $stmt->execute(['admin']);

    if ((int)$stmt->fetchColumn() === 0) {
        $passwordHash = password_hash('admin123', PASSWORD_DEFAULT);
        $insert = $pdo->prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')");
        $insert->execute(['admin', $passwordHash]);
    }
}

initializeAuthentication($pdo);

function setUserSession(array $user): void {
    $_SESSION['user_id'] = (int)$user['id'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['role'] = $user['role'];
}

function clearUserSession(): void {
    unset($_SESSION['user_id'], $_SESSION['username'], $_SESSION['role']);
}

function getCurrentUser(): ?array {
    if (!isset($_SESSION['user_id'], $_SESSION['username'], $_SESSION['role'])) {
        return null;
    }

    return [
        'id' => (int)$_SESSION['user_id'],
        'username' => (string)$_SESSION['username'],
        'role' => (string)$_SESSION['role']
    ];
}

function isAdmin(): bool {
    if (!isset($_SESSION['role'])) {
        return false;
    }

    return strcasecmp((string)$_SESSION['role'], 'admin') === 0;
}

// Funcție pentru mesaje JSON
function jsonResponse($data) {
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}
