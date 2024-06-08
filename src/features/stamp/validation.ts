import Joi from "joi";
import { requiredStringField, stringField } from "../../helpers";

const noOfStampsToCollect = Joi.number().required().min(1).messages({
  "any.required": "noOfStampsToCollect is required!",
  "number.base": "noOfStampsToCollect must be number!",
  "number.min": "noOfStampsToCollect must be greater than 0!",
});

const updateNoOfStampsToCollect = Joi.number().min(1).messages({
  "number.base": "noOfStampsToCollect must be number!",
  "number.min": "noOfStampsToCollect must be greater than 0!",
});

const minPurchaseAmount = Joi.number().min(0).messages({
  "number.base": "minPurchaseAmount must be number!",
  "number.min": "minPurchaseAmount must be greater than or equal to 0!",
});

const rewardType = Joi.string().trim().required().lowercase().valid("promotion", "discount").messages({
  "any.required": "rewardType is required!",
  "string.base": "rewardType must be string!",
  "any.only": "rewardType must be [promotion, discount]",
  "string.empty": "rewardType must not be empty!",
});

const promotionReward = Joi.alternatives().conditional("rewardType", {
  is: "promotion",
  then: Joi.string().required().messages({
    "any.required": "promotionReward is required!",
    "string.base": "promotionReward must be string!",
    "string.empty": "promotionReward must not be empty!",
  }),
  otherwise: Joi.string().allow("").messages({
    "string.base": "promotionReward must be string!",
  }),
});

const discountReward = Joi.alternatives().conditional("rewardType", {
  is: "discount",
  then: Joi.number().required().messages({
    "any.required": "discountReward is required!",
    "number.base": "discountReward must be number!",
    "string.empty": "discountReward must not be empty!",
  }),
  otherwise: Joi.number().messages({
    "number.base": "discountReward must be number!",
  }),
});

const startedAt = Joi.date().required().messages({
  "any.required": "startedAt is required!",
  "date.base": "startedAt must be date!",
});

const updateStartedAt = Joi.date().messages({
  "date.base": "startedAt must be date!",
});

const expiredAt = Joi.date().greater(Joi.ref("startedAt")).required().messages({
  "any.required": "expiredAt is required!",
  "date.base": "expiredAt must be date!",
  "date.greater": "expiredAt must be greater than startedAt!",
  "date.ref": "expiredAt must be greater than startedAt!",
});

const updateExpiredAt = Joi.date().greater(Joi.ref("startedAt")).messages({
  "date.base": "expiredAt must be date!",
  "date.greater": "expiredAt must be greater than startedAt!",
  "date.ref": "expiredAt must be greater than startedAt!",
});

const status = Joi.boolean().default(true);

export const stampSchema = Joi.object({
  title: requiredStringField("title"),
  branchId: requiredStringField("branchId"),
  categoryId: requiredStringField("categoryId"),
  stampImageId: requiredStringField("stampImageId"),
  description: stringField("description"),
  rules: stringField("description"),
  noOfStampsToCollect,
  minPurchaseAmount,
  rewardType,
  promotionReward,
  discountReward,
  startedAt,
  expiredAt,
  status,
});

export const updateStampSchema = Joi.object({
  title: stringField("title"),
  noOfStampsToCollect: updateNoOfStampsToCollect,
  startedAt: updateStartedAt,
  expiredAt: updateExpiredAt,
});
