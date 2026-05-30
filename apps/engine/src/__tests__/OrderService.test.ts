import { describe, it, expect, beforeEach } from "vitest";
import { OrderService } from "../services/OrderService";
import { UserRegistry } from "../core/UserRegistry";
import { OrderbookRegistry } from "../core/OrderbookRegistry";
import { PositionManager } from "../core/PositionManager";
import { Account } from "../core/Account";
import type { OrderInput, OrderSide } from "@repo/schema";

// ─── helpers ────────────────────────────────────────────────────────────────

const SYMBOL = "BTC-PERP";
const TAKER_ID = "taker";
// Ghost maker: present in orderbook but NOT in UserRegistry so applyFillToMaker
// is skipped, keeping maker-side accounting out of taker-focused tests.
const GHOST_MAKER = "ghost-maker";

interface SystemFixture {
  users: UserRegistry;
  books: OrderbookRegistry;
  positions: PositionManager;
  service: OrderService;
  taker: Account;
}

function makeSystem(takerBalance = 100_000n): SystemFixture {
  const users = new UserRegistry();
  const books = new OrderbookRegistry([SYMBOL]);
  const positions = new PositionManager();
  const service = new OrderService(users, books, positions);
  const taker = new Account({
    userId: TAKER_ID,
    username: "taker",
    available: takerBalance,
  });
  users.add(taker);
  return { users, books, positions, service, taker };
}

/** Seed an ask (for a LONG taker to match against). */
function seedAsk(
  books: OrderbookRegistry,
  price: bigint,
  qty: number,
  orderId = `ask-${price}-${qty}`,
) {
  books.get(SYMBOL).addLimitOrder(
    { orderId, userId: GHOST_MAKER, qty, filledQty: 0, leverage: 1, createdAt: new Date() },
    "SHORT",
    price,
  );
}

/** Seed a bid (for a SHORT taker to match against). */
function seedBid(
  books: OrderbookRegistry,
  price: bigint,
  qty: number,
  orderId = `bid-${price}-${qty}`,
) {
  books.get(SYMBOL).addLimitOrder(
    { orderId, userId: GHOST_MAKER, qty, filledQty: 0, leverage: 1, createdAt: new Date() },
    "LONG",
    price,
  );
}

function marketOrder(overrides: Partial<OrderInput> = {}): OrderInput {
  return {
    symbol: SYMBOL,
    type: "MARKET",
    side: "LONG",
    qty: 5,
    price: 50n,
    slippage: 1000n, // 10 %
    leverage: 1,
    isReduceOnly: false,
    ...overrides,
  };
}

function limitOrder(overrides: Partial<OrderInput> = {}): OrderInput {
  return {
    symbol: SYMBOL,
    type: "LIMIT",
    side: "LONG",
    qty: 5,
    price: 53n,
    slippage: 0n,
    leverage: 1,
    isReduceOnly: false,
    ...overrides,
  };
}

// ─── market order: locked-balance invariant ──────────────────────────────────
//
// After any market order, account.locked must be 0.
// Market orders never leave resting orders in the book, so ALL locked margin
// must either be consumed by fills or returned to available.

