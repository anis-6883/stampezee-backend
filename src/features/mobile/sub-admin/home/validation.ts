import Joi from "joi";
import { requiredObjectIdField } from "../../../../helpers";

const amount = Joi.number().required().min(1).messages({
  "any.required": "amount is required!",
  "number.base": "amount must be number!",
  "number.min": "amount must be greater than 0!",
});

export const orderStampSchema = Joi.object({
  collectStampId: requiredObjectIdField("collectStampId"),
});

export const updateStampSchema = Joi.object({
  orderStampId: requiredObjectIdField("orderStampId"),
});
