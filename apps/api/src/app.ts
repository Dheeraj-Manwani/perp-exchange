import express, { Express } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { httpLogger } from "@repo/logger";
import { errorHandler } from "./middleware/errorHandler";
import { routes } from "./routes/index";

export const app: Express = express();

const allowedOrigins = (process.env.WEB_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());
app.use(httpLogger);
app.use(routes);
app.use(errorHandler);
