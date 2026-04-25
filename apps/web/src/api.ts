// Typed API client for FlashDrop backend.
// Same-origin: empty VITE_API_BASE_URL + vite proxy (dev) or Caddy reverse proxy (prod).

const BASE = import.meta.env.VITE_API_BASE_URL || "";
const PREFIX = import.meta.env.VITE_API_PREFIX || "/api/v1";
const PUBLIC_APP_BASE =
  import.meta.env.VITE_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");
const AUTH_TOKEN_KEY = "flashdrop_auth_token";
const AUTH_SELLER_KEY = "flashdrop_auth_seller";

export const apiUrl = (path: string) => `${BASE}${PREFIX}${path.startsWith("/") ? path : `/${path}`}`;
export const buyerCheckoutUrl = (slug: string) =>
  `${PUBLIC_APP_BASE}/buy/${encodeURIComponent(slug)}`;
export const liveWallUrl = (slug: string) =>
  `${PUBLIC_APP_BASE}/wall/${encodeURIComponent(slug)}`;

export type DropState =
  | "draft"
  | "live"
  | "sold_out"
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
  floor_price_cents: number | null;
  currency: string;
  inventory: number;
  sold_count: number;
  media_url: string | null;
  bunq_tab_url: string | null;
  state: DropState;
  duration_minutes: number | null;
  expires_at: string | null;
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

export type NotificationPublic = {
  id: string;
  drop_id: string | null;
  drop_slug: string | null;
  drop_title: string;
  amount_cents: number;
  currency: string;
  read: boolean;
  created_at: string;
};

export type GeneratePreviewResponse = {
  title: string;
  description: string;
  price_cents: number;
  currency: string;
  floor_price_cents: number | null;
};

export type SellerPublic = {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
};

export type AuthResponse = {
  access_token: string;
  token_type: "bearer";
  seller: SellerPublic;
};

class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

function apiErrorMessage(status: number, body: unknown, fallback: string): string {
  if (typeof body === "string" && body.trim()) return body;
  if (body && typeof body === "object") {
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: unknown; loc?: unknown };
      const msg = typeof first?.msg === "string" ? first.msg : fallback;
      const loc = Array.isArray(first?.loc) ? first.loc.slice(1).join(".") : "";
      return loc ? `${loc}: ${msg}` : msg;
    }
  }
  return `${fallback} (${status})`;
}

export function getAccessToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(AUTH_TOKEN_KEY) ?? "";
}

export function getStoredSeller(): SellerPublic | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(AUTH_SELLER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SellerPublic;
  } catch {
    return null;
  }
}

export function persistAuth(auth: AuthResponse): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_TOKEN_KEY, auth.access_token);
  localStorage.setItem(AUTH_SELLER_KEY, JSON.stringify(auth.seller));
}

export function persistSeller(seller: SellerPublic): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_SELLER_KEY, JSON.stringify(seller));
}

export function clearAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_SELLER_KEY);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = getAccessToken();
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      "ngrok-skip-browser-warning": "true",
      ...(init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
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
    throw new ApiError(
      res.status,
      apiErrorMessage(res.status, body, `${init?.method ?? "GET"} ${path} failed`),
      body,
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  registerSeller: (payload: { email: string; display_name: string; password: string }): Promise<AuthResponse> =>
    request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify(payload) }),

  loginSeller: (payload: { email: string; password: string }): Promise<AuthResponse> =>
    request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(payload) }),

  getMe: (): Promise<SellerPublic> =>
    request<SellerPublic>("/auth/me"),

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
    floor_price_cents?: number | null;
    currency?: string;
    inventory: number;
    media_url?: string | null;
    expires_at?: string | null;
  }): Promise<DropDetail> =>
    request<DropDetail>("/drops", { method: "POST", body: JSON.stringify(payload) }),

  listDrops: (params?: { status?: DropState | DropState[]; state?: DropState | DropState[]; seller_id?: string; limit?: number }): Promise<DropPublic[]> => {
    const q = new URLSearchParams();
    const appendStatuses = (key: "status" | "state", value?: DropState | DropState[]) => {
      if (!value) return;
      const values = Array.isArray(value) ? value : [value];
      values.forEach((item) => q.append(key, item));
    };
    if (params?.status) appendStatuses("status", params.status);
    else appendStatuses("state", params?.state);
    if (params?.seller_id) q.set("seller_id", params.seller_id);
    if (params?.limit) q.set("limit", String(params.limit));
    const s = q.toString();
    return request<DropPublic[]>(`/drops${s ? `?${s}` : ""}`);
  },

  getDrop: (slug: string): Promise<DropDetail> => request<DropDetail>(`/drops/${encodeURIComponent(slug)}`),

  updateDrop: (id: string, payload: Partial<{ title: string; description: string; pitch: string | null; price_cents: number; currency: string; inventory: number; media_url: string | null }>): Promise<DropDetail> =>
    request<DropDetail>(`/drops/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) }),

  publish: (id: string): Promise<DropDetail> =>
    request<DropDetail>(`/drops/${encodeURIComponent(id)}/publish`, { method: "POST" }),

  mockPayment: (id: string, amount_cents?: number | null): Promise<DropDetail> =>
    request<DropDetail>(`/drops/${encodeURIComponent(id)}/mock-payment`, {
      method: "POST",
      body: JSON.stringify(amount_cents != null ? { amount_cents } : {}),
    }),

  getBunqBalance: (): Promise<{ account_id: number; description: string; balance_cents: number; currency: string; iban: string | null }> =>
    request("/bunq/balance"),

  haggle: (
    slug: string,
    body: { message: string; history: { role: "user" | "assistant"; text: string }[] },
  ): Promise<{ reply: string; offer_cents: number | null; deal_cents: number | null }> =>
    request(`/drops/${encodeURIComponent(slug)}/haggle`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  archive: (id: string): Promise<DropDetail> =>
    request<DropDetail>(`/drops/${encodeURIComponent(id)}/archive`, { method: "POST" }),

  getDropEvents: (slug: string): Promise<Record<string, unknown>[]> =>
    request<Record<string, unknown>[]>(`/drops/${encodeURIComponent(slug)}/events`),

  streamDrop: (slug: string): EventSource => new EventSource(apiUrl(`/drops/${encodeURIComponent(slug)}/stream`)),

  listNotifications: (): Promise<NotificationPublic[]> =>
    request<NotificationPublic[]>("/notifications"),

  markNotificationsRead: (): Promise<void> =>
    request<void>("/notifications/read", { method: "POST" }),
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
