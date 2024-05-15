import express from "express";

import { superAdminAuthorize } from "../../../middlewares/authMiddleware";
import { superAdminLogin, superAdminLogout, superAdminProfile, superAdminRegistration } from "./controller";

const router = express.Router();

router.post("/secret/super-admin/register", superAdminRegistration);
router.post("/super-admin/login", superAdminLogin);
router.post("/super-admin/logout", superAdminLogout);
router.get("/super-admin/profile", superAdminAuthorize, superAdminProfile);

export default router;
