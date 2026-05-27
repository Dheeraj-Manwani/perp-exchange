import { Position } from "./Position";

export class PositionManager {
  private positions: Map<string, Position[]> = new Map();

  get(userId: string, market: string) {
    return this.positions
      .get(userId)
      ?.find((pos) => pos.market === market && pos.isOpen);
  }

  add(position: Position) {
    const existing = this.positions.get(position.userId) ?? [];
    // removing closed positions
    const open = existing.filter((p) => p.isOpen);
    open.push(position);
    this.positions.set(position.userId, open);
  }
}
