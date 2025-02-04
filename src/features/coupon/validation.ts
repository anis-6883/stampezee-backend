import Joi from "joi";
import { requiredBooleanField, requiredStringField, stringField } from "../../helpers";

const startedAt = Joi.date().messages({
  "date.base": "startedAt must be date!",
});

const expiredAt = Joi.date().messages({
  "date.base": "expiredAt must be date!",
});

const discountType = Joi.string().trim().lowercase().valid("percentage", "flat").messages({
  "any.required": "discountType is required!",
  "string.base": "discountType must be string!",
  "any.only": "discountType must be [percentage, flat]",
  "string.empty": "discountType must not be empty!",
});

const discount = Joi.alternatives().conditional("discountType", {
  is: "percentage",
  then: Joi.number().max(50).messages({
    "number.base": "discount must be number!",
    "any.required": "discount is required!",
    "number.min": "discount must be smaller than or equal to 50!",
  }),
  otherwise: Joi.number().min(1).messages({
    "number.base": "discount must be number!",
    "any.required": "discount is required!",
    "number.min": "discount must be greater than or equal to 1!",
  }),
});

const totalUserLimit = Joi.number().min(0).default(0).messages({
  "number.base": "totalUserLimit must be number!",
  "any.required": "totalUserLimit is required!",
  "number.min": "totalUserLimit must be greater than or equal to 0!",
});

const perUserLimit = Joi.number().min(0).default(0).messages({
  "number.base": "perUserLimit must be number!",
  "any.required": "perUserLimit is required!",
  "number.min": "perUserLimit must be greater than or equal to 1!",
});

const code = Joi.string().trim().min(4).messages({
  "string.base": `code must be string!`,
  "string.empty": `code must not be empty!`,
  "string.min": `code must be 4 characters long!`,
});

const allowFor = Joi.string().trim().lowercase().valid("all", "specific").messages({
  "any.required": "allowFor is required!",
  "string.base": "allowFor must be string!",
  "any.only": "allowFor must be [all, specific]",
  "string.empty": "allowFor must not be empty!",
});

const allowedRetailers = Joi.array().items(Joi.string().allow(null)).messages({
  "array.base": "allowedRetailers must be array!",
});

const applicablePackages = Joi.array().items(Joi.string().allow(null)).messages({
  "array.base": "applicablePackages must be array!",
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
  totalUserLimit,
  perUserLimit,
  allowFor: allowFor.required().messages({
    "any.required": "allowFor is required!",
  }),
  applicablePackages: applicablePackages.required().messages({
    "any.required": "applicablePackages is required!",
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
  totalUserLimit,
  perUserLimit,
  allowFor,
  allowedRetailers,
  applicablePackages,
});

export const couponStatusSchema = Joi.object({
  status: requiredBooleanField("status"),
});
