import express from "express";
import adminAuthRoutes from "../modules/admin/route";

const router = express.Router();

router.use("/", adminAuthRoutes);

export default router;
