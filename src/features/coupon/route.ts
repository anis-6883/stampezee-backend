import express from "express";
import {
  confirmDeleteCoupon,
  createCoupon,
  getAllCategories,
  getAllDeletedCategories,
  getSingleCoupon,
  softDeleteCoupon,
  updateCoupon,
  updateCouponStatus,
} from "./controller";

const router = express.Router();

router.post("/", createCoupon);
router.get("/all", getAllCategories);
router.get("/deleted", getAllDeletedCategories);
router.put("/status/:id", updateCouponStatus);
router.delete("/confirm/:id", confirmDeleteCoupon);
router.get("/:id", getSingleCoupon);
router.put("/:id", updateCoupon);
router.delete("/:id", softDeleteCoupon);

export default router;
