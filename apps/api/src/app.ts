import express, { Express } from "express";
import cookieParser from "cookie-parser";
import { httpLogger } from "@repo/logger";
import { errorHandler } from "./middleware/errorHandler";
import { routes } from "./routes/index";

export const app: Express = express();

app.use(express.json());
app.use(cookieParser());
app.use(httpLogger);
app.use(routes);
app.use(errorHandler);
