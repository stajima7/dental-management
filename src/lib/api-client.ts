/**
 * 統一APIクライアント
 * エラーハンドリングを一元管理
 */

export class ApiError extends Error {
  status: number;
  details?: { field: string; message: string }[];

  constructor(message: string, status: number, details?: { field: string; message: string }[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorData: any = {};
    try {
      errorData = await res.json();
    } catch {
      // JSON解析失敗
    }

    if (res.status === 401) {
      // 未認証→ログインへ
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw new ApiError("認証が必要です。再ログインしてください。", 401);
    }

    if (res.status === 403) {
      throw new ApiError("アクセス権がありません", 403);
    }

    throw new ApiError(
      errorData.error || `リクエスト失敗 (${res.status})`,
      res.status,
      errorData.details
    );
  }

  return res.json();
}

export const api = {
  async get<T = any>(url: string): Promise<T> {
    const res = await fetch(url);
    return handleResponse<T>(res);
  },

  async post<T = any>(url: string, body: any): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return handleResponse<T>(res);
  },

  async put<T = any>(url: string, body: any): Promise<T> {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return handleResponse<T>(res);
  },

  async delete<T = any>(url: string): Promise<T> {
    const res = await fetch(url, { method: "DELETE" });
    return handleResponse<T>(res);
  },
};
