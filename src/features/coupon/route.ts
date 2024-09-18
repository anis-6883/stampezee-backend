import express from "express";
import {
  confirmDeleteCoupon,
  createCoupon,
  getAllCoupons,
  getAllDeletedCoupons,
  getAllRetailers,
  getSingleCoupon,
  softDeleteCoupon,
  updateCoupon,
  updateCouponStatus,
} from "./controller";

const router = express.Router();

router.post("/", createCoupon);
router.get("/all", getAllCoupons);
router.get("/all-retailers", getAllRetailers);
router.get("/deleted", getAllDeletedCoupons);
router.put("/status/:id", updateCouponStatus);
router.delete("/confirm/:id", confirmDeleteCoupon);
router.get("/:id", getSingleCoupon);
router.put("/:id", updateCoupon);
router.delete("/:id", softDeleteCoupon);

export default router;
