import { Router } from "express";
import * as positionsController from "../controller/positions.controller";

const router: Router = Router();

router.get("/positions", positionsController.getPositions);
router.get("/positions/history", positionsController.getPositionHistory);
router.get("/positions/:symbol", positionsController.getPosition);

export default router;
