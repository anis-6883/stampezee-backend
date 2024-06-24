import express from "express";
import { collectStamp, getAllCategories, getAllStampsByLocation } from "./controller";

const router = express.Router();

router.get("/categories", getAllCategories);
router.get("/branch-list-by-location", getAllStampsByLocation);
router.post("/collect", collectStamp);

export default router;
