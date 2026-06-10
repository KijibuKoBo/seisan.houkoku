<?php
require_once __DIR__ . '/session.php';
requireAuth();
header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
require_once __DIR__ . '/db.php';

function rowToIssue($r) {
    return [
        'id'                   => $r['id'],
        'lotId'                => $r['lot_id'],
        'productId'            => $r['product_id'],
        'lotNumber'            => (int)$r['lot_number'],
        'description'          => $r['description'],
        'partId'               => $r['part_id'],
        'cause'                => $r['cause'],
        'improvement'          => $r['improvement'],
        'status'               => $r['status'],
        'priority'             => $r['priority'],
        'isImportant'          => (bool)$r['is_important'],
        'isRecurrencePrevented'=> (bool)$r['is_recurrence_prevented'],
        'assignee'             => $r['assignee'],
        'date'                 => $r['date'],
    ];
}

try {
    $db = getDB();
    $m  = $_SERVER['REQUEST_METHOD'];
    $d  = in_array($m, ['POST','PUT']) ? json_decode(file_get_contents('php://input'), true) : [];

    if ($m === 'GET') {
        $rows = $db->query("SELECT * FROM issues ORDER BY date DESC")->fetchAll();
        echo json_encode(array_map('rowToIssue', $rows));

    } elseif ($m === 'POST') {
        $id = uniqid('i', true);
        $db->prepare("INSERT INTO issues (id,lot_id,product_id,lot_number,description,part_id,cause,improvement,status,priority,is_important,is_recurrence_prevented,assignee,date) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
           ->execute([$id, $d['lotId']??null, $d['productId']??null, (int)($d['lotNumber']??0),
                      $d['description']??'', $d['partId']??'', $d['cause']??'', $d['improvement']??'',
                      $d['status']??'調査中', $d['priority']??'中',
                      (int)(bool)($d['isImportant']??false),
                      (int)(bool)($d['isRecurrencePrevented']??false),
                      $d['assignee']??'', $d['date']??date('Y-m-d')]);
        $s = $db->prepare("SELECT * FROM issues WHERE id=?"); $s->execute([$id]);
        echo json_encode(rowToIssue($s->fetch()));

    } elseif ($m === 'PUT') {
        $db->prepare("UPDATE issues SET description=?,part_id=?,cause=?,improvement=?,status=?,priority=?,is_important=?,is_recurrence_prevented=?,assignee=? WHERE id=?")
           ->execute([$d['description']??'', $d['partId']??'', $d['cause']??'', $d['improvement']??'',
                      $d['status']??'調査中', $d['priority']??'中',
                      (int)(bool)($d['isImportant']??false),
                      (int)(bool)($d['isRecurrencePrevented']??false),
                      $d['assignee']??'', $d['id']]);
        echo json_encode(['ok'=>true]);

    } elseif ($m === 'DELETE') {
        $id = $_GET['id'] ?? '';
        // 添付画像も削除（imagesテーブル未作成の環境では何もしない）
        try {
            $stmt = $db->prepare("SELECT filename FROM images WHERE issue_id=?");
            $stmt->execute([$id]);
            foreach ($stmt->fetchAll() as $img) {
                $path = __DIR__ . '/../uploads/' . $img['filename'];
                if (file_exists($path)) unlink($path);
            }
            $db->prepare("DELETE FROM images WHERE issue_id=?")->execute([$id]);
        } catch (Exception $e) {}
        $db->prepare("DELETE FROM issues WHERE id=?")->execute([$id]);
        echo json_encode(['ok'=>true]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error'=>$e->getMessage()]);
}
