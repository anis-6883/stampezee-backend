import express from "express";
import {
  confirmDeleteStamp,
  createStamp,
  getAllDeletedStamps,
  getAllStamps,
  getBranchCategoryImageList,
  getSingleStamp,
  publishStamp,
  softDeleteStamp,
  updateStamp,
  updateStampStatus,
} from "../controller";

const router = express.Router();

router.post("/", createStamp);
router.get("/all", getAllStamps);
router.get("/branch-category-image-list", getBranchCategoryImageList);
router.get("/deleted", getAllDeletedStamps);
router.put("/publish/:id", publishStamp);
router.put("/status/:id", updateStampStatus);
router.get("/:id", getSingleStamp);
router.put("/:id", updateStamp);
router.delete("/:id", softDeleteStamp);
router.delete("/confirm/:id", confirmDeleteStamp);

export default router;
