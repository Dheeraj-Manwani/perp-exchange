import express from "express";
import cookieParser from "cookie-parser";
import { env } from "./lib/env";
import { errorHandler } from "./middleware/errorHandler";
import { unProtectedRoutes, protectedRoutes } from "./routes/index";
import { authenticate } from "./middleware/auth.middleware";

const app = express();
const PORT = env.PORT;

app.use(express.json());
app.use(cookieParser());

app.use(unProtectedRoutes);
app.use(authenticate);
app.use(protectedRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});
