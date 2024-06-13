import Joi from "joi";
import { emailField, requiredEmailField, requiredStringField, stringField, weakPasswordField } from "../../helpers";

export const subAdminSchema = Joi.object({
  email: requiredEmailField,
  password: weakPasswordField(6),
  branchId: requiredStringField("branchId"),
  firstName: requiredStringField("firstName"),
  lastName: stringField("lastName"),
});

// Without Password
export const subAdminSchema2 = Joi.object({
  email: emailField,
  branchId: stringField("branchId"),
  firstName: stringField("firstName"),
  lastName: stringField("lastName"),
});

export const subAdminStatusSchema = Joi.object({
  status: Joi.boolean().required().messages({
    "any.required": "status is required!",
    "boolean.base": "status must be boolean!",
    "boolean.empty": "status must not be empty!",
  }),
});
