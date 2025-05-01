import Joi from "joi";
import { requiredBooleanField, requiredStringField, stringField } from "../../helpers";

export const categorySchema = Joi.object({
  name: requiredStringField("name"),
  description: stringField("description"),
});

export const updateCategorySchema = Joi.object({
  name: stringField("name"),
  description: stringField("description"),
});

export const categoryStatusSchema = Joi.object({
  status: requiredBooleanField("status"),
});
