<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit(0); }

// DB connection test endpoint (no token required — for diagnostics only)
if (isset($_GET['test'])) {
    try {
        $pdo = new PDO(
            'mysql:host=localhost;dbname=spengats_seisankanri;charset=utf8mb4',
            'spengats_kanri',
            'Allmeida24',
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );
        $pdo->exec("CREATE TABLE IF NOT EXISTS app_data (
            `k` VARCHAR(100) PRIMARY KEY,
            `v` LONGTEXT NOT NULL,
            `ts` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $stmt = $pdo->query("SELECT COUNT(*) as cnt FROM app_data");
        $cnt = $stmt->fetch(PDO::FETCH_ASSOC)['cnt'];
        echo json_encode(['db' => 'ok', 'rows' => (int)$cnt]);
    } catch (PDOException $e) {
        echo json_encode(['db' => 'error', 'msg' => $e->getMessage()]);
    }
    exit;
}

$token = $_SERVER['HTTP_X_TOKEN'] ?? '';
if ($token !== 'mtsng_api_2024') {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden']);
    exit;
}

try {
    $pdo = new PDO(
        'mysql:host=localhost;dbname=spengats_seisankanri;charset=utf8mb4',
        'spengats_kanri',
        'Allmeida24',
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
    exit;
}

$pdo->exec("CREATE TABLE IF NOT EXISTS app_data (
    `k` VARCHAR(100) PRIMARY KEY,
    `v` LONGTEXT NOT NULL,
    `ts` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$pdo->exec("CREATE TABLE IF NOT EXISTS change_log (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user` VARCHAR(100) NOT NULL,
    `year` SMALLINT NOT NULL,
    `month` TINYINT NOT NULL,
    `summary` TEXT NOT NULL,
    `ts` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ym (`year`, `month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Change log endpoint
    if (isset($_GET['log'])) {
        $stmt = $pdo->query("SELECT id, user, year, month, summary, ts FROM change_log ORDER BY ts DESC LIMIT 200");
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
        exit;
    }
    $key = $_GET['key'] ?? null;
    if ($key) {
        $stmt = $pdo->prepare("SELECT v FROM app_data WHERE k = ?");
        $stmt->execute([$key]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        echo $row ? $row['v'] : 'null';
    } else {
        $stmt = $pdo->query("SELECT k, v FROM app_data");
        $all = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $all[$row['k']] = $row['v'];
        }
        echo json_encode($all);
    }
} elseif ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);

    // Change log insert
    if (($body['action'] ?? '') === 'log') {
        $stmt = $pdo->prepare(
            "INSERT INTO change_log (user, year, month, summary) VALUES (?, ?, ?, ?)"
        );
        $stmt->execute([
            $body['user']    ?? '不明',
            (int)($body['year']  ?? 0),
            (int)($body['month'] ?? 0),
            $body['summary'] ?? '',
        ]);
        echo json_encode(['ok' => true]);
        exit;
    }

    $key  = $body['key']   ?? '';
    $value = $body['value'] ?? '';
    if (!$key) {
        http_response_code(400);
        echo json_encode(['error' => 'key required']);
        exit;
    }
    $stmt = $pdo->prepare(
        "INSERT INTO app_data (k, v) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE v = VALUES(v)"
    );
    $stmt->execute([$key, $value]);
    echo json_encode(['ok' => true]);
}
