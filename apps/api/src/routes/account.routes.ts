import { Router } from "express";
import * as accountController from "../controller/account.controller";

const router: Router = Router();

// Account & balance history (sprint 4). All authenticated.
router.get("/account/balances", accountController.getBalances);
router.get("/account/transactions", accountController.getTransactions);
router.get("/account/funding-payments", accountController.getFundingPayments);
router.get("/account/liquidations", accountController.getLiquidations);
router.get("/account/fees", accountController.getFees);

export default router;
