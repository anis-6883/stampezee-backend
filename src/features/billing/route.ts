import express from "express";
import { getAllBillings } from "./controller";

const router = express.Router();

router.get("/all", getAllBillings);

export default router;
