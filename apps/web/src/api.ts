// Typed API client for FlashDrop backend.
// Same-origin: empty VITE_API_BASE_URL + vite proxy (dev) or Caddy reverse proxy (prod).

const BASE = import.meta.env.VITE_API_BASE_URL || "";
const PREFIX = import.meta.env.VITE_API_PREFIX || "/api/v1";

export const apiUrl = (path: string) => `${BASE}${PREFIX}${path.startsWith("/") ? path : `/${path}`}`;

export type DropState =
  | "draft"
  | "processing"
  | "review"
  | "live"
  | "partially_sold"
  | "sold_out"
  | "paused"
  | "expired"
  | "archived";

export type PaymentStatus = "pending" | "paid" | "failed" | "expired";

export type PaymentPublic = {
  id: string;
  amount_cents: number;
  currency: string;
  status: PaymentStatus;
  created_at: string;
};

export type DropPublic = {
  id: string;
  slug: string;
  title: string;
  description: string;
  price_cents: number;
  currency: string;
  inventory: number;
  sold_count: number;
  media_url: string | null;
  bunq_tab_url: string | null;
  state: DropState;
  created_at: string;
  updated_at: string;
};

export type DropDetail = DropPublic & {
  pitch: string | null;
  seller_id: string | null;
  bunq_tab_uuid: string | null;
  payments: PaymentPublic[];
};

export type MediaUploadResponse = {
  url: string;
  absolute_url: string;
  content_type: string;
  size: number;
};

export type GeneratePreviewResponse = {
  title: string;
  description: string;
  price_cents: number;
  currency: string;
};

class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      "ngrok-skip-browser-warning": "true",
      ...(init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // keep raw text body
    }
    throw new ApiError(res.status, `${init?.method ?? "GET"} ${path} -> ${res.status}`, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  uploadMedia: (file: File | Blob, filename?: string): Promise<MediaUploadResponse> => {
    const form = new FormData();
    form.append("file", file, filename);
    return request<MediaUploadResponse>("/media/upload", { method: "POST", body: form });
  },

  generatePreview: (pitch: string, media_url?: string | null): Promise<GeneratePreviewResponse> =>
    request<GeneratePreviewResponse>("/drops/generate-preview", {
      method: "POST",
      body: JSON.stringify({ pitch, media_url: media_url ?? null }),
    }),

  createDrop: (payload: {
    title: string;
    description?: string;
    pitch?: string | null;
    price_cents: number;
    currency?: string;
    inventory: number;
    media_url?: string | null;
    seller_id?: string;
  }): Promise<DropDetail> =>
    request<DropDetail>("/drops", { method: "POST", body: JSON.stringify(payload) }),

  listDrops: (params?: { state?: DropState; seller_id?: string; limit?: number }): Promise<DropPublic[]> => {
    const q = new URLSearchParams();
    if (params?.state) q.set("state", params.state);
    if (params?.seller_id) q.set("seller_id", params.seller_id);
    if (params?.limit) q.set("limit", String(params.limit));
    const s = q.toString();
    return request<DropPublic[]>(`/drops${s ? `?${s}` : ""}`);
  },

  getDrop: (slug: string): Promise<DropDetail> => request<DropDetail>(`/drops/${encodeURIComponent(slug)}`),

  updateDrop: (id: string, payload: Partial<{ title: string; description: string; pitch: string | null; price_cents: number; currency: string; inventory: number; media_url: string | null }>): Promise<DropDetail> =>
    request<DropDetail>(`/drops/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }),

  moveToReview: (id: string): Promise<DropDetail> =>
    request<DropDetail>(`/drops/${encodeURIComponent(id)}/review`, { method: "POST" }),

  publish: (id: string): Promise<DropDetail> =>
    request<DropDetail>(`/drops/${encodeURIComponent(id)}/publish`, { method: "POST" }),

  pause: (id: string): Promise<DropDetail> =>
    request<DropDetail>(`/drops/${encodeURIComponent(id)}/pause`, { method: "POST" }),

  resume: (id: string): Promise<DropDetail> =>
    request<DropDetail>(`/drops/${encodeURIComponent(id)}/resume`, { method: "POST" }),

  archive: (id: string): Promise<DropDetail> =>
    request<DropDetail>(`/drops/${encodeURIComponent(id)}/archive`, { method: "POST" }),

  getDropEvents: (slug: string): Promise<Record<string, unknown>[]> =>
    request<Record<string, unknown>[]>(`/drops/${encodeURIComponent(slug)}/events`),

  streamDrop: (slug: string): EventSource => new EventSource(apiUrl(`/drops/${encodeURIComponent(slug)}/stream`)),
};

export { ApiError };

// Helpers
export const eurosFromCents = (cents: number): string => (cents / 100).toFixed(2);
export const centsFromEuros = (euros: string | number): number => {
  const n = typeof euros === "number" ? euros : Number(String(euros).replace(",", "."));
  return Math.max(0, Math.round((Number.isFinite(n) ? n : 0) * 100));
};

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
