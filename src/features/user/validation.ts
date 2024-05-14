import Joi from "joi";

const firstName = Joi.string().trim().required().messages({
  "any.required": "firstName is required!",
  "string.base": "firstName must be string!",
});

const lastName = Joi.string().trim().required().messages({
  "any.required": "firstName is required!",
  "string.base": "firstName must be string!",
});

const email = Joi.string().email().trim().required().messages({
  "any.required": "email is required!",
  "string.base": "email must be string!",
  "string.email": "email must be valid format!",
});

const storeName = Joi.string().trim().required().messages({
  "any.required": "storeName is required!",
  "string.base": "storeName must be string!",
});

const strongPassword = Joi.string()
  .required()
  .pattern(new RegExp("^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?!.*\\s).{6,}$"))
  .messages({
    "any.required": "password is required!",
    "string.base": "password must be string!",
    "string.pattern.base": "At least 6 characters long with 1 uppercase, 1 lowercase & 1 digit",
  });

const weakPassword = Joi.string().required().messages({
  "any.required": "password is required!",
  "string.base": "password must be string!",
});

const country = Joi.string().trim().required().messages({
  "any.required": "country is required!",
  "string.base": "country must be string!",
});

const province = Joi.string().trim().required().messages({
  "any.required": "province is required!",
  "string.base": "province must be string!",
});

const city = Joi.string().trim().required().messages({
  "any.required": "city is required!",
  "string.base": "city must be string!",
});

const postalCode = Joi.string().trim().required().messages({
  "any.required": "postalCode is required!",
  "string.base": "postalCode must be string!",
});

const address = Joi.string().trim().required().messages({
  "any.required": "address is required!",
  "string.base": "address must be string!",
});

export const userRegisterSchema = Joi.object({
  firstName,
  lastName,
  email,
  password: strongPassword,
});

export const retailerRegisterSchema = Joi.object({
  storeName,
  firstName,
  lastName,
  email,
  password: strongPassword,
  country,
  province,
  city,
  postalCode,
  address,
});

export const adminRegisterSchema = Joi.object({
  firstName,
  lastName,
  email,
  password: weakPassword,
});

export const loginSchema = Joi.object({
  email,
  password: weakPassword,
});
