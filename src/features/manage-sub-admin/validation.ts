import Joi from "joi";

const firstName = Joi.string().trim().required().messages({
  "any.required": "firstName is required!",
  "string.base": "firstName must be string!",
});

const lastName = Joi.string().trim().messages({
  "string.base": "lastName must be string!",
});

const phone = Joi.string().trim().required().messages({
  "any.required": "phone is required!",
  "string.base": "phone must be string!",
});

const email = Joi.string().email().trim().required().messages({
  "any.required": "email is required!",
  "string.base": "email must be string!",
  "string.email": "email must be valid format!",
});

const strongPassword = Joi.string()
  .required()
  .pattern(new RegExp("^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?!.*\\s).{6,}$"))
  .messages({
    "any.required": "password is required!",
    "string.base": "password must be string!",
    "string.pattern.base": "At least 6 characters long with 1 uppercase, 1 lowercase & 1 digit",
  });

const country = Joi.string().trim().required().messages({
  "any.required": "country is required!",
  "string.base": "country must be string!",
});

const dialCode = Joi.string().trim().required().messages({
  "any.required": "dialCode is required!",
  "string.base": "dialCode must be string!",
});

const branchId = Joi.string().trim().required().messages({
  "any.required": "branchId is required!",
  "string.base": "branchId must be string!",
});

const status = Joi.boolean().default(true);

export const subAdminSchema = Joi.object({
  branchId,
  firstName,
  lastName,
  email,
  phone,
  country,
  dialCode,
  password: strongPassword,
  status,
});
