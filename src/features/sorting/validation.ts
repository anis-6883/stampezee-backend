import Joi from "joi";

const title = Joi.string().trim().required().lowercase().valid("category", "default_stamp_image").messages({
  "any.required": "title is required!",
  "string.base": "title must be string!",
  "any.only": "title must be [category, default_stamp_image]",
});

const sortedData = Joi.array().required().messages({
  "array.base": "sortedData must be array!",
  "any.required": "sortedData is required!",
});

export const sortingSchema = Joi.object({
  title,
  sortedData,
});
