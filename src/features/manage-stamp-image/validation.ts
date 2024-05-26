import Joi from "joi";

const title = Joi.string().trim().required().messages({
  "any.required": "title is required!",
  "string.base": "title must be string!",
});

const status = Joi.boolean().default(true);

export const stampImageSchema = Joi.object({
  title,
  status,
});