describe("market order – locked is zero after completion", () => {
  let sys: SystemFixture;
  beforeEach(() => {
    sys = makeSystem();
  });

  it("full fill at exact limit price (no improvement, no unfilled)", () => {
    // limitPrice = 50 * 1.10 = 55; estimatedMargin = ceil(50*5*11000/10000) = 275
    seedAsk(sys.books, 55n, 5);
    sys.service.placeOrder(TAKER_ID, marketOrder());
    expect(sys.taker.collateral.locked).toBe(0n);
  });

  it("full fill at better price – price improvement must be refunded", () => {
    // Fills at 52 < limitPrice 55: 5 × (55-52)=15 would strand without the fix
    seedAsk(sys.books, 52n, 5);
    sys.service.placeOrder(TAKER_ID, marketOrder());
    expect(sys.taker.collateral.locked).toBe(0n);
  });

  it("partial fill with no price improvement (exact limit price)", () => {
    // 3 filled at 55, 2 unfilled: unfilled portion is refunded
    seedAsk(sys.books, 55n, 3);
    sys.service.placeOrder(TAKER_ID, marketOrder());
    expect(sys.taker.collateral.locked).toBe(0n);
  });

  it("USER SCENARIO – partial fill at better price: 5 qty, 3 filled at 53, slippage 10%", () => {
    // estimatedMargin = 275
    // filled: ceil(53×3) = 159 consumed
    // expected release = 275 − 159 = 116  (= 110 unfilled + 6 price-improvement)
    // BUG before fix: only 110 was released, locking 6 forever
    seedAsk(sys.books, 53n, 3);
    sys.service.placeOrder(TAKER_ID, marketOrder());
    expect(sys.taker.collateral.locked).toBe(0n);
  });

  it("zero fill (empty book) – full estimated margin is returned", () => {
    // No asks; all 275 must come back
    sys.service.placeOrder(TAKER_ID, marketOrder());
    expect(sys.taker.collateral.locked).toBe(0n);
  });

  it("fill across two price levels, full fill", () => {
    // Asks: 51×2 + 53×3 = 5 total, fully fills order
    // estimatedMargin=275; consumed=ceil(51×2)+ceil(53×3)=102+159=261; release=14
    seedAsk(sys.books, 51n, 2, "ask-51");
    seedAsk(sys.books, 53n, 3, "ask-53");
    sys.service.placeOrder(TAKER_ID, marketOrder());
    expect(sys.taker.collateral.locked).toBe(0n);
  });

  it("fill across two price levels, partial fill", () => {
    // Asks: 51×2 + 54×2 = 4 filled, 1 unfilled; both cross limitPrice=55
    // consumed=ceil(51×2)+ceil(54×2)=102+108=210; release=275−210=65
    seedAsk(sys.books, 51n, 2, "ask-51");
    seedAsk(sys.books, 54n, 2, "ask-54");
    sys.service.placeOrder(TAKER_ID, marketOrder());
    expect(sys.taker.collateral.locked).toBe(0n);
  });

  it("partial fill at better price with leverage=5", () => {
    // estimatedMargin=ceil(50×5×11000/(5×10000))=55
    // 3 filled at 53: consumed=ceil(53×3/5)=ceil(31.8)=32; release=55−32=23
    // BUG before fix: floor(55×2/5)=22 released, leaving 1 stranded
    seedAsk(sys.books, 53n, 3);
    sys.service.placeOrder(TAKER_ID, marketOrder({ leverage: 5 }));
    expect(sys.taker.collateral.locked).toBe(0n);
  });

  it("full fill at better price with leverage=5", () => {
    // estimatedMargin=55; 5 filled at 52: consumed=ceil(52×5/5)=52; release=3
    seedAsk(sys.books, 52n, 5);
    sys.service.placeOrder(TAKER_ID, marketOrder({ leverage: 5 }));
    expect(sys.taker.collateral.locked).toBe(0n);
  });

  it("SHORT – partial fill at better price (higher price is better for seller)", () => {
    // SHORT limitPrice = floor(50×9000/10000) = 45
    // estimatedMargin = ceil(50×5×11000/10000) = 275 (same formula)
    // Bid at 48 crosses (48 ≥ 45); 3 filled: consumed=ceil(48×3)=144; release=131
    // BUG before fix: only floor(275×2/5)=110 released, leaving 21 stranded
    seedBid(sys.books, 48n, 3);
    sys.service.placeOrder(TAKER_ID, marketOrder({ side: "SHORT" }));
    expect(sys.taker.collateral.locked).toBe(0n);
  });

  it("SHORT – full fill at better price", () => {
    // Bid at 48; 5 filled: consumed=240; estimatedMargin=275; release=35
    seedBid(sys.books, 48n, 5);
    sys.service.placeOrder(TAKER_ID, marketOrder({ side: "SHORT" }));
    expect(sys.taker.collateral.locked).toBe(0n);
  });

  it("book price just at slippage boundary fills; price beyond does not", () => {
    // limitPrice=55; ask at 55 fills, ask at 56 does not
    seedAsk(sys.books, 55n, 2, "ask-55");
    seedAsk(sys.books, 56n, 3, "ask-56");
    sys.service.placeOrder(TAKER_ID, marketOrder());
    expect(sys.taker.collateral.locked).toBe(0n);
  });
});

