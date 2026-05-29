<?php
require_once __DIR__ . '/session.php';
header('Content-Type: application/json; charset=utf-8');
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // セッション確認
    if (isset($_SESSION['user'])) {
        echo json_encode(['loggedIn' => true, 'user' => $_SESSION['user']]);
    } else {
        echo json_encode(['loggedIn' => false]);
    }

} elseif ($method === 'POST') {
    // ログイン
    require_once __DIR__ . '/db.php';
    $d        = json_decode(file_get_contents('php://input'), true);
    $login_id = trim($d['login_id'] ?? '');
    $password = trim($d['password'] ?? '');

    if ($password !== 'kobo7722') {
        http_response_code(401);
        echo json_encode(['error' => 'パスワードが違います']);
        exit;
    }

    try {
        $db   = getDB();
        // login_idカラムの存在確認
        $hasLoginId = false;
        try {
            $chk = $db->query("SELECT login_id FROM users LIMIT 1");
            $hasLoginId = true;
        } catch (Exception $e) {}

        if ($hasLoginId) {
            $stmt = $db->prepare("SELECT * FROM users WHERE login_id = ?");
            $stmt->execute([$login_id]);
            $user = $stmt->fetch();
        } else {
            // login_idカラムなし→emailで検索（移行期対応）
            $stmt = $db->prepare("SELECT * FROM users WHERE email = ?");
            $stmt->execute([$login_id]);
            $user = $stmt->fetch();
        }

        if (!$user) {
            http_response_code(401);
            echo json_encode(['error' => 'IDが登録されていません']);
            exit;
        }

        $_SESSION['user'] = [
            'id'    => $user['id'],
            'name'  => $user['name'],
            'email' => $user['email'],
            'role'  => $user['role'],
        ];
        echo json_encode(['ok' => true, 'user' => $_SESSION['user']]);

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }

} elseif ($method === 'DELETE') {
    // ログアウト
    session_destroy();
    echo json_encode(['ok' => true]);
}
