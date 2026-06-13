import { Position } from "./Position";

export class PositionManager {
  private positions: Map<string, Position[]> = new Map();

  get(userId: string, market: string) {
    return this.positions
      .get(userId)
      ?.find((pos) => pos.market === market && pos.isOpen);
  }

  getOpen(userId: string): Position[] {
    return (this.positions.get(userId) ?? []).filter((pos) => pos.isOpen);
  }

  add(position: Position) {
    const existing = this.positions.get(position.userId) ?? [];
    // removing closed positions
    const open = existing.filter((p) => p.isOpen);
    open.push(position);
    this.positions.set(position.userId, open);
  }

  forEachOpen(callback: (userId: string, position: Position) => void) {
    for (const [userId, positions] of this.positions) {
      for (const pos of positions) {
        if (pos.isOpen) callback(userId, pos);
      }
    }
  }

  close(userId: string, market: string) {
    const pos = this.get(userId, market);
    if (pos) pos.close();
  }

  purge(userId: string): void {
    const positions = this.positions.get(userId);
    if (!positions) return;
    const open = positions.filter((p) => p.isOpen);
    if (open.length === 0) {
      this.positions.delete(userId);
    } else {
      this.positions.set(userId, open);
    }
  }

  serialise() {
    return {
      positions: Array.from(this.positions).map(
        ([userId, positions]) =>
          [userId, positions.map((pos) => pos.serialise())] as const,
      ),
    };
  }

  restoreFrom(data: ReturnType<PositionManager["serialise"]>): void {
    this.positions = new Map(
      data.positions.map(([userId, positions]) => [
        userId,
        positions.map((pos) => Position.fromSerialised(pos)),
      ]),
    );
  }
}
