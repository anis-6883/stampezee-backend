import Joi from "joi";
import { emailField, requiredEmailField, requiredStringField, stringField, weakPasswordField } from "../../helpers";

export const subAdminSchema = Joi.object({
  email: requiredEmailField,
  password: weakPasswordField,
  branchId: requiredStringField("branchId"),
  firstName: requiredStringField("firstName"),
  lastName: stringField("lastName"),
  status: Joi.boolean().default(true),
});

// Without Password
export const subAdminSchema2 = Joi.object({
  email: emailField,
  branchId: stringField("branchId"),
  firstName: stringField("firstName"),
  lastName: stringField("lastName"),
  status: Joi.boolean().default(true),
});
