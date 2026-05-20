import { Router } from "express";
import * as authController from "../controller/auth.controller";

const router: Router = Router();

router.post("/auth/signup", authController.signUp);
router.post("/auth/signin", authController.signIn);
router.post("/auth/refresh", authController.refresh);

export default router;
