import express from "express";

// import { subAdminAuthorize } from "../../../middlewares/authMiddleware";
import { subAdminLogin, subAdminLogout } from "./controller";

const router = express.Router();

router.post("/login", subAdminLogin);
router.post("/logout", subAdminLogout);
// router.get("/profile", subAdminAuthorize, subAdminProfile);

export default router;
