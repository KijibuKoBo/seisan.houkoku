<?php
header('Content-Type: application/json; charset=utf-8');
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
