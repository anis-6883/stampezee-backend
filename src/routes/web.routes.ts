import express from "express";
import userAuthRoutes from "../features/user/route";

const router = express.Router();

router.use("/user", userAuthRoutes);

export default router;
