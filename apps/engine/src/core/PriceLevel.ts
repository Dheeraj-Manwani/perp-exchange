import { ConsumedFill, OpenOrder } from "@repo/schema";

export class PriceLevel {
  readonly price: bigint;
  private queue: OpenOrder[];

  constructor(price: bigint, initialOrders: OpenOrder[] = []) {
    this.price = price;
    this.queue = [...initialOrders];
  }

  get availableQty() {
    return this.queue.reduce((sum, o) => sum + (o.qty - o.filledQty), 0);
  }

  isEmpty() {
    return this.availableQty === 0;
  }

  addOrder(order: OpenOrder): void {
    this.queue.push(order);
  }

  cancelOrder(orderId: string): { remainingQty: number; leverage: number } | null {
    const idx = this.queue.findIndex((o) => o.orderId === orderId);
    if (idx === -1) return null;
    const [order] = this.queue.splice(idx, 1);
    if (!order) return null;
    return { remainingQty: order.qty - order.filledQty, leverage: order.leverage };
  }

  consume(qty: number, skipUserId?: string): ConsumedFill[] {
    const fills: ConsumedFill[] = [];

    let remainingQty = qty;

    for (const order of this.queue) {
      if (remainingQty === 0) break;
      if (skipUserId && skipUserId === order.userId) continue;

      const available = order.qty - order.filledQty;

      const fillQty = Math.min(available, remainingQty);

      order.filledQty += fillQty;
      remainingQty -= fillQty;

      fills.push({
        makerOrderId: order.orderId,
        makerUserId: order.userId,
        makerLeverage: order.leverage,
        qty: fillQty,
      });
    }

    this.queue = this.queue.filter((o) => o.qty - o.filledQty > 0);
    return fills;
  }
}
