import Joi from "joi";
import { lowercaseStringField, requiredBooleanField, requiredLowercaseStringField, stringField } from "../../helpers";

export const categorySchema = Joi.object({
  name: requiredLowercaseStringField("name"),
  description: stringField("description"),
});

export const updateCategorySchema = Joi.object({
  name: lowercaseStringField("name"),
  description: stringField("description"),
});

export const categoryStatusSchema = Joi.object({
  status: requiredBooleanField("status"),
});
