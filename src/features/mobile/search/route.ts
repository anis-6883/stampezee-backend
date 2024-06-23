import express from "express";
import { getAllCategories, getAllStampsByLocation } from "./controller";

const router = express.Router();

router.get("/categories", getAllCategories);
router.get("/branch-list-by-location", getAllStampsByLocation);

export default router;
