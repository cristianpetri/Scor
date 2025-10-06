<?php
require_once 'config.php';

// Adaugă echipă
function addTeam($name) {
    global $pdo;
    $stmt = $pdo->prepare("INSERT INTO teams (name) VALUES (?)");
    return $stmt->execute([$name]);
}

// Obține toate echipele și calculează clasamentul conform criteriilor
function getTeams() {
    global $pdo;

    $stmt = $pdo->query("SELECT * FROM teams");
    $teams = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($teams as &$team) {
        $team['wins'] = (int)$team['wins'];
        $team['losses'] = (int)$team['losses'];
        $team['sets_won'] = (int)$team['sets_won'];
        $team['sets_lost'] = (int)$team['sets_lost'];
        $team['points_won'] = (int)$team['points_won'];
        $team['points_lost'] = (int)$team['points_lost'];

        $team['ranking_points'] = ($team['wins'] * 2) + $team['losses'];

        $team['set_ratio_value'] = $team['sets_lost'] > 0
            ? $team['sets_won'] / $team['sets_lost']
            : ($team['sets_won'] > 0 ? PHP_FLOAT_MAX : 0);

        $team['point_ratio_value'] = $team['points_lost'] > 0
            ? $team['points_won'] / $team['points_lost']
            : ($team['points_won'] > 0 ? PHP_FLOAT_MAX : 0);

        if ($team['sets_won'] === 0 && $team['sets_lost'] === 0) {
            $team['set_ratio_display'] = '0.00';
        } elseif ($team['sets_lost'] === 0) {
            $team['set_ratio_display'] = '∞';
        } else {
            $team['set_ratio_display'] = number_format($team['set_ratio_value'], 2);
        }

        if ($team['points_won'] === 0 && $team['points_lost'] === 0) {
            $team['point_ratio_display'] = '0.00';
        } elseif ($team['points_lost'] === 0) {
            $team['point_ratio_display'] = '∞';
        } else {
            $team['point_ratio_display'] = number_format($team['point_ratio_value'], 2);
        }
    }
    unset($team);

    usort($teams, function ($a, $b) {
        return ($b['ranking_points'] <=> $a['ranking_points'])
            ?: ($b['set_ratio_value'] <=> $a['set_ratio_value'])
            ?: ($b['point_ratio_value'] <=> $a['point_ratio_value'])
            ?: (($b['sets_won'] - $b['sets_lost']) <=> ($a['sets_won'] - $a['sets_lost']))
            ?: (($b['points_won'] - $b['points_lost']) <=> ($a['points_won'] - $a['points_lost']))
            ?: strcasecmp($a['name'], $b['name']);
    });

    foreach ($teams as &$team) {
        unset($team['set_ratio_value'], $team['point_ratio_value']);
    }
    unset($team);

    return $teams;
}

// Șterge echipă
function deleteTeam($id) {
    global $pdo;
    $stmt = $pdo->prepare("DELETE FROM teams WHERE id = ?");
    return $stmt->execute([$id]);
}

// Generează meciuri (fiecare cu fiecare) respectând regula pauzei între meciuri
function generateMatches($format = 3) {
    global $pdo;

    $teams = getTeams();
    if (count($teams) < 2) {
        return [
            'success' => false,
            'message' => 'Ai nevoie de cel puțin două echipe pentru a genera meciuri.'
        ];
    }

    $scheduleData = buildTournamentSchedule(array_column($teams, 'id'));

    // Șterge meciurile existente
    $pdo->exec("DELETE FROM matches");
    $pdo->exec("DELETE FROM match_sets");
    $pdo->exec("DELETE FROM match_points");

    $order = 1;
    $insertStmt = $pdo->prepare("INSERT INTO matches (team1_id, team2_id, match_order, match_format) VALUES (?, ?, ?, ?)");

    foreach ($scheduleData['matches'] as $match) {
        $insertStmt->execute([$match[0], $match[1], $order, $format]);
        $order++;
    }

    return [
        'success' => true,
        'warning' => $scheduleData['warning']
    ];
}

