import { Orderbook } from "./Orderbook";

export class OrderbookRegistry {
  private books: Map<string, Orderbook> = new Map();

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
}
