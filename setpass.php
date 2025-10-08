<?php
require_once __DIR__ . '/config.php';

$message = '';
$messageType = 'info';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = (string)($_POST['password'] ?? '');
    $confirmPassword = (string)($_POST['confirm_password'] ?? '');

    if ($username === '' || $password === '' || $confirmPassword === '') {
        $message = 'Toate câmpurile sunt obligatorii.';
        $messageType = 'error';
    } elseif ($password !== $confirmPassword) {
        $message = 'Parolele nu coincid.';
        $messageType = 'error';
    } elseif (strlen($password) < 8) {
        $message = 'Parola trebuie să conțină cel puțin 8 caractere.';
        $messageType = 'error';
    } else {
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare('UPDATE users SET password_hash = ? WHERE username = ?');
        $stmt->execute([$hash, $username]);

        if ($stmt->rowCount() === 0) {
            $message = 'Utilizatorul specificat nu există.';
            $messageType = 'error';
        } else {
            $message = 'Parola a fost actualizată. Șterge imediat acest fișier de pe server după utilizare.';
            $messageType = 'success';
        }
    }
}
?>
<!DOCTYPE html>
<html lang="ro">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Setare Parolă</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f5f5f5;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
        }
        .container {
            background: #ffffff;
            border-radius: 8px;
            padding: 24px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            max-width: 400px;
            width: 100%;
        }
        h1 {
            margin-top: 0;
            text-align: center;
        }
        .message {
            margin-bottom: 16px;
            padding: 12px;
            border-radius: 4px;
        }
        .message.info { background: #e9f2ff; color: #0c4a6e; }
        .message.error { background: #fee2e2; color: #991b1b; }
        .message.success { background: #dcfce7; color: #14532d; }
        label {
            display: block;
            margin-bottom: 6px;
            font-weight: bold;
        }
        input[type="text"],
        input[type="password"] {
            width: 100%;
            padding: 10px;
            margin-bottom: 12px;
            border: 1px solid #d1d5db;
            border-radius: 4px;
        }
        button {
            width: 100%;
            padding: 10px;
            background-color: #2563eb;
            border: none;
            color: #ffffff;
            font-size: 16px;
            border-radius: 4px;
            cursor: pointer;
        }
        button:hover {
            background-color: #1d4ed8;
        }
        .note {
            margin-top: 16px;
            font-size: 14px;
            color: #555555;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Setare Parolă</h1>
        <?php if ($message !== ''): ?>
            <div class="message <?php echo htmlspecialchars($messageType, ENT_QUOTES, 'UTF-8'); ?>">
                <?php echo htmlspecialchars($message, ENT_QUOTES, 'UTF-8'); ?>
            </div>
        <?php else: ?>
            <div class="message info">
                Completează formularul pentru a actualiza parola unui utilizator. Șterge fișierul după utilizare.
            </div>
        <?php endif; ?>
        <form method="post">
            <label for="username">Utilizator</label>
            <input type="text" id="username" name="username" placeholder="ex: admin" required>

            <label for="password">Parolă nouă</label>
            <input type="password" id="password" name="password" required>

            <label for="confirm_password">Confirmă parola</label>
            <input type="password" id="confirm_password" name="confirm_password" required>

            <button type="submit">Actualizează parola</button>
        </form>
        <p class="note">După schimbare, șterge fișierul <strong>setpass.php</strong> pentru securitate.</p>
    </div>
</body>
</html>
