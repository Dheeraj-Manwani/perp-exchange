import authRouter from "./auth.routes";
import { Router } from "express";

export const protectedRoutes: Router = Router();

export const unProtectedRoutes: Router = Router();
unProtectedRoutes.get("/health", (_req, res) => res.json({ status: "ok" }));
unProtectedRoutes.use(authRouter);
