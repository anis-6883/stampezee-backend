import express from "express";
import { getAllReward } from "./controller";

const router = express.Router();

router.get("/reward/list", getAllReward);

export default router;
