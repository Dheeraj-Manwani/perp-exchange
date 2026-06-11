import { Router } from "express";
import * as orderController from "../controller/order.controller";

const router: Router = Router();

router.post("/order", orderController.createOrder);
router.delete("/order/:id", orderController.cancelOrder);

// Reads (sprint 2). `/orders/history` is registered before `/orders/:orderId`
// so the static path wins over the param route.
router.get("/orders", orderController.getOpenOrders);
router.get("/orders/history", orderController.getOrderHistory);
router.get("/orders/:orderId", orderController.getOrder);
router.get("/orders/:orderId/fills", orderController.getOrderFills);
router.delete("/orders", orderController.cancelAllOrders);

export default router;