// ─── market order: fill result accuracy ─────────────────────────────────────

describe("market order – fill result accuracy", () => {
  let sys: SystemFixture;
  beforeEach(() => {
    sys = makeSystem();
  });

  it("status FILLED when all qty is matched", () => {
    seedAsk(sys.books, 53n, 5);
    const result = sys.service.placeOrder(TAKER_ID, marketOrder());
    expect(result.status).toBe("FILLED");
    expect(result.filledQty).toBe(5);
    expect(result.unfilled).toBe(0);
  });

  it("status PARTIALLY_FILLED when only some qty matches", () => {
    seedAsk(sys.books, 53n, 3);
    const result = sys.service.placeOrder(TAKER_ID, marketOrder());
    expect(result.status).toBe("PARTIALLY_FILLED");
    expect(result.filledQty).toBe(3);
    expect(result.unfilled).toBe(2);
  });

  it("status OPEN when book is empty", () => {
    const result = sys.service.placeOrder(TAKER_ID, marketOrder());
    expect(result.status).toBe("OPEN");
    expect(result.filledQty).toBe(0);
    expect(result.unfilled).toBe(5);
  });

  it("avgFillPrice is correct for single level", () => {
    seedAsk(sys.books, 53n, 5);
    const result = sys.service.placeOrder(TAKER_ID, marketOrder());
    expect(result.avgFillPrice).toBe("53");
  });

  it("avgFillPrice is weighted average across multiple levels", () => {
    // 2@51 + 3@53: fillValue=51×2+53×3=102+159=261; avg=floor(261/5)=52
    seedAsk(sys.books, 51n, 2, "ask-51");
    seedAsk(sys.books, 53n, 3, "ask-53");
    const result = sys.service.placeOrder(TAKER_ID, marketOrder());
    expect(result.avgFillPrice).toBe("52");
  });

  it("avgFillPrice is 0 for no fill", () => {
    const result = sys.service.placeOrder(TAKER_ID, marketOrder());
    expect(result.avgFillPrice).toBe("0");
  });

  it("fills array contains correct price and qty for registered maker", () => {
    // makerFills are only emitted when the maker is in the UserRegistry
    const MAKER_ID = "registered-maker";
    const maker = new Account({ userId: MAKER_ID, username: "maker", available: 100_000n });
    sys.users.add(maker);
    sys.books.get(SYMBOL).addLimitOrder(
      { orderId: "ask-reg", userId: MAKER_ID, qty: 3, filledQty: 0, leverage: 1, createdAt: new Date() },
      "SHORT",
      53n,
    );
    const result = sys.service.placeOrder(TAKER_ID, marketOrder());
    expect(result.fills).toHaveLength(1);
    expect(result.fills[0]!.price).toBe("53");
    expect(result.fills[0]!.qty).toBe(3);
    expect(result.fills[0]!.makerUserId).toBe(MAKER_ID);
  });

  it("fills array contains one entry per price level matched (registered maker)", () => {
    const MAKER_ID = "registered-maker";
    const maker = new Account({ userId: MAKER_ID, username: "maker", available: 100_000n });
    sys.users.add(maker);
    sys.books.get(SYMBOL).addLimitOrder(
      { orderId: "ask-51", userId: MAKER_ID, qty: 2, filledQty: 0, leverage: 1, createdAt: new Date() },
      "SHORT",
      51n,
    );
    sys.books.get(SYMBOL).addLimitOrder(
      { orderId: "ask-53", userId: MAKER_ID, qty: 3, filledQty: 0, leverage: 1, createdAt: new Date() },
      "SHORT",
      53n,
    );
    const result = sys.service.placeOrder(TAKER_ID, marketOrder());
    expect(result.fills).toHaveLength(2);
  });

  it("orders with price above limitPrice are not crossed", () => {
    // limitPrice=55; ask at 56 should not match
    seedAsk(sys.books, 56n, 5);
    const result = sys.service.placeOrder(TAKER_ID, marketOrder());
    expect(result.filledQty).toBe(0);
  });
});

