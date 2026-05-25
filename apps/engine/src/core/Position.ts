import { Fill, OrderSide, OrderType } from "@repo/schema";
import {
  computeWeightedAveragePrice,
  getLiquidationPrice,
} from "../utils/utils";

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
  fills: Fill[];
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
    fills: Fill[];
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
    this.fills = [...params.fills];
    this.isOpen = true;
    this.liquidationPrice = getLiquidationPrice(
      params.averagePrice,
      params.leverage,
      params.side,
    );
  }

  applyFill(fill: Fill, additionalMargin: bigint): void {
    this.fills.push(fill);
    this.qty += fill.qty;
    this.margin += additionalMargin;
    this.averagePrice = computeWeightedAveragePrice(this.fills);
    this.liquidationPrice = getLiquidationPrice(
      this.averagePrice,
      this.leverage,
      this.side,
    );
  }
}
