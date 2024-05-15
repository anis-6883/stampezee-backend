import express from "express";
import adminAuthRoutes from "../features/user/super-admin/route";

const router = express.Router();

router.use("/", adminAuthRoutes);

export default router;
