import Joi from "joi";
import { lowercaseStringField, requiredLowercaseStringField, stringField } from "../../helpers";

export const categorySchema = Joi.object({
  name: requiredLowercaseStringField("name"),
  description: stringField("description"),
  status: Joi.boolean().default(true),
});

export const updateCategorySchema = Joi.object({
  name: lowercaseStringField("name"),
  description: stringField("description"),
  status: Joi.boolean().default(true),
});
