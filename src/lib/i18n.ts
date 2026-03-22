/**
 * 多言語対応（i18n）基盤
 * 将来的な海外展開用
 */

export type Locale = "ja" | "en"

const translations: Record<Locale, Record<string, string>> = {
  ja: {
    // ナビゲーション
    "nav.dashboard": "ダッシュボード",
    "nav.import": "データ取込",
    "nav.humanAnalysis": "ヒト分析",
    "nav.equipmentAnalysis": "モノ分析",
    "nav.financeAnalysis": "カネ分析",
    "nav.costs": "コスト登録",
    "nav.allocation": "配賦設定",
    "nav.department": "部門別採算",
    "nav.patientAnalysis": "患者分析",
    "nav.action": "改善提案",
    "nav.settings": "医院設定",
    "nav.users": "ユーザー管理",
    "nav.master": "マスタ管理",

    // 共通
    "common.save": "保存",
    "common.cancel": "キャンセル",
    "common.delete": "削除",
    "common.edit": "編集",
    "common.add": "追加",
    "common.search": "検索",
    "common.loading": "読み込み中...",
    "common.saving": "保存中...",
    "common.success": "成功",
    "common.error": "エラー",
    "common.confirm": "確認",
    "common.back": "戻る",
    "common.next": "次へ",
    "common.logout": "ログアウト",

    // 認証
    "auth.login": "ログイン",
    "auth.register": "新規登録",
    "auth.email": "メールアドレス",
    "auth.password": "パスワード",
    "auth.name": "名前",

    // KPI
    "kpi.totalRevenue": "月商",
    "kpi.selfPayRatio": "自費率",
    "kpi.newPatientCount": "新患数",
    "kpi.returnRate": "再来率",
    "kpi.cancelRate": "キャンセル率",
    "kpi.laborCostRatio": "人件費率",
    "kpi.grossProfitRate": "売上総利益率",
    "kpi.operatingProfitRate": "営業利益率",
  },
  en: {
    // Navigation
    "nav.dashboard": "Dashboard",
    "nav.import": "Data Import",
    "nav.humanAnalysis": "Staff Analysis",
    "nav.equipmentAnalysis": "Equipment Analysis",
    "nav.financeAnalysis": "Financial Analysis",
    "nav.costs": "Cost Entry",
    "nav.allocation": "Allocation Settings",
    "nav.department": "Department P&L",
    "nav.patientAnalysis": "Patient Analysis",
    "nav.action": "Improvement Plans",
    "nav.settings": "Clinic Settings",
    "nav.users": "User Management",
    "nav.master": "Master Data",

    // Common
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.add": "Add",
    "common.search": "Search",
    "common.loading": "Loading...",
    "common.saving": "Saving...",
    "common.success": "Success",
    "common.error": "Error",
    "common.confirm": "Confirm",
    "common.back": "Back",
    "common.next": "Next",
    "common.logout": "Logout",

    // Auth
    "auth.login": "Login",
    "auth.register": "Register",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.name": "Name",

    // KPI
    "kpi.totalRevenue": "Monthly Revenue",
    "kpi.selfPayRatio": "Private Pay Ratio",
    "kpi.newPatientCount": "New Patients",
    "kpi.returnRate": "Return Rate",
    "kpi.cancelRate": "Cancellation Rate",
    "kpi.laborCostRatio": "Labor Cost Ratio",
    "kpi.grossProfitRate": "Gross Profit Rate",
    "kpi.operatingProfitRate": "Operating Profit Rate",
  },
}

let currentLocale: Locale = "ja"

export function setLocale(locale: Locale) {
  currentLocale = locale
}

export function getLocale(): Locale {
  return currentLocale
}

export function t(key: string, locale?: Locale): string {
  const l = locale || currentLocale
  return translations[l]?.[key] || translations.ja[key] || key
}
