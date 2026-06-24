// Typed client for the perp-exchange Express API.
// Response envelope: { success: true, data } | { success: false, code, message }

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const TOKEN_KEY = "perpex.token";

let accessToken: string | null = null;

export function getToken(): string | null {
  if (accessToken) return accessToken;
  if (typeof window !== "undefined") {
    accessToken = window.localStorage.getItem(TOKEN_KEY);
  }
  return accessToken;
}

export function setToken(token: string | null) {
  accessToken = token;
  if (typeof window !== "undefined") {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
  query?: Record<string, string | number | boolean | undefined>;
  _retry?: boolean;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(API_URL + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, _retry } = opts;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(buildUrl(path, query), {
    method,
    headers,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Transparent single refresh attempt on 401.
  if (res.status === 401 && !_retry && path !== "/auth/refresh") {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(path, { ...opts, _retry: true });
  }

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!res.ok) {
    const p = payload as { code?: string; message?: string } | null;
    throw new ApiError(
      res.status,
      p?.code ?? "ERROR",
      p?.message ?? res.statusText,
    );
  }

  const p = payload as { success: boolean; data: T } | null;
  return (p?.data ?? (payload as T)) as T;
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(buildUrl("/auth/refresh"), {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { data?: { token?: string } };
    if (json.data?.token) {
      setToken(json.data.token);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type OrderSide = "LONG" | "SHORT";
export type OrderType = "LIMIT" | "MARKET";
export type OrderStatus =
  | "PENDING"
  | "OPEN"
  | "PARTIALLY_FILLED"
  | "FILLED"
  | "CANCELLED"
  | "REJECTED"
  | "LIQUIDATED";

export interface Market {
  id: string;
  marketSlug: string;
  symbol: string;
  imageUrl: string | null;
  decimals: number;
  tickSize: string;
  minQty: number;
  maxLeverage: number;
  maintenanceMarginBps: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MarkPrice {
  symbol: string;
  markPrice: string;
  indexPrice: string;
  updatedAt: number;
}

export interface IndexPrice {
  symbol: string;
  indexPrice: string;
  updatedAt: number;
}

export interface FundingRate {
  symbol: string;
  rateBps: string;
  markPrice: string | null;
  settledAt: string | null;
  nextFundingTime: string;
  intervalSeconds: number;
}

export interface PublicTrade {
  id: string;
  price: string;
  qty: number;
  side?: OrderSide;
  createdAt: string;
}

export interface OrderDto {
  orderId: string;
  symbol: string;
  type: OrderType;
  side: OrderSide;
  status: OrderStatus;
  price: string;
  qty: number;
  filledQty: number;
  slippage: string;
  leverage: number;
  reduceOnly: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PositionView {
  positionId: string;
  market: string;
  side: OrderSide;
  qty: number;
  margin: string;
  leverage: number;
  averagePrice: string;
  liquidationPrice: string;
  markPrice: string;
  unrealisedPnl: string;
}

export interface Balance {
  asset: string;
  available: string;
  locked: string;
  updatedAt: string;
}

export interface AccountSummary {
  equity: string;
  availableMargin: string;
  usedMargin: string;
  unrealisedPnl: string;
  balances: Balance[];
}

export interface FillDto {
  id: string;
  orderId?: string;
  symbol?: string;
  price: string;
  qty: number;
  role?: "MAKER" | "TAKER";
  side?: OrderSide;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface CreateOrderResult {
  orderId: string;
  symbol: string;
  type: OrderType;
  side: OrderSide;
  qty: number;
  price: string;
  filledQty: number;
  unfilled: number;
  avgFillPrice: string;
  status: OrderStatus;
  takerBalanceSnapshot: { available: string; locked: string };
}

export interface CreateOrderInput {
  symbol: string;
  type: OrderType;
  side: OrderSide;
  qty: number;
  price: string; // scaled integer string
  leverage?: number;
  slippage?: string;
  isReduceOnly?: boolean;
}

// ─── Endpoints ──────────────────────────────────────────────────────────────

export const api = {
  // auth
  signup: (username: string, password: string) =>
    request<{ token: string }>("/auth/signup", {
      method: "POST",
      body: { username, password },
    }),
  signin: (username: string, password: string) =>
    request<{ token: string }>("/auth/signin", {
      method: "POST",
      body: { username, password },
    }),
  refresh: () => request<{ token: string }>("/auth/refresh", { method: "POST" }),

  // markets (public)
  getMarkets: () => request<Market[]>("/markets"),
  getMarket: (symbol: string) => request<Market>(`/markets/${symbol}`),
  getMarkPrice: (symbol: string) =>
    request<MarkPrice>(`/markets/${symbol}/mark-price`),
  getIndexPrice: (symbol: string) =>
    request<IndexPrice>(`/markets/${symbol}/index-price`),
  getFundingRate: (symbol: string) =>
    request<FundingRate>(`/markets/${symbol}/funding-rate`),
  getPublicTrades: (symbol: string, limit = 50) =>
    request<PublicTrade[]>(`/markets/${symbol}/trades`, { query: { limit } }),

  // orders (auth)
  createOrder: (input: CreateOrderInput) =>
    request<CreateOrderResult>("/order", { method: "POST", body: input }),
  cancelOrder: (orderId: string, symbol: string, side: OrderSide) =>
    request<{ orderId: string; releasedMargin: string }>(`/order/${orderId}`, {
      method: "DELETE",
      body: { symbol, side },
    }),
  cancelAllOrders: (symbol?: string) =>
    request<{ total: number; cancelled: number }>("/orders", {
      method: "DELETE",
      query: { symbol },
    }),
  getOpenOrders: (symbol?: string) =>
    request<OrderDto[]>("/orders", { query: { symbol } }),
  getOrderHistory: (symbol?: string, limit = 100, page = 1) =>
    request<Paginated<OrderDto>>("/orders/history", {
      query: { symbol, limit, page },
    }),

  // fills (auth)
  getUserFills: (limit = 100, page = 1) =>
    request<Paginated<FillDto>>("/fills", { query: { limit, page } }),
  getUserFillsBySymbol: (symbol: string, limit = 100, page = 1) =>
    request<Paginated<FillDto>>(`/fills/${symbol}`, { query: { limit, page } }),

  // positions (auth)
  getPositions: () => request<PositionView[]>("/positions"),
  getPosition: (symbol: string) =>
    request<PositionView>(`/positions/${symbol}`),
  getPositionHistory: (symbol?: string, limit = 100, page = 1) =>
    request<Paginated<unknown>>("/positions/history", {
      query: { symbol, limit, page },
    }),

  // account (auth)
  getAccountSummary: () => request<AccountSummary>("/account"),
  getBalances: () => request<Balance[]>("/account/balances"),
  getTransactions: (limit = 100, page = 1) =>
    request<Paginated<unknown>>("/account/transactions", {
      query: { limit, page },
    }),
  getFundingPayments: (symbol?: string, limit = 100, page = 1) =>
    request<
      Paginated<{
        id: string;
        symbol: string | null;
        period: string;
        amount: string;
        balanceAfter: string;
        createdAt: string;
      }>
    >("/account/funding-payments", { query: { symbol, limit, page } }),
  getFees: () =>
    request<{
      takerFeeRate: number;
      makerFeeRate: number;
      takerFeeBps: number;
      makerFeeBps: number;
      feeDenominator: number;
    }>("/account/fees"),

  // balances (auth)
  onRamp: (amount: string) =>
    request<unknown>("/onramp", { method: "POST", body: { amount } }),
};