// ─── market order: total equity invariant ────────────────────────────────────

describe("market order – total equity (available + locked + position margin)", () => {
  it("equity decreases only by fees, never by stranded locked margin", () => {
    const initial = 100_000n;
    const sys = makeSystem(initial);
    // Use large prices so fees are non-trivial (fee = floor(price×qty×6/10000))
    // price=5000, qty=5, slippage=10%, leverage=1
    // estimatedMargin=ceil(5000×5×11000/10000)=27500
    // Fill 3@5200: margin=ceil(5200×3)=15600; fee=floor(5200×3×6/10000)=9
    seedAsk(sys.books, 5200n, 3);
    sys.service.placeOrder(TAKER_ID, marketOrder({ price: 5000n, qty: 5 }));

    const pos = sys.positions.get(TAKER_ID, SYMBOL);
    const posMargin = pos?.margin ?? 0n;
    const equity = sys.taker.collateral.available + sys.taker.collateral.locked + posMargin;
    // Equity must equal initial minus fees (fee = floor(5200×3×6/10000) = 9)
    const fee = (5200n * 3n * 6n) / 10000n;
    expect(equity).toBe(initial - fee);
  });
});

// ─── market order: position state ────────────────────────────────────────────

describe("market order – position state", () => {
  let sys: SystemFixture;
  beforeEach(() => {
    sys = makeSystem();
  });

  it("creates a new LONG position after a fill", () => {
    seedAsk(sys.books, 53n, 3);
    sys.service.placeOrder(TAKER_ID, marketOrder());
    const pos = sys.positions.get(TAKER_ID, SYMBOL);
    expect(pos).toBeDefined();
    expect(pos!.side).toBe("LONG");
  });

  it("position qty equals filled qty", () => {
    seedAsk(sys.books, 53n, 3);
    sys.service.placeOrder(TAKER_ID, marketOrder());
    expect(sys.positions.get(TAKER_ID, SYMBOL)!.qty).toBe(3);
  });

  it("position averagePrice equals fill price on single level", () => {
    seedAsk(sys.books, 53n, 5);
    sys.service.placeOrder(TAKER_ID, marketOrder());
    expect(sys.positions.get(TAKER_ID, SYMBOL)!.averagePrice).toBe(53n);
  });

  it("position margin equals ceil(fillPrice × filledQty / leverage)", () => {
    seedAsk(sys.books, 53n, 3);
    sys.service.placeOrder(TAKER_ID, marketOrder());
    // ceil(53×3/1) = 159
    expect(sys.positions.get(TAKER_ID, SYMBOL)!.margin).toBe(159n);
  });

  it("second fill on same side adds to existing position", () => {
    seedAsk(sys.books, 50n, 2, "ask-1");
    sys.service.placeOrder(TAKER_ID, marketOrder({ qty: 2 }));
    seedAsk(sys.books, 52n, 2, "ask-2");
    sys.service.placeOrder(TAKER_ID, marketOrder({ qty: 2 }));
    const pos = sys.positions.get(TAKER_ID, SYMBOL)!;
    expect(pos.qty).toBe(4);
    expect(pos.margin).toBe(100n + 104n); // ceil(50×2)+ceil(52×2)=100+104
  });

  it("no position created when book is empty", () => {
    sys.service.placeOrder(TAKER_ID, marketOrder());
    expect(sys.positions.get(TAKER_ID, SYMBOL)).toBeUndefined();
  });
});

// ─── market order: available balance moves correctly ─────────────────────────

