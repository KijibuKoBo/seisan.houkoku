<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><title>インストール - 松永工房 生産管理</title>
<style>
body{font-family:sans-serif;max-width:700px;margin:40px auto;padding:0 20px;}
h1{color:#1a1f3c;} .ok{color:green;} .err{color:red;}
.warn{background:#fff3cd;border:1px solid #ffc107;padding:12px;border-radius:6px;margin:16px 0;}
.btn{display:inline-block;padding:10px 24px;background:#1a1f3c;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:15px;text-decoration:none;}
pre{background:#f5f5f5;padding:10px;border-radius:4px;font-size:13px;}
</style></head>
<body>
<h1>松永工房 生産管理 — データベースセットアップ</h1>

<?php
// セキュリティ: 完了フラグファイルが存在したら再実行を拒否
$lockFile = __DIR__ . '/install.lock';

if (isset($_POST['run'])) {
    if (file_exists($lockFile)) {
        echo '<p class="err">⚠ すでにインストール済みです。再実行するにはinstall.lockを削除してください。</p>';
        exit;
    }

    require_once __DIR__ . '/../api/db.php';
    $errors = [];
    $logs   = [];

    try {
        $db = getDB();

        // ===== テーブル作成 =====
        $sqls = [
"CREATE TABLE IF NOT EXISTS products (
  id           VARCHAR(50)  PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  category     VARCHAR(50)  DEFAULT '仏',
  spec_memo    TEXT,
  notes        TEXT,
  discontinued TINYINT(1)   DEFAULT 0,
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

"CREATE TABLE IF NOT EXISTS lots (
  id             VARCHAR(50)  PRIMARY KEY,
  lot_number     INT          NOT NULL,
  product_id     VARCHAR(50),
  start_date     DATE,
  ship_date      DATE,
  wood_date      DATE,
  paint_date     DATE,
  destination    VARCHAR(100),
  assignee       VARCHAR(100),
  status         VARCHAR(20)  DEFAULT '制作中',
  has_spec_change TINYINT(1)  DEFAULT 0,
  created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

"CREATE TABLE IF NOT EXISTS issues (
  id                      VARCHAR(50) PRIMARY KEY,
  lot_id                  VARCHAR(50),
  product_id              VARCHAR(50),
  lot_number              INT,
  description             TEXT,
  part_id                 VARCHAR(100),
  cause                   TEXT,
  improvement             TEXT,
  status                  VARCHAR(20) DEFAULT '調査中',
  priority                VARCHAR(10) DEFAULT '中',
  is_important            TINYINT(1)  DEFAULT 0,
  is_recurrence_prevented TINYINT(1)  DEFAULT 0,
  assignee                VARCHAR(200),
  date                    DATE,
  created_at              TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

"CREATE TABLE IF NOT EXISTS parts (
  id         VARCHAR(50)  PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  category   VARCHAR(50),
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

"CREATE TABLE IF NOT EXISTS users (
  id         VARCHAR(50)  PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  login_id   VARCHAR(100),
  email      VARCHAR(200),
  role       VARCHAR(50),
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

"CREATE TABLE IF NOT EXISTS assignees (
  id         VARCHAR(50)  PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  sort_order INT          DEFAULT 0,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        ];

        foreach ($sqls as $sql) {
            $db->exec($sql);
        }
        $logs[] = 'テーブル作成 ✓';

        // ===== カラム追加（既存テーブルへの追記） =====
        $alters = [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS login_id VARCHAR(100) AFTER name",
            "ALTER TABLE assignees ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0 AFTER name",
        ];
        foreach ($alters as $sql) {
            try { $db->exec($sql); } catch (Exception $e) { /* 既存なら無視 */ }
        }
        $logs[] = 'カラム追加 ✓';

        // ===== サンプルデータ投入 =====

        // 製品
        $products = [
            ['p001','ノーブルK','仏','丸喜','担当:保崎'],
            ['p002','プログレ','仏','',''],
            ['p003','ルーチェ','仏','',''],
            ['p004','マイセル','仏','',''],
            ['p005','チェント','仏','',''],
            ['p006','タイニー','仏','',''],
            ['p007','ブラウ','仏','',''],
            ['p008','ノーブルキュリオ','仏','',''],
            ['p009','ヴァローナ','仏','',''],
        ];
        $stmt = $db->prepare("INSERT IGNORE INTO products (id,name,category,spec_memo,notes) VALUES(?,?,?,?,?)");
        foreach ($products as $p) { $stmt->execute($p); }
        $logs[] = '製品マスタ投入 ✓';

        // ロット
        $lots = [
            ['l001',3480,'p002','2026-05-22','2026-07-10','2026-06-30','2026-07-10','現代仏壇','石原','制作中',0],
            ['l002',3453,'p007','2026-03-01','2026-04-17',null,null,'—','石原','出荷済',0],
            ['l003',3452,'p004','2026-03-15','2026-05-07',null,null,'—','新貝','出荷済',0],
            ['l004',3462,'p003','2026-04-27','2026-06-18','2026-06-02','2026-06-18','丸喜','石原','完成',0],
            ['l005',3461,'p006','2026-04-01','2026-05-18',null,null,'丸喜','鈴木','出荷済',0],
            ['l006',3477,'p001','2026-06-03','2026-08-19','2026-08-05','2026-08-19','丸喜','保崎','制作中',0],
            ['l007',3454,'p001','2026-02-01','2026-03-01',null,null,'丸喜','石原','出荷済',0],
            ['l008',3450,'p007','2026-01-15','2026-02-20',null,null,'—','石原','出荷済',0],
        ];
        $stmt = $db->prepare("INSERT IGNORE INTO lots (id,lot_number,product_id,start_date,ship_date,wood_date,paint_date,destination,assignee,status,has_spec_change) VALUES(?,?,?,?,?,?,?,?,?,?,?)");
        foreach ($lots as $l) { $stmt->execute($l); }
        $logs[] = 'ロットデータ投入 ✓';

        // 改善記録
        $issues = [
            ['i001','l004','p003',3462,'外扉の表面がボコボコしている。','扉',
             '木地→以前からと変わらないので問題ないと判断。塗装→以前よりボコボコが酷いと判断、改善が必要と思う。福間→今回はこのまま仕上げることにするが、次回どうするかは現物を確認の上、判断する。',
             '','調査中','高',1,0,'石原、国松、福間','2026-05-28'],
            ['i002','l001','p002',3480,'引き出し横のポンズリは上面後ろ側を大きめに面取りしてあります。下面塗装しなくて良いので、上下わかるようにする為です。','引き出し',
             '上下がわからず全部塗装してしまう為。','上下がわかるようにする。','解決済','低',0,1,'石原','2026-05-28'],
            ['i003','l006','p001',3477,'','扉','','','未対応','中',0,0,'保崎','2026-05-18'],
            ['i004','l007','p001',3454,'あんこが出てた','扉','','色鉛筆で木目を描いた','解決済','中',0,0,'石原','2026-05-15'],
            ['i005','l002','p007',3453,'杢の白太部分が入ってしまった。','帆立','','節約よりもきれいな部分を使う。今回は塗装で頑張って対応してもらった。','解決済','中',0,1,'石原','2026-05-15'],
            ['i006','l002','p007',3453,'裏面を杢貼りせずに塗装で仕上げ','棚板','','','解決済','中',0,0,'石原','2026-05-15'],
        ];
        $stmt = $db->prepare("INSERT IGNORE INTO issues (id,lot_id,product_id,lot_number,description,part_id,cause,improvement,status,priority,is_important,is_recurrence_prevented,assignee,date) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
        foreach ($issues as $iss) { $stmt->execute($iss); }
        $logs[] = '改善記録投入 ✓';

        // 部品マスタ
        $parts = [
            ['pt01','天下棚',''],['pt02','腸引き',''],['pt03','須弥壇',''],
            ['pt04','帆立',''],['pt05','地板',''],
            ['pt06','天板','構造部品'],['pt07','厨子','構造部品'],
            ['pt08','引き出し','構造部品'],['pt09','扉','構造部品'],['pt10','棚板','構造部品'],
            ['pt11','塗装','仕上げ'],['pt12','金具','金物'],
        ];
        $stmt = $db->prepare("INSERT IGNORE INTO parts (id,name,category) VALUES(?,?,?)");
        foreach ($parts as $pt) { $stmt->execute($pt); }
        $logs[] = '部品マスタ投入 ✓';

        // ユーザー
        $users = [
            ['u001','KoBo木地部',  'kijibu',    'kijibu.kobo@gmail.com',   '管理者'],
            ['u002','まとめKoBo',  'matomebu',  'matomebu.kobo@gmail.com', '編集者'],
            ['u003','塗装部工房',  'tosoubu',   'tosoubu.kobo@gmail.com',  '編集者'],
            ['u004','福間健太郎',  'viaken1213','viaken1213@gmail.com',     '閲覧者'],
        ];
        $stmt = $db->prepare("INSERT IGNORE INTO users (id,name,login_id,email,role) VALUES(?,?,?,?,?)");
        foreach ($users as $u) { $stmt->execute($u); }
        $logs[] = 'ユーザー投入 ✓';

        // 担当者マスタ
        $assignees = [
            ['as01','石原',1],['as02','新貝',2],['as03','保崎',3],
            ['as04','鈴木',4],['as05','国松',5],['as06','福間',6],
        ];
        $stmt = $db->prepare("INSERT IGNORE INTO assignees (id,name,sort_order) VALUES(?,?,?)");
        foreach ($assignees as $a) { $stmt->execute($a); }
        $logs[] = '担当者マスタ投入 ✓';

        // ロックファイル作成
        file_put_contents($lockFile, date('Y-m-d H:i:s'));

        echo '<h2 class="ok">✅ セットアップ完了！</h2>';
        echo '<ul>';
        foreach ($logs as $l) { echo "<li class='ok'>$l</li>"; }
        echo '</ul>';
        echo '<p><a class="btn" href="../">アプリを開く →</a></p>';

    } catch (Exception $e) {
        echo '<h2 class="err">❌ エラーが発生しました</h2>';
        echo '<pre>' . htmlspecialchars($e->getMessage()) . '</pre>';
        echo '<p>api/db.php のデータベース設定を確認してください。</p>';
    }

} else {
    // 初回表示
    if (file_exists($lockFile)) {
        echo '<p class="err">⚠ すでにインストール済みです。（install.lock が存在します）</p>';
        echo '<p><a class="btn" href="../">アプリを開く →</a></p>';
    } else {
?>
    <div class="warn">
        ⚠ <strong>注意：</strong>このスクリプトはテーブルを作成しサンプルデータを投入します。<br>
        実行前に <code>api/db.php</code> のデータベース設定が正しいか確認してください。
    </div>
    <p>設定内容：</p>
    <pre><?php
    require_once __DIR__ . '/../api/db.php';
    echo 'DB_HOST: ' . DB_HOST . "\n";
    echo 'DB_NAME: ' . DB_NAME . "\n";
    echo 'DB_USER: ' . DB_USER . "\n";
    ?></pre>
    <form method="post">
        <button class="btn" name="run" value="1" type="submit">セットアップ実行</button>
    </form>
<?php
    }
}
?>
</body>
</html>
