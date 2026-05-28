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
        echo json_encode($db->query("SELECT * FROM parts ORDER BY name")->fetchAll());

    } elseif ($m === 'POST') {
        $id = uniqid('pt', true);
        $db->prepare("INSERT INTO parts (id,name,category) VALUES(?,?,?)")
           ->execute([$id, $d['name']??'', $d['category']??'']);
        $s = $db->prepare("SELECT * FROM parts WHERE id=?"); $s->execute([$id]);
        echo json_encode($s->fetch());

    } elseif ($m === 'DELETE') {
        $db->prepare("DELETE FROM parts WHERE id=?")->execute([$_GET['id']??'']);
        echo json_encode(['ok'=>true]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error'=>$e->getMessage()]);
}
