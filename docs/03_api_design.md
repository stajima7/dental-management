# 8. API設計

## 認証
| Method | Path | 概要 |
|--------|------|------|
| POST | /api/auth/register | 新規登録 |
| POST | /api/auth/[...nextauth] | NextAuth認証 |

## 医院管理
| Method | Path | 概要 |
|--------|------|------|
| GET | /api/clinics | 医院一覧 |
| POST | /api/clinics | 医院作成 |
| GET | /api/clinics/[id] | 医院詳細 |
| PUT | /api/clinics/[id] | 医院更新 |
| GET | /api/clinics/[id]/profile | プロファイル取得 |
| PUT | /api/clinics/[id]/profile | プロファイル更新 |

## データ取込
| Method | Path | 概要 |
|--------|------|------|
| POST | /api/import/csv | CSVアップロード・解析 |
| POST | /api/import/csv/mapping | マッピング適用・保存 |
| POST | /api/import/pdf | PDFアップロード |
| GET | /api/import/history | 取込履歴 |
| GET | /api/import/mappings | マッピング設定一覧 |

## 月次データ
| Method | Path | 概要 |
|--------|------|------|
| GET | /api/monthly/revenue | 月次売上取得 |
| POST | /api/monthly/revenue | 月次売上登録 |
| GET | /api/monthly/patients | 月次患者数取得 |
| POST | /api/monthly/patients | 月次患者数登録 |
| GET | /api/monthly/appointments | 月次予約取得 |
| POST | /api/monthly/appointments | 月次予約登録 |

## コスト
| Method | Path | 概要 |
|--------|------|------|
| GET | /api/costs | コスト一覧 |
| POST | /api/costs | コスト登録 |
| PUT | /api/costs/[id] | コスト更新 |
| DELETE | /api/costs/[id] | コスト削除 |
| GET | /api/costs/items | コスト項目マスタ |

## KPI
| Method | Path | 概要 |
|--------|------|------|
| GET | /api/kpi/[yearMonth] | 月次KPI取得 |
| POST | /api/kpi/calculate | KPI再計算 |
| GET | /api/kpi/trend | KPI推移 |

## 配賦
| Method | Path | 概要 |
|--------|------|------|
| GET | /api/allocation/rules | 配賦ルール取得 |
| PUT | /api/allocation/rules | 配賦ルール更新 |
| GET | /api/allocation/drivers/[yearMonth] | ドライバー量取得 |
| PUT | /api/allocation/drivers/[yearMonth] | ドライバー量更新 |
| POST | /api/allocation/calculate | 配賦計算実行 |
| GET | /api/allocation/results/[yearMonth] | 配賦結果取得 |

## 部門別採算
| Method | Path | 概要 |
|--------|------|------|
| GET | /api/department/[yearMonth] | 部門別採算取得 |
| POST | /api/department/calculate | 部門別採算計算 |

## AI
| Method | Path | 概要 |
|--------|------|------|
| POST | /api/ai/diagnose | AI診断実行 |
| GET | /api/ai/insights/[yearMonth] | AI分析結果取得 |
| GET | /api/ai/actions | アクションプラン取得 |
| PUT | /api/ai/actions/[id] | アクション更新 |

## ダッシュボード
| Method | Path | 概要 |
|--------|------|------|
| GET | /api/dashboard/summary | サマリーデータ取得 |
| GET | /api/dashboard/charts | チャートデータ取得 |

# 9. MVP実装優先順位

## Phase 1: 基盤（Week 1-2）
1. Next.jsプロジェクト作成
2. Prisma schema定義・マイグレーション
3. NextAuth認証実装
4. マスタデータ投入
5. 初期設定画面（ウィザード）

## Phase 2: データ入力（Week 3-4）
6. CSV取込機能
7. 手入力画面
8. 月次データ保存API
9. 共通スキーマ変換

## Phase 3: 分析表示（Week 5-6）
10. KPI計算ロジック
11. 経営ダッシュボード
12. ヒト分析画面
13. モノ分析画面
14. 患者分析画面

## Phase 4: 管理会計（Week 7-8）
15. コスト登録画面
16. カネ分析画面
17. 配賦設定画面
18. 配賦計算ロジック
19. 部門別採算画面

## Phase 5: AI提案（Week 9-10）
20. AIコメント生成
21. 改善提案画面
22. アクション管理
