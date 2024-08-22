import express from "express";
import {
  confirmDeleteCurrencyExchange,
  createCurrencyExchange,
  getAllCurrencyExchanges,
  getSingleCurrencyExchange,
  updateCurrencyExchange,
  updateCurrencyExchangeStatus,
} from "./controller";

const router = express.Router();

router.post("/", createCurrencyExchange);
router.get("/all", getAllCurrencyExchanges);
router.put("/status/:id", updateCurrencyExchangeStatus);
router.get("/:id", getSingleCurrencyExchange);
router.put("/:id", updateCurrencyExchange);
router.delete("/:id", confirmDeleteCurrencyExchange);

export default router;
