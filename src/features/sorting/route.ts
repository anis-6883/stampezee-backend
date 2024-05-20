import express from "express";
import { updateSortingData } from "./controller";

const router = express.Router();

router.post("/", updateSortingData);

export default router;
