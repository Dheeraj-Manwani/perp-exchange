import { Router } from "express";
import * as marketController from "../controller/market.controller";
import * as fillController from "../controller/fill.controller";

const router: Router = Router();

router.get("/markets", marketController.getMarkets);
router.get("/markets/:symbol", marketController.getMarket);
router.get("/markets/:symbol/index-price", marketController.getIndexPrice);
router.get("/markets/:symbol/funding-rate", marketController.getFundingRate);
router.get(
  "/markets/:symbol/funding-rate/history",
  marketController.getFundingRateHistory,
);
// Public recent-trades tape (sprint 3) — lives under /markets but reads fills.
router.get("/markets/:symbol/trades", fillController.getPublicTrades);

export default router;
