<?php
require_once __DIR__ . '/session.php';
requireAuth();
header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
require_once __DIR__ . '/db.php';

function rowToLot($r) {
    return [
        'id'           => $r['id'],
        'lotNumber'    => (int)$r['lot_number'],
        'productId'    => $r['product_id'],
        'startDate'    => $r['start_date'],
        'shipDate'     => $r['ship_date'],
        'woodDate'     => $r['wood_date'],
        'paintDate'    => $r['paint_date'],
        'destination'  => $r['destination'],
        'assignee'     => $r['assignee'],
        'status'       => $r['status'],
        'hasSpecChange'=> (bool)$r['has_spec_change'],
    ];
}

try {
    $db  = getDB();
    $m   = $_SERVER['REQUEST_METHOD'];
    $d   = in_array($m, ['POST','PUT']) ? json_decode(file_get_contents('php://input'), true) : [];

    if ($m === 'GET') {
        $rows = $db->query("SELECT * FROM lots ORDER BY lot_number DESC")->fetchAll();
        echo json_encode(array_map('rowToLot', $rows));

    } elseif ($m === 'POST') {
        $id = uniqid('l', true);
        $db->prepare("INSERT INTO lots (id,lot_number,product_id,start_date,ship_date,wood_date,paint_date,destination,assignee,status,has_spec_change) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
           ->execute([$id, (int)($d['lotNumber']??0), $d['productId']??null,
                      $d['startDate']?:null, $d['shipDate']?:null,
                      $d['woodDate']?:null,  $d['paintDate']?:null,
                      $d['destination']??'', $d['assignee']??'',
                      $d['status']??'制作中', (int)(bool)($d['hasSpecChange']??false)]);
        $s = $db->prepare("SELECT * FROM lots WHERE id=?"); $s->execute([$id]);
        echo json_encode(rowToLot($s->fetch()));

    } elseif ($m === 'PUT') {
        $db->prepare("UPDATE lots SET lot_number=?,product_id=?,start_date=?,ship_date=?,wood_date=?,paint_date=?,destination=?,assignee=?,status=?,has_spec_change=? WHERE id=?")
           ->execute([(int)($d['lotNumber']??0), $d['productId']??null,
                      $d['startDate']?:null, $d['shipDate']?:null,
                      $d['woodDate']?:null,  $d['paintDate']?:null,
                      $d['destination']??'', $d['assignee']??'',
                      $d['status']??'制作中', (int)(bool)($d['hasSpecChange']??false), $d['id']]);
        echo json_encode(['ok'=>true]);

    } elseif ($m === 'DELETE') {
        $db->prepare("DELETE FROM lots WHERE id=?")->execute([$_GET['id']??'']);
        echo json_encode(['ok'=>true]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error'=>$e->getMessage()]);
}
