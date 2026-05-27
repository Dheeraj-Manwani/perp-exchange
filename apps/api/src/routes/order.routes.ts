import { Router } from "express";
import * as orderController from "../controller/order.controller";

const router: Router = Router();

router.post("/order", orderController.createOrder);
router.delete("/order/:id", orderController.cancelOrder);

export default router;
