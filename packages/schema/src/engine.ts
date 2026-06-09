export type EngineCommandType =
  | "create_order"
  | "cancel_order"
  | "onramp"
  | "create_user"
  | "index_price_update"
  | "funding_settle";

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
