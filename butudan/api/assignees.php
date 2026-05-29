<?php
require_once __DIR__ . '/session.php';
requireAuth();
header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
require_once __DIR__ . '/db.php';

try {
    $db = getDB();
    $m  = $_SERVER['REQUEST_METHOD'];
    $d  = in_array($m, ['POST','PUT']) ? json_decode(file_get_contents('php://input'), true) : [];

    if ($m === 'GET') {
        echo json_encode($db->query("SELECT * FROM assignees ORDER BY sort_order, name")->fetchAll());

    } elseif ($m === 'POST') {
        $id = uniqid('as', true);
        $db->prepare("INSERT INTO assignees (id, name, sort_order) VALUES(?,?,?)")
           ->execute([$id, $d['name']??'', $d['sortOrder']??0]);
        $s = $db->prepare("SELECT * FROM assignees WHERE id=?"); $s->execute([$id]);
        echo json_encode($s->fetch());

    } elseif ($m === 'PUT') {
        $db->prepare("UPDATE assignees SET name=?, sort_order=? WHERE id=?")
           ->execute([$d['name']??'', $d['sortOrder']??0, $d['id']??'']);
        $s = $db->prepare("SELECT * FROM assignees WHERE id=?"); $s->execute([$d['id']]);
        echo json_encode($s->fetch());

    } elseif ($m === 'DELETE') {
        $db->prepare("DELETE FROM assignees WHERE id=?")->execute([$_GET['id']??'']);
        echo json_encode(['ok'=>true]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error'=>$e->getMessage()]);
}
