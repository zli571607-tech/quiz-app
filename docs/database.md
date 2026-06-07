# 数据库设计

## 数据库
- 类型：SQLite
- 库：better-sqlite3
- 文件位置：项目 data/ 目录

## 表结构

### decks（题套表）
题套 = 一份文档生成的一组题目，或用户手动创建的题目组。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 主键 |
| name | TEXT | NOT NULL | 题套名称 |
| source_file | TEXT | - | 来源文件名 |
| question_count | INTEGER | DEFAULT 0 | 题目数量 |
| created_at | TEXT | NOT NULL DEFAULT (datetime('now','localtime')) | 创建时间 |

### questions（题目表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 主键 |
| deck_id | INTEGER | REFERENCES decks(id) ON DELETE SET NULL | 所属题套（空=总题库） |
| topic | TEXT | NOT NULL | 题目内容 |
| options | TEXT | NOT NULL | JSON 数组，如 ["A.xxx","B.xxx","C.xxx","D.xxx"] |
| answer | TEXT | NOT NULL | 正确答案，值为 A/B/C/D |
| source_file | TEXT | - | 来源文件名 |
| created_at | TEXT | NOT NULL DEFAULT (datetime('now','localtime')) | 创建时间 |
| updated_at | TEXT | NOT NULL DEFAULT (datetime('now','localtime')) | 更新时间 |

### records（答题记录表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 主键 |
| session_id | TEXT | NOT NULL | 刷题会话 ID（UUID） |
| question_id | INTEGER | NOT NULL | 题目 ID |
| user_answer | TEXT | - | 用户选择的答案 A/B/C/D |
| is_correct | INTEGER | NOT NULL | 0=错误, 1=正确 |
| answered_at | TEXT | NOT NULL DEFAULT (datetime('now','localtime')) | 答题时间 |

## ER 关系
```
decks (1) ────── (N) questions
questions (1) ── (N) records
```

## 常用查询

### 统计总题目数
```sql
SELECT COUNT(*) FROM questions;
```

### 统计某套题的正确率
```sql
SELECT 
  COUNT(CASE WHEN is_correct=1 THEN 1 END) as correct,
  COUNT(*) as total
FROM records 
WHERE question_id IN (SELECT id FROM questions WHERE deck_id = ?);
```

### 获取错题列表
```sql
SELECT DISTINCT q.* FROM questions q
INNER JOIN records r ON q.id = r.question_id
WHERE r.is_correct = 0
ORDER BY r.answered_at DESC;
```

### 获取总答题统计
```sql
SELECT 
  COUNT(DISTINCT session_id) as total_sessions,
  COUNT(*) as total_answers,
  ROUND(CAST(SUM(is_correct) AS FLOAT) / COUNT(*) * 100, 1) as accuracy
FROM records;
```
