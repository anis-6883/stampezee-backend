import Joi from "joi";
import { requiredStringField, stringField } from "../../helpers";

export const faqSchema = Joi.object({
  title: requiredStringField("title"),
  description: requiredStringField("description"),
});

export const updateFaqSchema = Joi.object({
  title: stringField("title"),
  description: stringField("description"),
});

export const faqStatusSchema = Joi.object({
  status: Joi.boolean().required().messages({
    "any.required": "status is required!",
    "boolean.base": "status must be boolean!",
    "boolean.empty": "status must not be empty!",
  }),
});
