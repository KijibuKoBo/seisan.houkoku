<?php
require_once __DIR__ . '/session.php';
requireAuth();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db.php';

$uploadDir = __DIR__ . '/../uploads/';
if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

// imagesテーブル自動作成
$flagFile = __DIR__ . '/../setup/images_table.flag';
try {
    $db = getDB();
    if (!file_exists($flagFile)) {
        $db->exec("CREATE TABLE IF NOT EXISTS images (
            id         VARCHAR(50)  PRIMARY KEY,
            issue_id   VARCHAR(50)  NOT NULL,
            filename   VARCHAR(200) NOT NULL,
            created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        file_put_contents($flagFile, date('Y-m-d H:i:s'));
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$issueId = $_POST['issue_id'] ?? '';
if (!$issueId) {
    http_response_code(400);
    echo json_encode(['error' => 'issue_id is required']);
    exit;
}

if (empty($_FILES['image'])) {
    http_response_code(400);
    echo json_encode(['error' => 'No file uploaded']);
    exit;
}

$file = $_FILES['image'];
if ($file['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['error' => 'Upload error: ' . $file['error']]);
    exit;
}

// ファイルタイプチェック
$allowed = ['image/jpeg','image/png','image/gif','image/webp','image/heic','image/heif'];
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime  = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);
if (!in_array($mime, $allowed)) {
    http_response_code(400);
    echo json_encode(['error' => '画像ファイル(JPG/PNG/GIF/WEBP)のみアップロードできます']);
    exit;
}

// ファイルサイズ制限（10MB）
if ($file['size'] > 10 * 1024 * 1024) {
    http_response_code(400);
    echo json_encode(['error' => 'ファイルサイズは10MB以下にしてください']);
    exit;
}

$ext      = pathinfo($file['name'], PATHINFO_EXTENSION) ?: 'jpg';
$id       = uniqid('img', true);
$filename = $id . '.' . strtolower($ext);
$destPath = $uploadDir . $filename;

if (!move_uploaded_file($file['tmp_name'], $destPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'ファイルの保存に失敗しました']);
    exit;
}

try {
    $db->prepare("INSERT INTO images (id, issue_id, filename) VALUES (?,?,?)")
       ->execute([$id, $issueId, $filename]);
    echo json_encode(['ok' => true, 'id' => $id, 'filename' => $filename, 'url' => '../uploads/' . $filename]);
} catch (Exception $e) {
    unlink($destPath);
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
