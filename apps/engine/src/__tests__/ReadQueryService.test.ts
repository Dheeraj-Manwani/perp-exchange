import { describe, it, expect, beforeEach } from "vitest";
import { ReadQueryService } from "../services/ReadQueryService";
import { UserRegistry } from "../core/UserRegistry";
import { OrderbookRegistry } from "../core/OrderbookRegistry";
import { PositionManager } from "../core/PositionManager";
import { Account } from "../core/Account";
import { Position } from "../core/Position";
import type { OrderSide } from "@repo/schema";

const SYMBOL = "BTC-PERP";
const USER = "user-1";

interface Fixture {
  users: UserRegistry;
  books: OrderbookRegistry;
  positions: PositionManager;
  service: ReadQueryService;
}

function makeSystem(available = 100_000n): Fixture {
  const users = new UserRegistry();
  const books = new OrderbookRegistry([SYMBOL]);
  const positions = new PositionManager();
  const service = new ReadQueryService(users, books, positions);
  users.add(new Account({ userId: USER, username: "u1", available }));
  return { users, books, positions, service };
}

function seed(
  books: OrderbookRegistry,
  side: OrderSide,
  price: bigint,
  qty: number,
  orderId = `${side}-${price}-${qty}-${Math.random()}`,
) {
  books.get(SYMBOL).addLimitOrder(
    { orderId, userId: "maker", qty, filledQty: 0, leverage: 1, createdAt: new Date() },
    side,
    price,
  );
}

function openPosition(
  positions: PositionManager,
  overrides: Partial<ConstructorParameters<typeof Position>[0]> = {},
) {
  positions.add(
    new Position({
      positionId: "pos-1",
      userId: USER,
      market: SYMBOL,
      orderType: "MARKET",
      side: "LONG",
      qty: 10,
      margin: 500n,
      leverage: 2,
      averagePrice: 100n,
      ...overrides,
    }),
  );
}

// ─── get_orderbook ────────────────────────────────────────────────────────────

describe("getOrderbook", () => {
  let sys: Fixture;
  beforeEach(() => {
    sys = makeSystem();
  });

  it("sorts bids descending and asks ascending, best-first", () => {
    seed(sys.books, "SHORT", 107n, 2);
    seed(sys.books, "SHORT", 105n, 3);
    seed(sys.books, "SHORT", 106n, 1);
    seed(sys.books, "LONG", 90n, 5);
    seed(sys.books, "LONG", 95n, 2);
    seed(sys.books, "LONG", 93n, 1);

    const book = sys.service.getOrderbook(SYMBOL, 20);
    expect(book.asks.map(([p]) => p)).toEqual(["105", "106", "107"]);
    expect(book.bids.map(([p]) => p)).toEqual(["95", "93", "90"]);
  });

  it("aggregates qty across orders at the same price level", () => {
    seed(sys.books, "SHORT", 105n, 3);
    seed(sys.books, "SHORT", 105n, 2);
    const book = sys.service.getOrderbook(SYMBOL, 20);
    expect(book.asks).toEqual([["105", "5"]]);
  });

  it("caps the number of levels at the requested depth", () => {
    seed(sys.books, "SHORT", 105n, 1);
    seed(sys.books, "SHORT", 106n, 1);
    seed(sys.books, "SHORT", 107n, 1);
    const book = sys.service.getOrderbook(SYMBOL, 2);
    expect(book.asks).toEqual([["105", "1"], ["106", "1"]]);
  });

  it("returns the book's lastUpdateId", () => {
    seed(sys.books, "SHORT", 105n, 1);
    const book = sys.service.getOrderbook(SYMBOL, 20);
    expect(book.lastUpdateId).toBe(sys.books.get(SYMBOL).updateId);
    expect(book.lastUpdateId).toBeGreaterThan(0);
  });
});

// ─── updateId counter ─────────────────────────────────────────────────────────

