import Joi from "joi";

export const userRegisterSchema = Joi.object({
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

export const retailerRegisterSchema = Joi.object({
  storeName: Joi.string().trim().required().messages({
    "any.required": "storeName is required!",
    "string.base": "storeName must be string!",
  }),
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
  country: Joi.string().trim().required().messages({
    "any.required": "country is required!",
    "string.base": "country must be string!",
  }),
  province: Joi.string().trim().required().messages({
    "any.required": "province is required!",
    "string.base": "province must be string!",
  }),
  city: Joi.string().trim().required().messages({
    "any.required": "city is required!",
    "string.base": "city must be string!",
  }),
  postalCode: Joi.string().trim().required().messages({
    "any.required": "postalCode is required!",
    "string.base": "postalCode must be string!",
  }),
  address: Joi.string().trim().required().messages({
    "any.required": "address is required!",
    "string.base": "address must be string!",
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

export const adminRegisterSchema = Joi.object({
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
  password: Joi.string().required().messages({
    "any.required": "password is required!",
    "string.base": "password must be string!",
  }),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().trim().required().messages({
    "any.required": "email is required!",
    "string.base": "email must be string!",
    "string.email": "email must be valid format!",
  }),
  password: Joi.string().required().messages({
    "any.required": "password is required!",
    "string.base": "password must be string!",
  }),
});
