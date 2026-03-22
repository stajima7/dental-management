# 1. 要件の再構造化

## 1.1 システム概要
歯科医院向け経営コンサルWebアプリ。ヒト・モノ・カネ・患者の4軸で経営を可視化し、管理会計・間接費配賦による部門別採算分析とAI改善提案を提供する。

## 1.2 機能階層

### レイヤー1: 基盤
- 認証・認可（メール/パスワード、ロール制御）
- 組織・医院管理（将来の複数医院対応）
- マスタ管理（診療区分、コスト項目、KPI定義等）

### レイヤー2: データ入力
- 初期セットアップ（医院情報、規模、人員、設備）
- CSV取込（列マッピング、バリデーション、重複防止）
- PDF取込（MVPでは保管＋手修正）
- 手入力（月次売上、患者数、コスト）
- 共通スキーマ変換・保存

### レイヤー3: 分析・計算
- KPI自動計算（基本/生産性/コスト/利益/比較）
- 管理会計計算（直接原価/直接計上費/間接費）
- 配賦計算（コストドライバー・レート → 配賦額）
- 部門別採算計算

### レイヤー4: 可視化
- 経営ダッシュボード
- ヒト分析（人員・生産性・労務）
- モノ分析（設備・材料・稼働）
- カネ分析（PL・利益構造・コスト）
- 患者分析（新患・再来・中断・メンテ）
- 配賦設定・結果
- 部門別採算

### レイヤー5: 提案
- AI課題抽出
- 改善提案生成
- 優先順位付け
- アクション管理

## 1.3 MVPスコープ
| 機能 | MVP | Phase2 |
|------|-----|--------|
| 認証 | ○ | - |
| 初期設定 | ○ | - |
| CSV取込 | ○ | - |
| PDF取込 | 保管のみ | OCR最適化 |
| 手入力 | ○ | - |
| KPI計算 | ○ | - |
| ダッシュボード | ○ | - |
| ヒト/モノ/カネ/患者分析 | ○ | 詳細版 |
| コスト登録 | ○ | - |
| 配賦設定 | ○ | - |
| 部門別採算 | ○ | - |
| AIコメント | ○ | チャット |
| 複数医院比較 | - | ○ |
| ベンチマーク | - | ○ |

## 1.4 技術スタック
- Frontend: Next.js 15 (App Router)
- Backend: Next.js Server Actions + API Routes
- DB: PostgreSQL
- ORM: Prisma
- Auth: NextAuth.js v5
- UI: Tailwind CSS + shadcn/ui
- Charts: Recharts
- CSV: PapaParse
- AI: OpenAI API / Anthropic API

# 2. 画面一覧

| # | 画面ID | 画面名 | URL | 概要 |
|---|--------|--------|-----|------|
| 1 | LOGIN | ログイン | /login | メール/パスワード認証 |
| 2 | REGISTER | 新規登録 | /register | アカウント作成 |
| 3 | SETUP | 初期設定 | /setup | ウィザード形式で医院情報登録 |
| 4 | DASHBOARD | ダッシュボード | /dashboard | 主要KPI・チャート・AIサマリー |
| 5 | IMPORT | データ取込 | /import | CSV/PDF/手入力 |
| 6 | HUMAN | ヒト分析 | /analysis/human | 人員・生産性・労務 |
| 7 | EQUIPMENT | モノ分析 | /analysis/equipment | 設備・材料・稼働 |
| 8 | FINANCE | カネ分析 | /analysis/finance | PL・利益・コスト |
| 9 | ALLOCATION | 配賦設定 | /allocation | 間接費配賦ルール設定 |
| 10 | DEPARTMENT | 部門別採算 | /department | 部門別PL表示 |
| 11 | PATIENT | 患者分析 | /analysis/patient | 新患・再来・中断 |
| 12 | ACTION | 改善提案 | /action | AI課題・提案・進捗 |
| 13 | SETTINGS | 医院設定 | /settings | 基本情報編集・目標値 |
| 14 | COSTS | コスト登録 | /costs | 直接原価・間接費入力 |

# 3. 画面遷移図

```
[LOGIN] → [SETUP](初回のみ) → [DASHBOARD]
                                    ↕
              ┌─────────────────────┼──────────────────────┐
              ↕                     ↕                      ↕
          [IMPORT]            [ANALYSIS]              [ACTION]
              ↕                  ↕ ↕ ↕ ↕                  ↕
          [COSTS]         [HUMAN][EQUIPMENT]         [改善進捗]
              ↕           [FINANCE][PATIENT]
          [ALLOCATION]
              ↕
          [DEPARTMENT]

グローバルナビ: 全画面から相互遷移可能
サイドバー: DASHBOARD, IMPORT, HUMAN, EQUIPMENT, FINANCE,
            COSTS, ALLOCATION, DEPARTMENT, PATIENT, ACTION, SETTINGS
```

# 4. テーブル一覧

| # | テーブル名 | 概要 |
|---|-----------|------|
| 1 | users | ユーザー |
| 2 | accounts | OAuth/認証アカウント |
| 3 | sessions | セッション |
| 4 | organizations | 組織（法人） |
| 5 | clinics | 医院 |
| 6 | clinic_profiles | 医院月次プロファイル |
| 7 | staff_roles_master | 職種マスタ |
| 8 | department_master | 診療区分マスタ |
| 9 | cost_items_master | コスト項目マスタ |
| 10 | kpi_master | KPI定義マスタ |
| 11 | driver_master | コストドライバーマスタ |
| 12 | upload_files | アップロードファイル |
| 13 | import_jobs | 取込ジョブ |
| 14 | import_mappings | 列マッピング設定 |
| 15 | monthly_revenue | 月次売上 |
| 16 | monthly_patients | 月次患者数 |
| 17 | monthly_appointments | 月次予約 |
| 18 | monthly_costs | 月次コスト |
| 19 | monthly_kpis | 月次KPI |
| 20 | allocation_rules | 配賦ルール |
| 21 | allocation_driver_values | ドライバー量 |
| 22 | allocation_results | 配賦結果 |
| 23 | department_profitability | 部門別採算 |
| 24 | ai_insights | AI分析結果 |
| 25 | action_plans | 改善アクション |
