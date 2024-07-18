import express from "express";
import { getRetailerRefunds } from "../controller";

const router = express.Router();

router.get("/all", getRetailerRefunds);

export default router;
