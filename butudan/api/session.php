<?php
session_start();

function requireAuth() {
    if (!isset($_SESSION['user'])) {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code(401);
        echo json_encode(['error' => 'ログインが必要です', 'code' => 'UNAUTHORIZED']);
        exit;
    }
    return $_SESSION['user'];
}
