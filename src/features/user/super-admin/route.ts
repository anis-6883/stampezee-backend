import express from "express";

import { ROLE } from "../../../configs/constants";
import { authAndPermissionCheck } from "../../../middlewares/authMiddleware";
import { superAdminLogin, superAdminLogout, superAdminProfile, superAdminRegistration } from "./controller";

const router = express.Router();

router.post("/register", superAdminRegistration);
router.post("/login", superAdminLogin);
router.post("/logout", superAdminLogout);
router.get("/profile", authAndPermissionCheck(ROLE.SUPER_ADMIN), superAdminProfile);

export default router;
