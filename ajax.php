<?php
require_once 'functions.php';

$action = $_POST['action'] ?? $_GET['action'] ?? '';

$adminActions = [
    'add_team',
    'delete_team',
    'generate_matches',
    'update_match_order',
    'start_match',
    'add_point',
    'remove_last_point'
];

if (in_array($action, $adminActions, true) && !isAdmin()) {
    jsonResponse([
        'success' => false,
        'message' => 'Autentificare de administrator necesară pentru această acțiune.',
        'error' => 'unauthorized'
    ]);
}

switch($action) {
    case 'login':
        $username = trim($_POST['username'] ?? '');
        $password = $_POST['password'] ?? '';

        if ($username === '' || $password === '') {
            jsonResponse([
                'success' => false,
                'message' => 'Completează utilizatorul și parola.'
            ]);
        }

        $result = loginUser($username, $password);
        jsonResponse($result);
        break;

    case 'logout':
        logoutUser();
        jsonResponse(['success' => true]);
        break;

    case 'get_current_user':
        jsonResponse([
            'success' => true,
            'user' => getCurrentUser()
        ]);
        break;

    case 'add_team':
        $name = trim($_POST['name'] ?? '');
        if ($name) {
            addTeam($name);
            jsonResponse(['success' => true, 'teams' => getTeams()]);
        }
        jsonResponse(['success' => false, 'message' => 'Nume invalid']);
        break;
        
    case 'delete_team':
        $id = intval($_POST['id'] ?? 0);
        deleteTeam($id);
        jsonResponse(['success' => true, 'teams' => getTeams()]);
        break;
        
    case 'generate_matches':
        $format = intval($_POST['format'] ?? 3);
        $result = generateMatches($format);

        if (!$result['success']) {
            jsonResponse(['success' => false, 'message' => $result['message'] ?? 'Eroare la generarea meciurilor.']);
        }

        $response = ['success' => true, 'matches' => getMatches()];
        if (!empty($result['warning'])) {
            $response['warning'] = $result['warning'];
        }

        jsonResponse($response);
        break;
        
    case 'get_matches':
        jsonResponse(['matches' => getMatches()]);
        break;
        
    case 'update_match_order':
        $matchId = intval($_POST['match_id'] ?? 0);
        $newOrder = intval($_POST['new_order'] ?? 0);
        updateMatchOrder($matchId, $newOrder);
        jsonResponse(['success' => true, 'matches' => getMatches()]);
        break;

    case 'start_match':
        $matchId = intval($_POST['match_id'] ?? 0);
        $result = startMatchById($matchId);

        if (!$result['success']) {
            jsonResponse(['success' => false, 'message' => $result['message'] ?? 'Nu am putut porni meciul.']);
        }

        jsonResponse(['success' => true]);
        break;

    case 'add_point':
        $matchId = intval($_POST['match_id'] ?? 0);
        $scorer = $_POST['scorer'] ?? '';
        $result = addPoint($matchId, $scorer);
        jsonResponse($result);
        break;

    case 'remove_last_point':
        $matchId = intval($_POST['match_id'] ?? 0);
        $result = removeLastPoint($matchId);
        jsonResponse($result);
        break;

    case 'get_match_details':
        $matchId = intval($_GET['match_id'] ?? 0);
        $stmt = $pdo->prepare("SELECT m.*, t1.name as team1_name, t2.name as team2_name, tw.name as winner_name FROM matches m JOIN teams t1 ON m.team1_id = t1.id JOIN teams t2 ON m.team2_id = t2.id LEFT JOIN teams tw ON m.winner_id = tw.id WHERE m.id = ?");
        $stmt->execute([$matchId]);
        $match = $stmt->fetch();
        $points = getMatchPoints($matchId);
        $sets = getMatchSets($matchId);
        jsonResponse(['match' => $match, 'points' => $points, 'sets' => $sets]);
        break;
        
    case 'get_teams':
        jsonResponse(['teams' => getTeams()]);
        break;

    case 'get_stats':
        $teams = getTeams();
        $matches = getMatchesWithHistory();
        jsonResponse([
            'teams' => $teams,
            'matches' => $matches
        ]);
        break;

    default:
        jsonResponse(['success' => false, 'message' => 'Acțiune invalidă']);
}
