import express from "express";
import { authCheck, refreshAccessToken } from "../features/user/controller";
import retailerAuthRoutes from "../features/user/retailer/route";

const router = express.Router();

router.use("/auth-check", authCheck);
router.use("/refresh-token", refreshAccessToken);
router.use("/retailer", retailerAuthRoutes);

export default router;
