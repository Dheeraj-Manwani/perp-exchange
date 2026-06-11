import { Router } from "express";
import * as marketController from "../controller/market.controller";

const router: Router = Router();

router.get("/markets", marketController.getMarkets);
router.get("/markets/:symbol", marketController.getMarket);
router.get("/markets/:symbol/index-price", marketController.getIndexPrice);
router.get("/markets/:symbol/funding-rate", marketController.getFundingRate);
router.get(
  "/markets/:symbol/funding-rate/history",
  marketController.getFundingRateHistory,
);

export default router;
