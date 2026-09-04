# D1 遷移

在專案根目錄執行（請替換為你的 `database_name`）：

```bash
npx wrangler d1 execute ziyoukongjian-db --remote --file=./migrations/0002_crossword_remote.sql
```

若 `users` 表尚無 `last_login_at` 欄位，Google 登入 INSERT 會失敗，可另執行：

```sql
ALTER TABLE users ADD COLUMN last_login_at TEXT;
```

教師白名單範例：

```sql
INSERT INTO teacher_accounts (email) VALUES ('teacher@school.edu');
```
