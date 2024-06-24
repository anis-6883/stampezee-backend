import express from "express";
import { collectStamp, getAllCategories, getAllStampsByLocation } from "./controller";

const router = express.Router();

router.get("/stamp-categories", getAllCategories);
router.get("/branch-list-by-location", getAllStampsByLocation);
router.post("/stamp-collect", collectStamp);

export default router;
