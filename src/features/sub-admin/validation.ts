import Joi from "joi";
import {
  booleanField,
  emailField,
  requiredBooleanField,
  requiredEmailField,
  requiredStringField,
  requiredWeakPasswordField,
  stringField,
} from "../../helpers";

export const subAdminSchema = Joi.object({
  contactEmail: requiredEmailField,
  email: requiredEmailField,
  password: requiredWeakPasswordField(6),
  branchId: requiredStringField("branchId"),
  firstName: requiredStringField("firstName"),
  lastName: stringField("lastName"),
});

// Without Password
export const subAdminSchema2 = Joi.object({
  contactEmail: emailField,
  branchId: stringField("branchId"),
  firstName: stringField("firstName"),
  lastName: stringField("lastName"),
  deleteImageOnUpdate: booleanField("deleteImageOnUpdate"),
});

export const subAdminStatusSchema = Joi.object({
  status: requiredBooleanField("status"),
});
