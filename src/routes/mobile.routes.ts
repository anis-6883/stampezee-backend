import express from "express";
import customerAuthRoutes from "../features/user/customer/route";
import subAdminAuthRoutes from "../features/user/sub-admin/route";

const router = express.Router();

router.use("/customer", customerAuthRoutes);
router.use("/sub-admin", subAdminAuthRoutes);

export default router;