describe("orderbook updateId", () => {
  it("increments on add, consume and cancel mutations", () => {
    const sys = makeSystem();
    const book = sys.books.get(SYMBOL);
    expect(book.updateId).toBe(0);

    book.addLimitOrder(
      { orderId: "o1", userId: "maker", qty: 5, filledQty: 0, leverage: 1, createdAt: new Date() },
      "SHORT",
      105n,
    );
    expect(book.updateId).toBe(1);

    book.consumeAtLevel("LONG", 105n, 2);
    expect(book.updateId).toBe(2);

    book.cancelOrder("o1", "SHORT");
    expect(book.updateId).toBe(3);
  });

  it("does not increment when consume matches nothing", () => {
    const sys = makeSystem();
    const book = sys.books.get(SYMBOL);
    book.consumeAtLevel("LONG", 999n, 1);
    expect(book.updateId).toBe(0);
  });
});

// ─── get_mark_price ───────────────────────────────────────────────────────────

describe("getMarkPrice", () => {
  it("uses last traded price when available", () => {
    const sys = makeSystem();
    const book = sys.books.get(SYMBOL);
    book.indexPrice = 100n;
    book.lastTradedPrice = 110n;
    book.indexPriceUpdatedAt = 123;
    const res = sys.service.getMarkPrice(SYMBOL);
    expect(res).toEqual({ symbol: SYMBOL, markPrice: "110", indexPrice: "100", updatedAt: 123 });
  });

  it("falls back to index price when there is no last trade", () => {
    const sys = makeSystem();
    sys.books.get(SYMBOL).indexPrice = 100n;
    expect(sys.service.getMarkPrice(SYMBOL).markPrice).toBe("100");
  });
});

// ─── get_positions / get_position ─────────────────────────────────────────────

describe("getPositions", () => {
  it("returns open positions with live mark price and unrealised PnL", () => {
    const sys = makeSystem();
    sys.books.get(SYMBOL).lastTradedPrice = 110n;
    openPosition(sys.positions); // LONG 10 @ 100

    const { positions } = sys.service.getPositions(USER);
    expect(positions).toHaveLength(1);
    expect(positions[0]!.markPrice).toBe("110");
    // LONG: (110 - 100) * 10 = 100
    expect(positions[0]!.unrealisedPnl).toBe("100");
    expect(positions[0]!.side).toBe("LONG");
    expect(positions[0]!.averagePrice).toBe("100");
  });

  it("excludes closed positions", () => {
    const sys = makeSystem();
    openPosition(sys.positions);
    sys.positions.close(USER, SYMBOL);
    expect(sys.service.getPositions(USER).positions).toHaveLength(0);
  });

  it("getPosition returns null when no open position for the market", () => {
    const sys = makeSystem();
    expect(sys.service.getPosition(USER, SYMBOL).position).toBeNull();
  });

  it("computes SHORT unrealised PnL against mark price", () => {
    const sys = makeSystem();
    sys.books.get(SYMBOL).lastTradedPrice = 90n;
    openPosition(sys.positions, { side: "SHORT" }); // SHORT 10 @ 100
    // SHORT: (100 - 90) * 10 = 100
    expect(sys.service.getPosition(USER, SYMBOL).position!.unrealisedPnl).toBe("100");
  });
});

// ─── get_account_summary ──────────────────────────────────────────────────────

describe("getAccountSummary", () => {
  it("rolls position margin and unrealised PnL into equity", () => {
    const sys = makeSystem(10_000n);
    sys.books.get(SYMBOL).lastTradedPrice = 110n;
    openPosition(sys.positions, { margin: 500n }); // LONG 10 @ 100, uPnL = 100

    const summary = sys.service.getAccountSummary(USER);
    expect(summary.availableMargin).toBe("10000");
    expect(summary.usedMargin).toBe("500"); // locked(0) + position margin(500)
    expect(summary.unrealisedPnl).toBe("100");
    // equity = available + locked + positionMargin + uPnL = 10000 + 0 + 500 + 100
    expect(summary.equity).toBe("10600");
  });

  it("equals free collateral when there are no open positions", () => {
    const sys = makeSystem(7_500n);
    const summary = sys.service.getAccountSummary(USER);
    expect(summary).toEqual({
      equity: "7500",
      availableMargin: "7500",
      usedMargin: "0",
      unrealisedPnl: "0",
    });
  });

  it("throws when the account does not exist", () => {
    const sys = makeSystem();
    expect(() => sys.service.getAccountSummary("ghost")).toThrow("Account not found");
  });
});
