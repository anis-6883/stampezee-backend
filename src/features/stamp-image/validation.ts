import Joi from "joi";
import { requiredStringField, stringField } from "../../helpers";

export const stampImageSchema = Joi.object({
  title: requiredStringField("title"),
});

export const stampImageUpdateSchema = Joi.object({
  title: stringField("title"),
});

export const stampImageStatusSchema = Joi.object({
  status: Joi.boolean().required().messages({
    "any.required": "status is required!",
    "boolean.base": "status must be boolean!",
    "boolean.empty": "status must not be empty!",
  }),
});
