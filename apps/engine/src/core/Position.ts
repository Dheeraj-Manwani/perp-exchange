import { Fill, OrderSide, OrderType } from "@repo/schema";
import { getLiquidationPrice } from "../utils/utils";
import { mulDiv } from "../utils/math";

export type TradeEntry = {
  type: "open" | "close";
  fillId?: string;
  price: bigint;
  qty: number;
  timestamp: number;
};

export class Position {
  readonly positionId: string;
  readonly userId: string;
  readonly market: string;
  readonly orderType: OrderType;

  side: OrderSide;
  qty: number;
  margin: bigint;
  leverage: number;
  averagePrice: bigint;
  liquidationPrice: bigint;
  tradeHistory: TradeEntry[];
  isOpen: boolean;

  constructor(params: {
    positionId: string;
    userId: string;
    market: string;
    orderType: OrderType;
    side: OrderSide;
    qty: number;
    margin: bigint;
    leverage: number;
    averagePrice: bigint;
  }) {
    this.positionId = params.positionId;
    this.userId = params.userId;
    this.market = params.market;
    this.orderType = params.orderType;
    this.side = params.side;
    this.qty = params.qty;
    this.margin = params.margin;
    this.leverage = params.leverage;
    this.averagePrice = params.averagePrice;
    this.isOpen = true;
    this.liquidationPrice = getLiquidationPrice(
      params.averagePrice,
      params.leverage,
      params.side,
    );
    this.tradeHistory = [
      {
        type: "open",
        price: params.averagePrice,
        qty: params.qty,
        timestamp: Date.now(),
      },
    ];
  }

  applyFill(fill: Fill, additionalMargin: bigint): void {
    const newValue =
      mulDiv([this.averagePrice, this.qty]) + mulDiv([fill.price, fill.qty]);
    const newQty = this.qty + fill.qty;
    this.averagePrice = mulDiv([newValue], [newQty]);
    this.qty = newQty;
    this.margin += additionalMargin;
    this.liquidationPrice = getLiquidationPrice(
      this.averagePrice,
      this.leverage,
      this.side,
    );
    this.tradeHistory.push({
      type: "open",
      fillId: fill.fillId,
      price: fill.price,
      qty: fill.qty,
      timestamp: Date.now(),
    });
  }

  reduceBy(qty: number, closePrice: bigint): { closedMargin: bigint } {
    const closedMargin = mulDiv([this.margin, qty], [this.qty]);
    this.qty -= qty;
    this.margin -= closedMargin;
    this.tradeHistory.push({
      type: "close",
      price: closePrice,
      qty,
      timestamp: Date.now(),
    });
    if (this.qty === 0) {
      this.close();
    }
    return { closedMargin };
  }

  close(): void {
    this.isOpen = false;
    this.qty = 0;
    this.margin = 0n;
  }

  isUnderwater(markPrice: bigint) {
    return (
      (this.side === "LONG" && markPrice <= this.liquidationPrice) ||
      (this.side === "SHORT" && markPrice >= this.liquidationPrice)
    );
  }

  computeUnrealizedPnl(markPrice: bigint): bigint {
    return this.side === "LONG"
      ? mulDiv([markPrice - this.averagePrice, this.qty])
      : mulDiv([this.averagePrice - markPrice, this.qty]);
  }
}
