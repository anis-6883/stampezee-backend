import Joi from "joi";

const firstName = Joi.string().trim().required().messages({
  "any.required": "firstName is required!",
  "string.base": "firstName must be string!",
});

const lastName = Joi.string().trim().messages({
  "string.base": "lastName must be string!",
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
  password: strongPassword,
  status,
});

// Without Password
export const subAdminSchema2 = Joi.object({
  branchId,
  firstName,
  lastName,
  email,
  status,
});
