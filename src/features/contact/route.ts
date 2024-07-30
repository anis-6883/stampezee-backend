import express from "express";
import { contactMessageList } from "./controller";

const router = express.Router();

router.get("/list", contactMessageList);

export default router;
