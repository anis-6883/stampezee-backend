import Joi from "joi";

const name = Joi.string().trim().required().messages({
  "any.required": "name is required!",
  "string.base": "name must be string!",
});

const description = Joi.string().trim().messages({
  "string.base": "name must be string!",
});

const status = Joi.boolean().default(true);

export const categorySchema = Joi.object({
  name,
  description,
  status,
});
