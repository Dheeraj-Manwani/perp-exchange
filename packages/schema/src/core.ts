import { OrderSide, OrderType } from "./orders";

export type AccountParams = {
  userId: string;
  username: string;
  maxLeverage?: number;
  available?: bigint;
  locked?: bigint;
};

export type OpenOrder = {
  orderId: string;
  userId: string;
  qty: number;
  filledQty: number;
  leverage: number;
  createdAt: Date;
};

export type MatchParams = {
  orderId: string;
  positionId: string;
  userId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  qty: number;
  leverage: number;
  limitPrice: bigint;
  isLiquidation: boolean;
};

export type OrderFill = {
  fillId: string;
  qty: number;
  price: bigint;
  fee: bigint;
  role: "maker" | "taker";
  timestamp: number;
};

export type MakerFillEvent = {
  orderId: string;
  makerUserId: string;
  fillQty: number;
  fillPrice: bigint;
  fee: bigint;
  timestamp: number;
};

export type MatchResult = {
  filledQty: number;
  unfilled: number;
  fillValue: bigint;
  takerFills: OrderFill[];
  makerFills: MakerFillEvent[];
};

export type ConsumedFill = {
  makerOrderId: string;
  makerUserId: string;
  makerLeverage: number;
  qty: number;
};

export type Fill = {
  fillId: string;
  orderId: string;
  qty: number;
  price: bigint;
};
