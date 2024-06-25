import express from "express";
import multer from "multer";
import { ROLE } from "../../../configs/constants";
import { authAndPermissionCheck } from "../../../middlewares/authMiddleware";
import {
  superAdminLogin,
  superAdminLogout,
  superAdminProfile,
  superAdminRegistration,
  updateSuperAdminProfile,
} from "./controller";

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const router = express.Router();

router.post("/register", superAdminRegistration);
router.post("/login", superAdminLogin);
router.post("/logout", superAdminLogout);

router.use(authAndPermissionCheck(ROLE.SUPER_ADMIN));
router.get("/profile", superAdminProfile);
router.put("/profile", upload.single("image"), updateSuperAdminProfile);

export default router;
