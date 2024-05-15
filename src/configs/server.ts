import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import logger from "morgan";
import errorMiddleware from "../middlewares/errorMiddleware";
import verifyApiKeyHeader from "../middlewares/verifyApiKeyHeader";
import adminRoutes from "../routes/admin.routes";
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
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(verifyApiKeyHeader);

// Connect to MongoDB with Mongoose
connectToDatabase(config[env].databaseURI);

// Home Route
app.get("/", (req, res) => {
  return res.status(200).json({ message: "Assalamu Alaikum World!" });
});

// Main Routes
app.use("/api/v1", webRoutes); // web
app.use("/api/v1/admin", adminRoutes); // admin

// 404 Route
app.use((req, res, next) => {
  return res.status(404).send({ status: false, message: "This route does not exist!" });
});

// Error Handling Middleware
app.use(errorMiddleware);

export default app;
