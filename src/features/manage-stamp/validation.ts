import Joi from "joi";

const branchId = Joi.string().trim().required().messages({
  "any.required": "branchId is required!",
  "string.base": "branchId must be string!",
  "string.empty": "branchId must not be empty!",
});

const stampImageId = Joi.string().trim().required().messages({
  "any.required": "stampImageId is required!",
  "string.base": "stampImageId must be string!",
  "string.empty": "stampImageId must not be empty!",
});

const categoryId = Joi.string().trim().required().messages({
  "any.required": "categoryId is required!",
  "string.base": "categoryId must be string!",
  "string.empty": "categoryId must not be empty!",
});

const title = Joi.string().trim().required().messages({
  "any.required": "title is required!",
  "string.base": "title must be string!",
  "string.empty": "title must not be empty!",
});

const updateTitle = Joi.string().trim().messages({
  "string.base": "title must be string!",
  "string.empty": "title must not be empty!",
});

const description = Joi.string().allow("").trim().messages({
  "string.base": "description must be string!",
});

const rules = Joi.string().allow("").messages({
  "string.base": "rules must be string!",
});

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
  title,
  branchId,
  categoryId,
  stampImageId,
  description,
  rules,
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
  title: updateTitle,
  noOfStampsToCollect: updateNoOfStampsToCollect,
  startedAt: updateStartedAt,
  expiredAt: updateExpiredAt,
});
