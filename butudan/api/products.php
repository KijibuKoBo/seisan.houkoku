<?php
require_once __DIR__ . '/session.php';
requireAuth();
header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
require_once __DIR__ . '/db.php';

function rowToProd($r) {
    return [
        'id'           => $r['id'],
        'name'         => $r['name'],
        'category'     => $r['category'],
        'specMemo'     => $r['spec_memo'],
        'notes'        => $r['notes'],
        'discontinued' => (bool)$r['discontinued'],
    ];
}

try {
    $db = getDB();
    $m  = $_SERVER['REQUEST_METHOD'];
    $d  = in_array($m, ['POST','PUT']) ? json_decode(file_get_contents('php://input'), true) : [];

    if ($m === 'GET') {
        $rows = $db->query("SELECT * FROM products ORDER BY name")->fetchAll();
        echo json_encode(array_map('rowToProd', $rows));

    } elseif ($m === 'POST') {
        $id = uniqid('p', true);
        $db->prepare("INSERT INTO products (id,name,category,spec_memo,notes,discontinued) VALUES(?,?,?,?,?,?)")
           ->execute([$id, $d['name']??'', $d['category']??'仏',
                      $d['specMemo']??'', $d['notes']??'', (int)(bool)($d['discontinued']??false)]);
        $s = $db->prepare("SELECT * FROM products WHERE id=?"); $s->execute([$id]);
        echo json_encode(rowToProd($s->fetch()));

    } elseif ($m === 'PUT') {
        $db->prepare("UPDATE products SET name=?,category=?,spec_memo=?,notes=?,discontinued=? WHERE id=?")
           ->execute([$d['name']??'', $d['category']??'仏',
                      $d['specMemo']??'', $d['notes']??'',
                      (int)(bool)($d['discontinued']??false), $d['id']]);
        echo json_encode(['ok'=>true]);

    } elseif ($m === 'DELETE') {
        $db->prepare("DELETE FROM products WHERE id=?")->execute([$_GET['id']??'']);
        echo json_encode(['ok'=>true]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error'=>$e->getMessage()]);
}