describe("market order – available balance", () => {
  it("full fill: available decreases by fillMargin + fee", () => {
    const sys = makeSystem(10_000n);
    seedAsk(sys.books, 53n, 5);
    sys.service.placeOrder(TAKER_ID, marketOrder());
    const fillMargin = 265n; // ceil(53×5/1)
    const fee = (53n * 5n * 6n) / 10000n; // floor, equals 0 here
    expect(sys.taker.collateral.available).toBe(10_000n - fillMargin - fee);
  });

  it("zero fill: available is fully restored", () => {
    const sys = makeSystem(10_000n);
    sys.service.placeOrder(TAKER_ID, marketOrder());
    expect(sys.taker.collateral.available).toBe(10_000n);
  });

  it("partial fill with price improvement: available correctly reflects release", () => {
    // available starts at 10000
    // estimatedMargin locked = 275
    // 3 filled at 53: consumed = 159, fee ≈ 0
    // release = 275 − 159 = 116 → goes back to available
    // final available = 10000 − 159 − fee
    const sys = makeSystem(10_000n);
    seedAsk(sys.books, 53n, 3);
    sys.service.placeOrder(TAKER_ID, marketOrder());
    const fillMargin = 159n;
    const fee = (53n * 3n * 6n) / 10000n;
    expect(sys.taker.collateral.available).toBe(10_000n - fillMargin - fee);
  });
});

// ─── limit order: locked-balance and price improvement ───────────────────────

describe("limit order – account balance", () => {
  let sys: SystemFixture;
  beforeEach(() => {
    sys = makeSystem();
  });

  it("full fill at exact limit price: locked is zero", () => {
    // Ask at 53 = limit price; no improvement, no unfilled
    seedAsk(sys.books, 53n, 5);
    sys.service.placeOrder(TAKER_ID, limitOrder());
    expect(sys.taker.collateral.locked).toBe(0n);
  });

  it("immediate cross at better price: excess margin is refunded", () => {
    // Limit LONG at 53; ask at 48 fills (48 < 53 → better for buyer)
    // nominalFilledMargin=ceil(53×5)=265; actualFilledMargin=floor(48×5)=240
    // excess=25 → unlocked
    seedAsk(sys.books, 48n, 5);
    sys.service.placeOrder(TAKER_ID, limitOrder());
    expect(sys.taker.collateral.locked).toBe(0n);
  });

  it("partial fill: correct margin stays locked for resting portion", () => {
    // Ask at 53×2 fills; 3 units go to book at 53
    // estimatedMargin=265; consumed=ceil(53×2)=106; excess=0 (same price)
    // Remaining locked = ceil(53×3) = 159
    seedAsk(sys.books, 53n, 2);
    sys.service.placeOrder(TAKER_ID, limitOrder());
    expect(sys.taker.collateral.locked).toBe(159n);
  });

  it("no fill: full estimated margin stays locked for resting order", () => {
    // Empty book; all 5 units go to book, estimatedMargin=265 stays locked
    sys.service.placeOrder(TAKER_ID, limitOrder());
    expect(sys.taker.collateral.locked).toBe(265n);
  });

  it("partial fill with price improvement: locked = margin for unfilled only", () => {
    // Ask at 48×2 fills (improvement); 3 units rest at 53
    // consumed=ceil(48×2)=96; nominalFilled=ceil(53×2)=106; excess=10 unlocked
    // Remaining locked = 265 − 96 − 10 = 159 (= ceil(53×3))
    seedAsk(sys.books, 48n, 2);
    sys.service.placeOrder(TAKER_ID, limitOrder());
    expect(sys.taker.collateral.locked).toBe(159n);
  });
});

// ─── limit order: orderbook state ────────────────────────────────────────────

describe("limit order – orderbook", () => {
  let sys: SystemFixture;
  beforeEach(() => {
    sys = makeSystem();
  });

  it("unfilled qty is added to bids", () => {
    sys.service.placeOrder(TAKER_ID, limitOrder());
    const book = sys.books.get(SYMBOL);
    const bids = [...book.bids.values()];
    expect(bids).toHaveLength(1);
    expect(bids[0]!.availableQty).toBe(5);
    expect(bids[0]!.price).toBe(53n);
  });

  it("partially filled residue is added to bids", () => {
    seedAsk(sys.books, 53n, 2);
    sys.service.placeOrder(TAKER_ID, limitOrder());
    const book = sys.books.get(SYMBOL);
    const bids = [...book.bids.values()];
    expect(bids).toHaveLength(1);
    expect(bids[0]!.availableQty).toBe(3);
  });

  it("fully filled limit order is NOT added to book", () => {
    seedAsk(sys.books, 53n, 5);
    sys.service.placeOrder(TAKER_ID, limitOrder());
    expect([...sys.books.get(SYMBOL).bids.values()]).toHaveLength(0);
  });
});

