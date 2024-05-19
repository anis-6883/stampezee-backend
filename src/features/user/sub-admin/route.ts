import express from "express";

import { ROLE } from "../../../configs/constants";
import { authAndPermissionCheck } from "../../../middlewares/authMiddleware";
import { subAdminLogin, subAdminProfile } from "./controller";

const router = express.Router();

router.post("/login", subAdminLogin);
router.get("/profile", authAndPermissionCheck(ROLE.SUB_ADMIN), subAdminProfile);

export default router;
