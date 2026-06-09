import { Orderbook } from "./Orderbook";

export class OrderbookRegistry {
  private books: Map<string, Orderbook> = new Map();
  serialise() {
    return {
      books: Array.from(this.books).map(
        (book) => [book[0], book[1].serialise()] as const,
      ),
    };
  }

  restoreFrom(data: ReturnType<OrderbookRegistry["serialise"]>): void {
    this.books = new Map(
      data.books.map(([symbol, book]) => [symbol, Orderbook.fromSerialised(book)]),
    );
  }

  constructor(symbols: string[]) {
    this.books = new Map(
      symbols.map((symbol) => [symbol, new Orderbook(symbol)]),
    );
  }

  get(symbol: string) {
    const book = this.books.get(symbol);

    if (!book) throw new Error(`Market - ${symbol} does not exists`);
    return book;
  }

  entries(): IterableIterator<[string, Orderbook]> {
    return this.books.entries();
  }
}
