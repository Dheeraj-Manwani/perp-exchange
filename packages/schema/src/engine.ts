export type EngineCommandType =
  | "create_order"
  | "cancel_order"
  | "onramp"
  | "create_user"
  | "index_price_update"
  | "get_index_price"
  | "get_orderbook"
  | "get_positions"
  | "get_position"
  | "get_mark_price"
  | "get_account_summary"
  | "funding_settle";

/**
 * Read-only engine queries. These mutate no state, so the engine replies on the
 * Redis pub/sub channel (fire-and-forget) instead of the durable response stream,
 * and skips re-emitting on replayed events. The engine and the API both key off
 * this set rather than a per-request `responseVia` flag.
 */
export const READ_ONLY_ENGINE_TYPES: ReadonlySet<EngineCommandType> = new Set([
  "get_index_price",
  "get_orderbook",
  "get_positions",
  "get_position",
  "get_mark_price",
  "get_account_summary",
]);

export const isReadOnlyEngineType = (type: EngineCommandType): boolean =>
  READ_ONLY_ENGINE_TYPES.has(type);

export interface EngineRequest {
  userId: string;
  correlationId: string;
  responseQueue: string;
  type: EngineCommandType;
  payload: Record<string, unknown>;
}

export interface EngineResponse {
  userId: string;
  correlationId: string;
  sourceEventId: string;
  type: EngineCommandType;
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export interface PendingResponse {
  resolve: (response: EngineResponse) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}
