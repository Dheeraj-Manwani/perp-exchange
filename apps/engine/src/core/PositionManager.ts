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
    existing.push(position);
    this.positions.set(position.userId, existing);
  }
}