// Construiește programul de meciuri cu restricția pauzei între partide consecutive
function buildTournamentSchedule(array $teamIds) {
    $rounds = createRoundRobinRounds($teamIds);
    $ordered = flattenRoundsWithRest($rounds);

    $allMatches = [];
    foreach ($rounds as $round) {
        foreach ($round as $match) {
            $allMatches[] = $match;
        }
    }

    if ($ordered !== null) {
        return [
            'matches' => $ordered,
            'warning' => null
        ];
    }

    $teamCount = count($teamIds);
    $warning = 'Nu a fost posibil să se respecte complet regula pauzei între meciuri pentru toate echipele.';
    if ($teamCount < 5) {
        $warning .= ' Sunt necesare cel puțin cinci echipe pentru aplicarea regulii.';
    }

    return [
        'matches' => $allMatches,
        'warning' => $warning
    ];
}

function createRoundRobinRounds(array $teamIds) {
    $teamIds = array_values($teamIds);
    if (count($teamIds) % 2 === 1) {
        $teamIds[] = null; // Echipa "bye"
    }

    $numTeams = count($teamIds);
    $roundsCount = $numTeams - 1;
    $half = $numTeams / 2;
    $rounds = [];

    for ($round = 0; $round < $roundsCount; $round++) {
        $roundMatches = [];
        for ($i = 0; $i < $half; $i++) {
            $team1 = $teamIds[$i];
            $team2 = $teamIds[$numTeams - 1 - $i];

            if ($team1 === null || $team2 === null) {
                continue;
            }

            $roundMatches[] = [$team1, $team2];
        }

        $rounds[] = $roundMatches;

        $fixed = $teamIds[0];
        $rotating = array_slice($teamIds, 1);
        array_unshift($rotating, array_pop($rotating));
        $teamIds = array_merge([$fixed], $rotating);
    }

    return $rounds;
}

