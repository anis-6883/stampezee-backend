import express from "express";
import { getAllSubscriptions } from "./controller";

const router = express.Router();

router.get("/", getAllSubscriptions);

export default router;
