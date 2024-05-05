import express from "express";
import { authCheck } from "../features/user/controller";
import userAuthRoutes from "../features/user/route";

const router = express.Router();

router.get("/auth-check", authCheck);
router.use("/user", userAuthRoutes);

export default router;
