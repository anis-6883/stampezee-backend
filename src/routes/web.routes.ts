import express from "express";
import { authCheck } from "../modules/user/controller";
import userAuthRoutes from "../modules/user/route";

const router = express.Router();

router.get("/auth-check", authCheck);
router.use("/users", userAuthRoutes);

export default router;
