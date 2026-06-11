import { Router } from "express";
import * as fillController from "../controller/fill.controller";

const router: Router = Router();

// Authenticated user fill history. `/fills` is registered before `/fills/:symbol`.
router.get("/fills", fillController.getUserFills);
router.get("/fills/:symbol", fillController.getUserFillsBySymbol);

export default router;
