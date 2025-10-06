<?php
require_once 'config.php';

// Adaugă echipă
function addTeam($name) {
    global $pdo;
    $stmt = $pdo->prepare("INSERT INTO teams (name) VALUES (?)");
    return $stmt->execute([$name]);
}

// Obține toate echipele
function getTeams() {
    global $pdo;
    return $pdo->query("SELECT * FROM teams ORDER BY wins DESC, (sets_won - sets_lost) DESC")->fetchAll();
}

// Șterge echipă
function deleteTeam($id) {
    global $pdo;
    $stmt = $pdo->prepare("DELETE FROM teams WHERE id = ?");
    return $stmt->execute([$id]);
}

// Generează meciuri (fiecare cu fiecare)
function generateMatches($format = 3) {
    global $pdo;
    
    // Șterge meciurile existente
    $pdo->exec("DELETE FROM matches");
    $pdo->exec("DELETE FROM match_sets");
    $pdo->exec("DELETE FROM match_points");
    
    $teams = getTeams();
    $order = 1;
    
    for ($i = 0; $i < count($teams); $i++) {
        for ($j = $i + 1; $j < count($teams); $j++) {
            $stmt = $pdo->prepare("INSERT INTO matches (team1_id, team2_id, match_order, match_format) VALUES (?, ?, ?, ?)");
            $stmt->execute([$teams[$i]['id'], $teams[$j]['id'], $order, $format]);
            $order++;
        }
    }
    
    return true;
}