function flattenRoundsWithRest(array $rounds) {
    $schedule = [];
    $previousTeams = [];

    foreach ($rounds as $round) {
        $roundOrder = [];
        $available = $round;
        $localPrevious = $previousTeams;

        while (!empty($available)) {
            $pickedIndex = null;

            foreach ($available as $idx => $match) {
                if (!array_intersect($match, $localPrevious)) {
                    $pickedIndex = $idx;
                    break;
                }
            }

            if ($pickedIndex === null) {
                return null;
            }

            $match = $available[$pickedIndex];
            $roundOrder[] = $match;
            $localPrevious = $match;
            unset($available[$pickedIndex]);
            $available = array_values($available);
        }

        if (!empty($roundOrder)) {
            $schedule = array_merge($schedule, $roundOrder);
            $previousTeams = end($roundOrder);
        }
    }

    return $schedule;
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

// Marchează un meci ca început
function startMatchById($matchId) {
    global $pdo;

    $stmt = $pdo->prepare("SELECT status FROM matches WHERE id = ?");
    $stmt->execute([$matchId]);
    $status = $stmt->fetchColumn();

    if ($status === false) {
        return [
            'success' => false,
            'message' => 'Meciul selectat nu există.'
        ];
    }

    if ($status === 'completed') {
        return [
            'success' => false,
            'message' => 'Meciul este deja încheiat.'
        ];
    }

    $pdo->prepare("UPDATE matches SET status = 'live' WHERE id = ?")
        ->execute([$matchId]);

    return ['success' => true];
}

// Adaugă punct
function addPoint($matchId, $scorer) {
    global $pdo;

    if (!in_array($scorer, ['team1', 'team2'], true)) {
        return ['success' => false, 'message' => 'Marcator invalid.'];
    }

    $stmt = $pdo->prepare("SELECT * FROM matches WHERE id = ?");
    $stmt->execute([$matchId]);
    $match = $stmt->fetch();

    if (!$match) {
        return ['success' => false, 'message' => 'Meciul nu există.'];
    }

    if ($match['status'] === 'completed') {
        return ['success' => false, 'message' => 'Meciul este deja încheiat.'];
    }

    if ($match['status'] === 'pending') {
        $pdo->prepare("UPDATE matches SET status = 'live' WHERE id = ?")
            ->execute([$matchId]);
        $match['status'] = 'live';
    }

    $match['sets_team1'] = (int)$match['sets_team1'];
    $match['sets_team2'] = (int)$match['sets_team2'];
    $currentSet = $match['sets_team1'] + $match['sets_team2'] + 1;

    $stmt = $pdo->prepare("SELECT * FROM match_sets WHERE match_id = ? AND set_number = ?");
    $stmt->execute([$matchId, $currentSet]);
    $set = $stmt->fetch();

    if (!$set) {
        $pdo->prepare("INSERT INTO match_sets (match_id, set_number) VALUES (?, ?)")
            ->execute([$matchId, $currentSet]);
        $stmt->execute([$matchId, $currentSet]);
        $set = $stmt->fetch();
    }

    $newScoreTeam1 = (int)$set['score_team1'];
    $newScoreTeam2 = (int)$set['score_team2'];

    if ($scorer === 'team1') {
        $newScoreTeam1++;
    } else {
        $newScoreTeam2++;
    }

    $pointNumberStmt = $pdo->prepare("SELECT COUNT(*) FROM match_points WHERE match_id = ? AND set_number = ?");
    $pointNumberStmt->execute([$matchId, $currentSet]);
    $pointNumber = (int)$pointNumberStmt->fetchColumn() + 1;

    $pdo->prepare("INSERT INTO match_points (match_id, set_number, point_number, scorer, score_team1, score_team2) VALUES (?, ?, ?, ?, ?, ?)")
        ->execute([$matchId, $currentSet, $pointNumber, $scorer, $newScoreTeam1, $newScoreTeam2]);

    $pdo->prepare("UPDATE match_sets SET score_team1 = ?, score_team2 = ?, winner = NULL, completed_at = NULL WHERE id = ?")
        ->execute([$newScoreTeam1, $newScoreTeam2, $set['id']]);

    $isDecisive = ($currentSet === (int)$match['match_format']);
    $targetScore = $isDecisive ? 15 : 25;

    if ((($newScoreTeam1 >= $targetScore) || ($newScoreTeam2 >= $targetScore)) && abs($newScoreTeam1 - $newScoreTeam2) >= 2) {
        $setWinner = $newScoreTeam1 > $newScoreTeam2 ? 'team1' : 'team2';
        $pdo->prepare("UPDATE match_sets SET winner = ?, completed_at = NOW() WHERE id = ?")
            ->execute([$setWinner, $set['id']]);

        if ($setWinner === 'team1') {
            $match['sets_team1']++;
        } else {
            $match['sets_team2']++;
        }

        $pdo->prepare("UPDATE matches SET sets_team1 = ?, sets_team2 = ? WHERE id = ?")
            ->execute([$match['sets_team1'], $match['sets_team2'], $matchId]);

        $setsToWin = (int)ceil($match['match_format'] / 2);
        if ($match['sets_team1'] >= $setsToWin || $match['sets_team2'] >= $setsToWin) {
            $winnerId = $match['sets_team1'] >= $setsToWin ? $match['team1_id'] : $match['team2_id'];
            $pdo->prepare("UPDATE matches SET status = 'completed', winner_id = ?, completed_at = NOW() WHERE id = ?")
                ->execute([$winnerId, $matchId]);

            updateTeamStats($matchId);
        }
    }

    return ['success' => true];
}

function removeLastPoint($matchId) {
    global $pdo;

    $stmt = $pdo->prepare("SELECT * FROM matches WHERE id = ?");
    $stmt->execute([$matchId]);
    $match = $stmt->fetch();

    if (!$match) {
        return ['success' => false, 'message' => 'Meciul nu există.'];
    }

    if ($match['status'] === 'completed') {
        return ['success' => false, 'message' => 'Nu poți modifica un meci deja încheiat.'];
    }

    $lastPointStmt = $pdo->prepare("SELECT * FROM match_points WHERE match_id = ? ORDER BY set_number DESC, point_number DESC LIMIT 1");
    $lastPointStmt->execute([$matchId]);
    $lastPoint = $lastPointStmt->fetch();

    if (!$lastPoint) {
        return ['success' => false, 'message' => 'Nu există puncte de șters.'];
    }

    $pdo->prepare("DELETE FROM match_points WHERE id = ?")
        ->execute([$lastPoint['id']]);

    $setStmt = $pdo->prepare("SELECT * FROM match_sets WHERE match_id = ? AND set_number = ?");
    $setStmt->execute([$matchId, $lastPoint['set_number']]);
    $setRow = $setStmt->fetch();

    $pointsStmt = $pdo->prepare("SELECT * FROM match_points WHERE match_id = ? AND set_number = ? ORDER BY point_number");
    $pointsStmt->execute([$matchId, $lastPoint['set_number']]);
    $remainingPoints = $pointsStmt->fetchAll();

    if (!$remainingPoints) {
        if ($setRow) {
            $pdo->prepare("DELETE FROM match_sets WHERE id = ?")
                ->execute([$setRow['id']]);
        }
    } else {
        $lastSetPoint = end($remainingPoints);
        $scoreTeam1 = (int)$lastSetPoint['score_team1'];
        $scoreTeam2 = (int)$lastSetPoint['score_team2'];
        $isDecisive = ((int)$lastPoint['set_number'] === (int)$match['match_format']);
        $targetScore = $isDecisive ? 15 : 25;

        $winner = null;
        $completedAt = null;

        if ((($scoreTeam1 >= $targetScore) || ($scoreTeam2 >= $targetScore)) && abs($scoreTeam1 - $scoreTeam2) >= 2) {
            $winner = $scoreTeam1 > $scoreTeam2 ? 'team1' : 'team2';
            $completedAt = $setRow ? $setRow['completed_at'] : $lastSetPoint['created_at'];
        }

        if ($setRow) {
            $pdo->prepare("UPDATE match_sets SET score_team1 = ?, score_team2 = ?, winner = ?, completed_at = ? WHERE id = ?")
                ->execute([$scoreTeam1, $scoreTeam2, $winner, $winner ? $completedAt : null, $setRow['id']]);
        } else {
            $pdo->prepare("INSERT INTO match_sets (match_id, set_number, score_team1, score_team2, winner, completed_at) VALUES (?, ?, ?, ?, ?, ?)")
                ->execute([$matchId, $lastPoint['set_number'], $scoreTeam1, $scoreTeam2, $winner, $winner ? $completedAt : null]);
        }
    }

    $setsStmt = $pdo->prepare("SELECT * FROM match_sets WHERE match_id = ? ORDER BY set_number");
    $setsStmt->execute([$matchId]);
    $allSets = $setsStmt->fetchAll();

    $setsTeam1 = 0;
    $setsTeam2 = 0;
    $lastCompletedAt = null;

    foreach ($allSets as $setData) {
        if ($setData['winner'] === 'team1') {
            $setsTeam1++;
            if ($setData['completed_at']) {
                $lastCompletedAt = $setData['completed_at'];
            }
        } elseif ($setData['winner'] === 'team2') {
            $setsTeam2++;
            if ($setData['completed_at']) {
                $lastCompletedAt = $setData['completed_at'];
            }
        }
    }

    $pointsCountStmt = $pdo->prepare("SELECT COUNT(*) FROM match_points WHERE match_id = ?");
    $pointsCountStmt->execute([$matchId]);
    $remainingPointsCount = (int)$pointsCountStmt->fetchColumn();

    $setsToWin = (int)ceil($match['match_format'] / 2);
    $status = ($match['status'] === 'pending' && $remainingPointsCount === 0) ? 'pending' : 'live';
    $winnerId = null;
    $completedAt = null;

    if ($setsTeam1 >= $setsToWin || $setsTeam2 >= $setsToWin) {
        $status = 'completed';
        $winnerId = $setsTeam1 >= $setsToWin ? $match['team1_id'] : $match['team2_id'];
        $completedAt = $lastCompletedAt;
    }

    if ($status !== 'completed') {
        $winnerId = null;
        $completedAt = null;
    }

    $pdo->prepare("UPDATE matches SET sets_team1 = ?, sets_team2 = ?, status = ?, winner_id = ?, completed_at = ? WHERE id = ?")
        ->execute([$setsTeam1, $setsTeam2, $status, $winnerId, $completedAt, $matchId]);

    return ['success' => true];
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