// ─── cancel order ────────────────────────────────────────────────────────────

describe("cancel order", () => {
  let sys: SystemFixture;
  beforeEach(() => {
    sys = makeSystem();
  });

  it("releases locked margin for resting limit order", () => {
    // Place LONG limit at 53, qty=5 → locked=265
    const result = sys.service.placeOrder(TAKER_ID, limitOrder());
    expect(sys.taker.collateral.locked).toBe(265n);
    sys.service.cancelOrder(TAKER_ID, result.orderId, SYMBOL, "LONG");
    expect(sys.taker.collateral.locked).toBe(0n);
    expect(sys.taker.collateral.available).toBe(100_000n);
  });

  it("releases correct partial locked after partial fill", () => {
    // 2 filled at 53, 3 rest in book; cancel the resting 3 → release ceil(53×3)=159
    seedAsk(sys.books, 53n, 2);
    const result = sys.service.placeOrder(TAKER_ID, limitOrder());
    const lockedAfterFill = sys.taker.collateral.locked; // 159
    sys.service.cancelOrder(TAKER_ID, result.orderId, SYMBOL, "LONG");
    expect(sys.taker.collateral.locked).toBe(0n);
    expect(sys.taker.collateral.available).toBe(100_000n - 106n); // 100000 - filled margin - fee
    expect(lockedAfterFill).toBe(159n);
  });

  it("cancel returns the correct releasedMargin string", () => {
    const result = sys.service.placeOrder(TAKER_ID, limitOrder());
    const cancel = sys.service.cancelOrder(TAKER_ID, result.orderId, SYMBOL, "LONG");
    expect(cancel.releasedMargin).toBe("265");
  });

  it("canceling non-existent order throws", () => {
    expect(() =>
      sys.service.cancelOrder(TAKER_ID, "no-such-order", SYMBOL, "LONG"),
    ).toThrow("Order not found or already filled");
  });
});

// ─── validation / guards ─────────────────────────────────────────────────────

describe("validation", () => {
  it("throws InsufficientMarginError when balance is too low", () => {
    // estimatedMargin=275; give only 100
    const sys = makeSystem(100n);
    expect(() => sys.service.placeOrder(TAKER_ID, marketOrder())).toThrow(
      /insufficient/i,
    );
  });

  it("throws when leverage exceeds account maxLeverage (default 10)", () => {
    const sys = makeSystem();
    expect(() =>
      sys.service.placeOrder(TAKER_ID, marketOrder({ leverage: 11 })),
    ).toThrow(/leverage/i);
  });

  it("throws when user is not found", () => {
    const sys = makeSystem();
    expect(() =>
      sys.service.placeOrder("unknown-user", marketOrder()),
    ).toThrow("User not found");
  });
});

// ─── reduce-only / position flip ─────────────────────────────────────────────

