import Joi from "joi";

const requiredStringField = (fieldName: string) =>
  Joi.string()
    .trim()
    .required()
    .messages({
      "any.required": `${fieldName} is required!`,
      "string.base": `${fieldName} must be string!`,
      "string.empty": `${fieldName} must not be empty!`,
    });

const stringField = (fieldName: string) =>
  Joi.string()
    .trim()
    .messages({
      "string.base": `${fieldName} must be string!`,
      "string.empty": `${fieldName} must not be empty!`,
    });

const emailField = Joi.string().email().trim().messages({
  "string.base": "email must be string!",
  "string.email": "email must be valid format!",
  "string.empty": "email must not be empty!",
});

const requiredEmailField = emailField.required().messages({
  "any.required": "email is required!",
});

const passwordField = Joi.string().required().length(6).messages({
  "any.required": "password is required!",
  "string.base": "password must be string!",
  "string.length": "At least 6 characters long!",
});

// Main schemas
export const retailerSchema = Joi.object({
  storeName: requiredStringField("storeName"),
  firstName: requiredStringField("firstName"),
  lastName: stringField("lastName"),
  email: requiredEmailField,
  dialCode: requiredStringField("dialCode"),
  phone: requiredStringField("phone"),
  country: requiredStringField("country"),
  password: passwordField,
  province: requiredStringField("province"),
  city: requiredStringField("city"),
  postalCode: requiredStringField("postalCode"),
  address: requiredStringField("address"),
  status: Joi.boolean().default(true),
  about: stringField("about"),
  website: stringField("website"),
});

// Without Password
export const retailerSchema2 = Joi.object({
  storeName: stringField("storeName"),
  firstName: stringField("firstName"),
  lastName: stringField("lastName"),
  email: emailField,
  dialCode: stringField("dialCode"),
  phone: stringField("phone"),
  country: stringField("country"),
  province: stringField("province"),
  city: stringField("city"),
  postalCode: stringField("postalCode"),
  address: stringField("address"),
  status: Joi.boolean().default(true),
  about: stringField("about"),
  website: stringField("website"),
});
