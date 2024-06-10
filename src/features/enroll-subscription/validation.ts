import Joi from "joi";

export const enrollSubscriptionSchema = Joi.object({
  slugs: Joi.array().required().messages({
    "array.base": "slugs must be array!",
    "any.required": "slugs is required!",
  }),
});
