import { Router } from "express";
import * as balancesController from "../controller/balances.controller";

const router: Router = Router();

router.post("/onramp", balancesController.onRamp);

export default router;