describe("reduce-only and position flip", () => {
  it("locked is zero after fully closing an opposite position", () => {
    // Open SHORT 3@55 first, then LONG 3@50 closes it
    const sys = makeSystem();
    seedBid(sys.books, 55n, 3, "bid-55");
    sys.service.placeOrder(TAKER_ID, marketOrder({ side: "SHORT", qty: 3, slippage: 0n, price: 55n }));
    expect(sys.taker.collateral.locked).toBe(0n);

    seedAsk(sys.books, 50n, 3, "ask-50");
    // Opposite side → reduce-only; netQty = max(3-3,0)=0 → estimatedMargin=0
    sys.service.placeOrder(TAKER_ID, marketOrder({ side: "LONG", qty: 3, slippage: 0n, price: 50n }));
    expect(sys.taker.collateral.locked).toBe(0n);
    expect(sys.positions.get(TAKER_ID, SYMBOL)).toBeUndefined();
  });

  it("flip: locked is zero after closing short and opening long", () => {
    // Open SHORT 3@55, then LONG 5@50 (closes 3 + opens 2)
    const sys = makeSystem();
    seedBid(sys.books, 55n, 3, "bid-55");
    sys.service.placeOrder(TAKER_ID, marketOrder({ side: "SHORT", qty: 3, slippage: 0n, price: 55n }));

    seedAsk(sys.books, 50n, 5, "ask-50");
    // netQty = max(5-3,0)=2; estimatedMargin=ceil(50×2×10000/(1×10000))=100
    // fill 5: close 3 + open 2@50; takerMarginConsumed=100; release=100−100=0
    sys.service.placeOrder(TAKER_ID, marketOrder({ side: "LONG", qty: 5, slippage: 0n, price: 50n }));
    expect(sys.taker.collateral.locked).toBe(0n);
    const pos = sys.positions.get(TAKER_ID, SYMBOL);
    expect(pos?.side).toBe("LONG");
    expect(pos?.qty).toBe(2);
  });

  it("flip with slippage: price improvement on new position is refunded", () => {
    // Open SHORT 3@55, then LONG 5, price=50, slippage=10% → limitPrice=55
    // estimatedMargin for netQty=2 = ceil(50×2×11000/10000) = 110
    // Fill at 48 (< 55 limit): openFillMargin=ceil(48×2)=96; release=110−96=14
    const sys = makeSystem();
    seedBid(sys.books, 55n, 3, "bid-55");
    sys.service.placeOrder(TAKER_ID, marketOrder({ side: "SHORT", qty: 3, slippage: 0n, price: 55n }));

    seedAsk(sys.books, 48n, 5, "ask-48");
    sys.service.placeOrder(TAKER_ID, marketOrder({ side: "LONG", qty: 5, price: 50n, slippage: 1000n }));
    expect(sys.taker.collateral.locked).toBe(0n);
  });
});

// ─── edge cases ──────────────────────────────────────────────────────────────

describe("edge cases", () => {
  it("qty=1, single fill at better price: no stranded margin", () => {
    const sys = makeSystem();
    // estimatedMargin = ceil(50×1×11000/10000) = 55
    // Fill at 50: consumed=50; release=5
    seedAsk(sys.books, 50n, 1);
    sys.service.placeOrder(TAKER_ID, marketOrder({ qty: 1 }));
    expect(sys.taker.collateral.locked).toBe(0n);
  });

  it("zero slippage market order: margin equals fill price exactly", () => {
    const sys = makeSystem();
    // slippage=0 → limitPrice=50; estimatedMargin=ceil(50×5)=250
    // Fill at 50: consumed=250; release=0
    seedAsk(sys.books, 50n, 5);
    sys.service.placeOrder(TAKER_ID, marketOrder({ slippage: 0n }));
    expect(sys.taker.collateral.locked).toBe(0n);
    expect(sys.taker.collateral.available).toBe(100_000n - 250n);
  });

  it("consecutive market orders each leave locked=0", () => {
    const sys = makeSystem();
    seedAsk(sys.books, 53n, 3, "ask-1");
    sys.service.placeOrder(TAKER_ID, marketOrder({ qty: 3 }));
    expect(sys.taker.collateral.locked).toBe(0n);

    seedAsk(sys.books, 54n, 3, "ask-2");
    sys.service.placeOrder(TAKER_ID, marketOrder({ qty: 3 }));
    expect(sys.taker.collateral.locked).toBe(0n);
  });

  it("market order against own orders (skipUserId): no self-fill", () => {
    // Add taker's own order as a maker in the book — should be skipped
    sys: {
      const sys = makeSystem();
      sys.books.get(SYMBOL).addLimitOrder(
        { orderId: "self-ask", userId: TAKER_ID, qty: 5, filledQty: 0, leverage: 1, createdAt: new Date() },
        "SHORT",
        53n,
      );
      const result = sys.service.placeOrder(TAKER_ID, marketOrder());
      // Self-fill skipped → no fill
      expect(result.filledQty).toBe(0);
      expect(sys.taker.collateral.locked).toBe(0n);
    }
  });
});
