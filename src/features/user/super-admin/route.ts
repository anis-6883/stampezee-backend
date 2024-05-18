import express from "express";

import { authorizationCheck } from "../../../middlewares/authMiddleware";
import { superAdminLogin, superAdminLogout, superAdminProfile, superAdminRegistration } from "./controller";

const router = express.Router();

router.post("/register", superAdminRegistration);
router.post("/login", superAdminLogin);
router.post("/logout", superAdminLogout);
router.get("/profile", authorizationCheck, superAdminProfile);

export default router;