// Obține meciuri
function getMatches() {
    global $pdo;
    $stmt = $pdo->query("
        SELECT m.*, 
               t1.name as team1_name, 
               t2.name as team2_name,
               tw.name as winner_name
        FROM matches m
        JOIN teams t1 ON m.team1_id = t1.id
        JOIN teams t2 ON m.team2_id = t2.id
        LEFT JOIN teams tw ON m.winner_id = tw.id
        ORDER BY m.match_order
    ");
    return $stmt->fetchAll();
}

// Actualizează ordinea meciurilor
function updateMatchOrder($matchId, $newOrder) {
    global $pdo;
    
    // Obține ordinea actuală
    $stmt = $pdo->prepare("SELECT match_order FROM matches WHERE id = ?");
    $stmt->execute([$matchId]);
    $currentOrder = $stmt->fetchColumn();
    
    if ($currentOrder < $newOrder) {
        // Mută în jos
        $pdo->prepare("UPDATE matches SET match_order = match_order - 1 WHERE match_order > ? AND match_order <= ?")->execute([$currentOrder, $newOrder]);
    } else {
        // Mută în sus
        $pdo->prepare("UPDATE matches SET match_order = match_order + 1 WHERE match_order >= ? AND match_order < ?")->execute([$newOrder, $currentOrder]);
    }
    
    // Actualizează meciul curent
    $stmt = $pdo->prepare("UPDATE matches SET match_order = ? WHERE id = ?");
    return $stmt->execute([$newOrder, $matchId]);
}

// Adaugă punct
function addPoint($matchId, $scorer) {
    global $pdo;
    
    // Obține meciul
    $stmt = $pdo->prepare("SELECT * FROM matches WHERE id = ?");
    $stmt->execute([$matchId]);
    $match = $stmt->fetch();
    
    $currentSet = $match['sets_team1'] + $match['sets_team2'] + 1;
    
    // Obține sau creează setul curent
    $stmt = $pdo->prepare("SELECT * FROM match_sets WHERE match_id = ? AND set_number = ?");
    $stmt->execute([$matchId, $currentSet]);
    $set = $stmt->fetch();
    
    if (!$set) {
        $pdo->prepare("INSERT INTO match_sets (match_id, set_number) VALUES (?, ?)")->execute([$matchId, $currentSet]);
        $stmt->execute([$matchId, $currentSet]);
        $set = $stmt->fetch();
    }
    
    // Adaugă punctul
    $newScoreTeam1 = $set['score_team1'];
    $newScoreTeam2 = $set['score_team2'];
    
    if ($scorer === 'team1') {
        $newScoreTeam1++;
    } else {
        $newScoreTeam2++;
    }
    
    // Salvează punctul în istoric
    $pointNumber = $pdo->query("SELECT COUNT(*) FROM match_points WHERE match_id = $matchId AND set_number = $currentSet")->fetchColumn() + 1;
    $pdo->prepare("INSERT INTO match_points (match_id, set_number, point_number, scorer, score_team1, score_team2) VALUES (?, ?, ?, ?, ?, ?)")
        ->execute([$matchId, $currentSet, $pointNumber, $scorer, $newScoreTeam1, $newScoreTeam2]);
    
    // Actualizează scorul setului
    $pdo->prepare("UPDATE match_sets SET score_team1 = ?, score_team2 = ? WHERE id = ?")
        ->execute([$newScoreTeam1, $newScoreTeam2, $set['id']]);
    
    // Verifică dacă setul s-a terminat
    $isDecisive = ($match['sets_team1'] == 2 && $match['sets_team2'] == 2);
    $targetScore = $isDecisive ? 15 : 25;
    
    if (($newScoreTeam1 >= $targetScore || $newScoreTeam2 >= $targetScore) && abs($newScoreTeam1 - $newScoreTeam2) >= 2) {
        $setWinner = $newScoreTeam1 > $newScoreTeam2 ? 'team1' : 'team2';
        $pdo->prepare("UPDATE match_sets SET winner = ?, completed_at = NOW() WHERE id = ?")
            ->execute([$setWinner, $set['id']]);
        
        // Actualizează scorul meciului
        if ($setWinner === 'team1') {
            $match['sets_team1']++;
        } else {
            $match['sets_team2']++;
        }
        
        $pdo->prepare("UPDATE matches SET sets_team1 = ?, sets_team2 = ? WHERE id = ?")
            ->execute([$match['sets_team1'], $match['sets_team2'], $matchId]);
        
        // Verifică dacă meciul s-a terminat
        $setsToWin = ceil($match['match_format'] / 2);
        if ($match['sets_team1'] >= $setsToWin || $match['sets_team2'] >= $setsToWin) {
            $winnerId = $match['sets_team1'] >= $setsToWin ? $match['team1_id'] : $match['team2_id'];
            $pdo->prepare("UPDATE matches SET status = 'completed', winner_id = ?, completed_at = NOW() WHERE id = ?")
                ->execute([$winnerId, $matchId]);
            
            // Actualizează statistici echipe
            updateTeamStats($matchId);
        }
    }
    
    return true;
}

// Actualizează statistici echipe
function updateTeamStats($matchId) {
    global $pdo;
    
    $match = $pdo->prepare("SELECT * FROM matches WHERE id = ?");
    $match->execute([$matchId]);
    $match = $match->fetch();
    
    $sets = $pdo->prepare("SELECT * FROM match_sets WHERE match_id = ?");
    $sets->execute([$matchId]);
    $sets = $sets->fetchAll();
    
    $pointsTeam1 = 0;
    $pointsTeam2 = 0;
    
    foreach ($sets as $set) {
        $pointsTeam1 += $set['score_team1'];
        $pointsTeam2 += $set['score_team2'];
    }
    
    // Actualizează echipa 1
    $isWinner1 = $match['winner_id'] == $match['team1_id'];
    $pdo->prepare("UPDATE teams SET wins = wins + ?, losses = losses + ?, sets_won = sets_won + ?, sets_lost = sets_lost + ?, points_won = points_won + ?, points_lost = points_lost + ? WHERE id = ?")
        ->execute([
            $isWinner1 ? 1 : 0,
            $isWinner1 ? 0 : 1,
            $match['sets_team1'],
            $match['sets_team2'],
            $pointsTeam1,
            $pointsTeam2,
            $match['team1_id']
        ]);
    
    // Actualizează echipa 2
    $isWinner2 = $match['winner_id'] == $match['team2_id'];
    $pdo->prepare("UPDATE teams SET wins = wins + ?, losses = losses + ?, sets_won = sets_won + ?, sets_lost = sets_lost + ?, points_won = points_won + ?, points_lost = points_lost + ? WHERE id = ?")
        ->execute([
            $isWinner2 ? 1 : 0,
            $isWinner2 ? 0 : 1,
            $match['sets_team2'],
            $match['sets_team1'],
            $pointsTeam2,
            $pointsTeam1,
            $match['team2_id']
        ]);
}

// Obține istoric puncte meci
function getMatchPoints($matchId) {
    global $pdo;
    $stmt = $pdo->prepare("SELECT * FROM match_points WHERE match_id = ? ORDER BY set_number, point_number");
    $stmt->execute([$matchId]);
    return $stmt->fetchAll();
}

// Obține seturi meci
function getMatchSets($matchId) {
    global $pdo;
    $stmt = $pdo->prepare("SELECT * FROM match_sets WHERE match_id = ? ORDER BY set_number");
    $stmt->execute([$matchId]);
    return $stmt->fetchAll();
}
?>