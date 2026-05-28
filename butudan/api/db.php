<?php
// ========================================
// データベース接続設定
// Xserverの管理パネルで確認した値を入力してください
// ========================================
define('DB_HOST', 'localhost');          // MySQLホスト名（通常はlocalhost）
define('DB_NAME', 'spengats_butudan');       // データベース名（例: xserver12345_kobo）
define('DB_USER', 'spengats_butudan');       // ユーザー名
define('DB_PASS', 'KoBo7722');   // パスワード
define('DB_CHARSET', 'utf8mb4');

function getDB() {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = "mysql:host=".DB_HOST.";dbname=".DB_NAME.";charset=".DB_CHARSET;
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}
