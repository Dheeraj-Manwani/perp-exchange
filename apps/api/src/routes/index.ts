import { authenticate } from "../middleware/auth.middleware";
import authRouter from "./auth.routes";
import orderRouter from "./order.routes";
import balanceRouter from "./balances.routes";
import { Router } from "express";

export const routes: Router = Router();

routes.get("/health", (_req, res) => res.json({ status: "ok" }));
routes.use(authRouter);

routes.use(authenticate);

routes.use(orderRouter);
routes.use(balanceRouter);
