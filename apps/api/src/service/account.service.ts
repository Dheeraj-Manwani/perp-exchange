import {
  AccountTransactionsQuery,
  FundingPaymentsQuery,
  GetAccountSummaryEngineResponse,
  LiquidationsQuery,
  TAKER_FEE_RATE,
  MAKER_FEE_RATE,
  TAKER_FEE_NUMERATOR,
  MAKER_FEE_NUMERATOR,
  FEE_DENOMINATOR,
} from "@repo/schema";
import { AppError, ErrorCode } from "../errors/AppError";
import { sendToEngineWithPubSubResponse } from "../lib/engine-client";
import * as accountRepository from "../repository/account.repository";

// ─── Balances ─────────────────────────────────────────────────────────────────

export const getBalances = async (userId: string) => {
  const rows = await accountRepository.findBalances(userId);
  return rows.map((b) => ({
    asset: b.asset,
    available: b.availableBalance,
    locked: b.lockedBalance,
    updatedAt: b.updatedAt,
  }));
};

export const getAccountSummary = async (userId: string) => {
  const [response, balances] = await Promise.all([
    sendToEngineWithPubSubResponse("get_account_summary", {}, userId),
    getBalances(userId),
  ]);

  if (!response.ok || !response.data) {
    throw new AppError(
      503,
      ErrorCode.SERVICE_UNAVAILABLE,
      response.error ?? "Account summary unavailable",
    );
  }

  const { equity, availableMargin, usedMargin, unrealisedPnl } =
    response.data as unknown as GetAccountSummaryEngineResponse;

  return { equity, availableMargin, usedMargin, unrealisedPnl, balances };
};

// ─── Transaction ledger ───────────────────────────────────────────────────────

type TransactionRow = Awaited<
  ReturnType<typeof accountRepository.findTransactions>
>[number];

const toTransactionDto = (t: TransactionRow) => ({
  id: t.id,
  type: t.type,
  asset: t.asset,
  amount: t.amount,
  balanceAfter: t.balanceAfter,
  symbol: t.market?.symbol ?? null,
  referenceId: t.referenceId,
  createdAt: t.createdAt,
});

export const getTransactions = async (
  userId: string,
  query: AccountTransactionsQuery,
) => {
  const [rows, total] = await Promise.all([
    accountRepository.findTransactions(
      userId,
      query.type,
      query.limit,
      query.page,
    ),
    accountRepository.countTransactions(userId, query.type),
  ]);

  return {
    items: rows.map(toTransactionDto),
    page: query.page,
    limit: query.limit,
    total,
  };
};

// ─── Funding payments ─────────────────────────────────────────────────────────

// Funding rows reuse the ledger shape but surface the funding period explicitly
// (stored in referenceId by db-writer) alongside the market symbol.
export const getFundingPayments = async (
  userId: string,
  query: FundingPaymentsQuery,
) => {
  const [rows, total] = await Promise.all([
    accountRepository.findFundingPayments(
      userId,
      query.symbol,
      query.limit,
      query.page,
    ),
    accountRepository.countFundingPayments(userId, query.symbol),
  ]);

  return {
    items: rows.map((t) => ({
      id: t.id,
      symbol: t.market?.symbol ?? null,
      period: t.referenceId,
      amount: t.amount,
      balanceAfter: t.balanceAfter,
      createdAt: t.createdAt,
    })),
    page: query.page,
    limit: query.limit,
    total,
  };
};

// ─── Liquidations ─────────────────────────────────────────────────────────────

type LiquidationRow = Awaited<
  ReturnType<typeof accountRepository.findLiquidations>
>[number];

const toLiquidationDto = (o: LiquidationRow) => ({
  orderId: o.id,
  symbol: o.market.symbol,
  side: o.side,
  status: o.status,
  price: o.price,
  qty: o.qty,
  filledQty: o.filledQty,
  leverage: o.leverage,
  createdAt: o.createdAt,
  updatedAt: o.updatedAt,
  fills: o.takerFills.map((f) => ({
    id: f.id,
    price: f.price,
    qty: f.qty,
    createdAt: f.createdAt,
  })),
});

export const getLiquidations = async (
  userId: string,
  query: LiquidationsQuery,
) => {
  const [rows, total] = await Promise.all([
    accountRepository.findLiquidations(
      userId,
      query.symbol,
      query.limit,
      query.page,
    ),
    accountRepository.countLiquidations(userId, query.symbol),
  ]);

  return {
    items: rows.map(toLiquidationDto),
    page: query.page,
    limit: query.limit,
    total,
  };
};

// ─── Fees (static reference) ──────────────────────────────────────────────────

// Maker/taker rates are platform constants — exposed so the UI can show the fee
// schedule and pre-compute costs client-side.
export const getFees = () => ({
  takerFeeRate: TAKER_FEE_RATE,
  makerFeeRate: MAKER_FEE_RATE,
  takerFeeBps: Number(TAKER_FEE_NUMERATOR),
  makerFeeBps: Number(MAKER_FEE_NUMERATOR),
  feeDenominator: Number(FEE_DENOMINATOR),
});
