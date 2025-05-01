import Joi from "joi";
import { requiredBooleanField, requiredStringField, stringField } from "../../helpers";

const noOfStampsToCollect = Joi.number().required().min(1).max(20).messages({
  "any.required": "noOfStampsToCollect is required!",
  "number.base": "noOfStampsToCollect must be number!",
  "number.min": "noOfStampsToCollect must be greater than 0!",
  "number.max": "noOfStampsToCollect must be less than or equal to 20!",
});

const updateNoOfStampsToCollect = Joi.number().min(1).messages({
  "number.base": "noOfStampsToCollect must be number!",
  "number.min": "noOfStampsToCollect must be greater than 0!",
});

const minPurchaseAmount = Joi.number().min(0).messages({
  "number.base": "minPurchaseAmount must be number!",
  "number.min": "minPurchaseAmount must be greater than or equal to 0!",
});

const rewardType = Joi.string().trim().lowercase().valid("promotion", "discount").messages({
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

const hasValidity = Joi.boolean().required().messages({
  "any.required": "hasValidity is required!",
  "boolean.base": "hasValidity must be a boolean value!",
});

const isPublished = Joi.boolean().messages({
  "boolean.base": "isPublished must be a boolean value!",
});

const startedAt = Joi.date().messages({
  "date.base": "startedAt must be date!",
});

const expiredAt = Joi.date().min(Joi.ref("startedAt")).messages({
  "date.base": "expiredAt must be date!",
  "date.min": "expiredAt must be greater than or equal to startedAt!",
  "date.ref": "expiredAt must be greater than startedAt!",
});

export const stampSchema = Joi.object({
  title: requiredStringField("title"),
  branchId: requiredStringField("branchId"),
  categoryId: requiredStringField("categoryId"),
  stampImageId: requiredStringField("stampImageId"),
  description: stringField("description"),
  rules: stringField("description"),
  noOfStampsToCollect,
  minPurchaseAmount,
  promotionReward,
  hasValidity,
  discountReward,
  rewardType: rewardType.required().messages({
    "any.required": "rewardType is required!",
  }),
  isPublished: isPublished.required().messages({
    "any.required": "isPublished is required!",
  }),
  startedAt: Joi.date().when("hasValidity", {
    is: true,
    then: Joi.required().messages({
      "date.base": "startedAt must be a date!",
      "any.required": "startedAt is required!",
    }),
    otherwise: Joi.optional(),
  }),
  expiredAt: Joi.date().when("hasValidity", {
    is: true,
    then: Joi.date().min(Joi.ref("startedAt")).required().messages({
      "date.base": "expiredAt must be a date!",
      "date.min": "expiredAt must be greater than or equal to startedAt!",
      "any.required": "expiredAt is required!",
    }),
    otherwise: Joi.optional(),
  }),
});

export const updateStampSchema = Joi.object({
  title: stringField("title"),
  noOfStampsToCollect: updateNoOfStampsToCollect,
  startedAt,
  expiredAt,
  rewardType,
  isPublished,
});

export const stampStatusSchema = Joi.object({
  status: requiredBooleanField("status"),
});
