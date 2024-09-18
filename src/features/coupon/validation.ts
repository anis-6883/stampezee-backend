import Joi from "joi";
import { requiredBooleanField, requiredStringField, stringField } from "../../helpers";

const startedAt = Joi.date().messages({
  "date.base": "startedAt must be date!",
});

const expiredAt = Joi.date().greater(Joi.ref("startedAt")).messages({
  "date.base": "expiredAt must be date!",
  "date.greater": "expiredAt must be greater than startedAt!",
  "date.ref": "expiredAt must be greater than startedAt!",
});

const discountType = Joi.string().trim().lowercase().valid("percentage", "flat").messages({
  "any.required": "discountType is required!",
  "string.base": "discountType must be string!",
  "any.only": "discountType must be [percentage, flat]",
  "string.empty": "discountType must not be empty!",
});

const discount = Joi.number().min(1).messages({
  "number.base": "discount must be number!",
  "any.required": "discount is required!",
  "number.min": "discount must be greater than or equal to 1!",
});

const limit = Joi.number().min(1).messages({
  "number.base": "limit must be number!",
  "any.required": "limit is required!",
  "number.min": "limit must be greater than or equal to 1!",
});

const minPurchaseAmount = Joi.number().min(0).messages({
  "number.base": "minPurchaseAmount must be number!",
  "any.required": "minPurchaseAmount is required!",
  "number.min": "minPurchaseAmount must be greater than or equal to 0!",
});

const code = Joi.string().trim().min(6).messages({
  "string.base": `code must be string!`,
  "string.empty": `code must not be empty!`,
  "string.min": `code must be 6 characters long!`,
});

const allowedRetailers = Joi.array().items(Joi.string().allow(null)).messages({
  "array.base": "allowedRetailers must be array!",
});

export const couponSchema = Joi.object({
  title: requiredStringField("title"),
  description: stringField("description"),
  code: code.required().messages({
    "any.required": "code is required!",
  }),
  startedAt: startedAt.required().messages({
    "any.required": "startedAt is required!",
  }),
  expiredAt: expiredAt.required().messages({
    "any.required": "expiredAt is required!",
  }),
  discountType: discountType.required().messages({
    "any.required": "discountType is required!",
  }),
  discount: discount.required().messages({
    "any.required": "discount is required!",
  }),
  limit: limit.required().messages({
    "any.required": "limit is required!",
  }),
  minPurchaseAmount: minPurchaseAmount.required().messages({
    "any.required": "minPurchaseAmount is required!",
  }),
  allowedRetailers,
});

export const updateCouponSchema = Joi.object({
  title: stringField("title"),
  description: stringField("description"),
  code,
  startedAt,
  expiredAt,
  discountType,
  discount,
  limit,
  minPurchaseAmount,
  allowedRetailers,
});

export const couponStatusSchema = Joi.object({
  status: requiredBooleanField("status"),
});
