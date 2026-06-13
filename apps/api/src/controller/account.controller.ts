import { Request, Response } from "express";
import {
  accountTransactionsQuery,
  fundingPaymentsQuery,
  liquidationsQuery,
} from "@repo/schema";
import * as accountService from "../service/account.service";
import { ok } from "../lib/response";

// GET /account
export const getAccountSummary = async (req: Request, res: Response) => {
  const data = await accountService.getAccountSummary(req.userId!);
  ok(res, data);
};

// GET /account/balances
export const getBalances = async (req: Request, res: Response) => {
  const data = await accountService.getBalances(req.userId!);
  ok(res, data);
};

// GET /account/transactions
export const getTransactions = async (req: Request, res: Response) => {
  const query = accountTransactionsQuery.parse(req.query);
  const data = await accountService.getTransactions(req.userId!, query);
  ok(res, data);
};

// GET /account/funding-payments
export const getFundingPayments = async (req: Request, res: Response) => {
  const query = fundingPaymentsQuery.parse(req.query);
  const data = await accountService.getFundingPayments(req.userId!, query);
  ok(res, data);
};

// GET /account/liquidations
export const getLiquidations = async (req: Request, res: Response) => {
  const query = liquidationsQuery.parse(req.query);
  const data = await accountService.getLiquidations(req.userId!, query);
  ok(res, data);
};

// GET /account/fees
export const getFees = async (_req: Request, res: Response) => {
  ok(res, accountService.getFees());
};
