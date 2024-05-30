import Joi from "joi";

const name = Joi.string().trim().lowercase().required().messages({
  "any.required": "name is required!",
  "string.base": "name must be string!",
});

const updateName = Joi.string().trim().lowercase().messages({
  "string.base": "name must be string!",
  "string.empty": "name must not be empty!",
});

const description = Joi.string().messages({
  "string.base": "description must be string!",
  "string.empty": "description must not be empty!",
});

const status = Joi.boolean().default(true);

export const categorySchema = Joi.object({
  name,
  description,
  status,
});

export const updateCategorySchema = Joi.object({
  name: updateName,
  description,
  status,
});
