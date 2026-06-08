import { Prisma } from "@repo/db";

const isUniqueConstraintError = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

/**
 * Records that an engine event has been applied, inside the same transaction
 * as the writes it produces. Returns false if the event was already applied
 * so this is safe under concurrent/duplicate delivery.
 */
export const claimEvent = async (
  tx: Prisma.TransactionClient,
  eventId: string,
): Promise<boolean> => {
  try {
    await tx.processedEngineEvent.create({ data: { id: eventId } });
    return true;
  } catch (error) {
    if (isUniqueConstraintError(error)) return false;
    throw error;
  }
};
