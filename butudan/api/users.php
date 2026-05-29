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
        echo json_encode($db->query("SELECT * FROM users ORDER BY name")->fetchAll());

    } elseif ($m === 'PUT') {
        $db->prepare("UPDATE users SET role=? WHERE id=?")
           ->execute([$d['role']??'', $d['id']]);
        echo json_encode(['ok'=>true]);

    } elseif ($m === 'POST') {
        $id = uniqid('u', true);
        $db->prepare("INSERT INTO users (id,name,login_id,role) VALUES(?,?,?,?)")
           ->execute([$id, $d['name']??'', $d['loginId']??'', $d['role']??'編集者']);
        $s = $db->prepare("SELECT * FROM users WHERE id=?"); $s->execute([$id]);
        echo json_encode($s->fetch());

    } elseif ($m === 'DELETE') {
        $db->prepare("DELETE FROM users WHERE id=?")->execute([$_GET['id']??'']);
        echo json_encode(['ok'=>true]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error'=>$e->getMessage()]);
}
