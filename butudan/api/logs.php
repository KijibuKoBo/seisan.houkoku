<?php
require_once __DIR__ . '/session.php';
requireAuth();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db.php';

try {
    $db = getDB();
    $m  = $_SERVER['REQUEST_METHOD'];

    if ($m === 'GET') {
        $limit = min((int)($_GET['limit'] ?? 100), 500);
        $rows  = $db->prepare("SELECT * FROM logs ORDER BY created_at DESC LIMIT ?");
        $rows->execute([$limit]);
        echo json_encode($rows->fetchAll());

    } elseif ($m === 'POST') {
        $d  = json_decode(file_get_contents('php://input'), true);
        $id = uniqid('log', true);
        $db->prepare("INSERT INTO logs (id, user_name, action, target_type, target_label, detail) VALUES(?,?,?,?,?,?)")
           ->execute([
               $id,
               $d['userName']    ?? '',
               $d['action']      ?? '',
               $d['targetType']  ?? '',
               $d['targetLabel'] ?? '',
               $d['detail']      ?? '',
           ]);
        echo json_encode(['ok' => true]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
