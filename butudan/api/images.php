<?php
require_once __DIR__ . '/session.php';
requireAuth();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db.php';

try {
    $db = getDB();
    $m  = $_SERVER['REQUEST_METHOD'];

    if ($m === 'GET') {
        $issueId = $_GET['issue_id'] ?? '';
        if (!$issueId) { echo json_encode([]); exit; }
        $stmt = $db->prepare("SELECT * FROM images WHERE issue_id=? ORDER BY created_at ASC");
        $stmt->execute([$issueId]);
        $rows = $stmt->fetchAll();
        echo json_encode(array_map(fn($r) => [
            'id'       => $r['id'],
            'issueId'  => $r['issue_id'],
            'filename' => $r['filename'],
            'url'      => 'uploads/' . $r['filename'],
        ], $rows));

    } elseif ($m === 'DELETE') {
        $id   = $_GET['id'] ?? '';
        $stmt = $db->prepare("SELECT filename FROM images WHERE id=?");
        $stmt->execute([$id]);
        $row  = $stmt->fetch();
        if ($row) {
            $path = __DIR__ . '/../uploads/' . $row['filename'];
            if (file_exists($path)) unlink($path);
            $db->prepare("DELETE FROM images WHERE id=?")->execute([$id]);
        }
        echo json_encode(['ok' => true]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
