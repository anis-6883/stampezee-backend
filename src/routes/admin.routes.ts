import express from "express";
import superAdminAuthRoutes from "../features/user/super-admin/route";

const router = express.Router();

router.use("/super-admin", superAdminAuthRoutes);

export default router;
