import Joi from "joi";

export const registerSchema = Joi.object({
  firstName: Joi.string().trim().required().messages({
    "any.required": "firstName is required!",
    "string.base": "firstName must be string!",
  }),
  lastName: Joi.string().trim().required().messages({
    "any.required": "lastName is required!",
    "string.base": "lastName must be string!",
  }),
  email: Joi.string().email().trim().required().messages({
    "any.required": "email is required!",
    "string.base": "email must be string!",
    "string.email": "email must be valid format!",
  }),
  password: Joi.string()
    .required()
    .pattern(
      new RegExp("^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[!@#$%^&*()_+{}|:\"<>?`~\\-=[\\]\\\\';,/])(?!.*\\s).{8,}$")
    )
    .messages({
      "any.required": "password is required!",
      "string.base": "password must be string!",
      "string.pattern.base": "At least 8 characters long with 1 uppercase, 1 lowercase, 1 digit & 1 symbol!",
    }),
});
