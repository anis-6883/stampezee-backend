import express from "express";

import { superAdminAuthorize } from "../../../middlewares/authMiddleware";
import { superAdminLogin, superAdminLogout, superAdminProfile, superAdminRegistration } from "./controller";

const router = express.Router();

router.post("/register", superAdminRegistration);
router.post("/login", superAdminLogin);
router.post("/logout", superAdminLogout);
router.get("/profile", superAdminAuthorize, superAdminProfile);

export default router;
