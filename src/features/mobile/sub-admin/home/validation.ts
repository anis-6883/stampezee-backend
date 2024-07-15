import Joi from "joi";
import { requiredObjectIdField } from "../../../../helpers";

const number = Joi.number().required().min(1).messages({
  "any.required": "number is required!",
  "number.base": "number must be number!",
  "number.min": "number must be greater than 0!",
});

export const orderStampSchema = Joi.object({
  collectStampId: requiredObjectIdField("collectStampId"),
  number,
});

export const updateStampSchema = Joi.object({
  orderStampId: requiredObjectIdField("orderStampId"),
});
