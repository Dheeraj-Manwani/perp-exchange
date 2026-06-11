import { authenticate } from "../middleware/auth.middleware";
import authRouter from "./auth.routes";
import orderRouter from "./order.routes";
import balanceRouter from "./balances.routes";
import marketRouter from "./market.routes";
import { Router } from "express";

export const routes: Router = Router();

routes.get("/health", (_req, res) => res.json({ status: "ok" }));
routes.get("/server/time", (_req, res) =>
  res.json({ success: true, data: { serverTime: Date.now() } }),
);
routes.use(authRouter);
routes.use(marketRouter);

routes.use(authenticate);

routes.use(orderRouter);
routes.use(balanceRouter);
