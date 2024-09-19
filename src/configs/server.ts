import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import logger from "morgan";
import { stripeWebhookHandler } from "../features/enroll-subscription/controller";
import seederRoutes from "../features/seeder/route";
import errorMiddleware from "../middlewares/errorMiddleware";
import verifyApiKeyHeader from "../middlewares/verifyApiKeyHeader";
import adminRoutes from "../routes/admin.routes";
import mobileRoutes from "../routes/mobile.routes";
import webRoutes from "../routes/web.routes";
import config from "./config";
import connectToDatabase from "./database";

const app = express();
const env = process.env.NODE_ENV || "development";

// Batteries Include
app.use(helmet());
app.use(logger("dev"));
app.use(cookieParser());
app.use(express.static("public"));
app.use(cors(config[env].corsOptions));
app.post("/stripe/webhook", express.raw({ type: "application/json" }), stripeWebhookHandler);
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

// Connect to MongoDB with Mongoose
connectToDatabase(config[env].databaseURI);

// Home Route
app.get("/", (req, res) => {
  return res.status(200).json({ status: true, message: "Assalamu Alaikum! Welcome to StampEzee." });
});

// Main Routes
app.use("/api/web", webRoutes); // web
app.use(verifyApiKeyHeader);
app.use("/api/v1", mobileRoutes); // mobile
app.use("/api/secret-root/admin", adminRoutes); // admin
app.use("/api/seeder", seederRoutes); // admin

// 404 Route
app.use((req, res, next) => {
  return res.status(404).send({ status: false, message: "This route does not exist!" });
});

// Error Handling Middleware
app.use(errorMiddleware);

export default app;
