import Joi from "joi";
import { requiredBooleanField, requiredStringField, stringField } from "../../helpers";

export const faqSchema = Joi.object({
  title: requiredStringField("title"),
  description: requiredStringField("description"),
});

export const updateFaqSchema = Joi.object({
  title: stringField("title"),
  description: stringField("description"),
});

export const faqStatusSchema = Joi.object({
  status: requiredBooleanField("status"),
});
