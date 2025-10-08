CREATE DATABASE IF NOT EXISTS volei_turneu CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE volei_turneu;

CREATE TABLE teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    wins INT DEFAULT 0,
    losses INT DEFAULT 0,
    sets_won INT DEFAULT 0,
    sets_lost INT DEFAULT 0,
    points_won INT DEFAULT 0,
    points_lost INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE matches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team1_id INT NOT NULL,
    team2_id INT NOT NULL,
    match_order INT NOT NULL,
    status ENUM('pending', 'live', 'completed') DEFAULT 'pending',
    winner_id INT NULL,
    sets_team1 INT DEFAULT 0,
    sets_team2 INT DEFAULT 0,
    match_format INT DEFAULT 3,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team1_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (team2_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (winner_id) REFERENCES teams(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE match_sets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    match_id INT NOT NULL,
    set_number INT NOT NULL,
    score_team1 INT DEFAULT 0,
    score_team2 INT DEFAULT 0,
    winner ENUM('team1', 'team2') NULL,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE match_points (
    id INT AUTO_INCREMENT PRIMARY KEY,
    match_id INT NOT NULL,
    set_number INT NOT NULL,
    point_number INT NOT NULL,
    scorer ENUM('team1', 'team2') NOT NULL,
    score_team1 INT NOT NULL,
    score_team2 INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;