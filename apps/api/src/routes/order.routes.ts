import { NextFunction, Request, Response, Router } from "express";
import * as orderController from "../controller/order.controller";

const router: Router = Router();

router.post("/order", orderController.createOrder);

export default router;
