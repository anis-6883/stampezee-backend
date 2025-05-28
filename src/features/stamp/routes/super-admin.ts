import express from "express";
import {
  deleteStampCardBySuperAdmin,
  getAllStampCardsForSuperAdmin,
  getBranchCategoryImageListBySuperAdmin,
  getSingleStampBySuperAdmin,
  updateStampBySuperAdmin,
} from "../controller";

const router = express.Router();

router.get("/all", getAllStampCardsForSuperAdmin);
router.get("/branch-category-image-list", getBranchCategoryImageListBySuperAdmin);
router.get("/:id", getSingleStampBySuperAdmin);
router.put("/:id", updateStampBySuperAdmin);
router.delete("/:id", deleteStampCardBySuperAdmin);

export default router;
