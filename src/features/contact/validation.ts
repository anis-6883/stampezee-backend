import Joi from "joi";
import { requiredEmailField, requiredStringField, stringField } from "../../helpers";

export const contactSchema = Joi.object({
  name: requiredStringField("name"),
  dialCode: stringField("dialCode"),
  phone: stringField("phone"),
  email: requiredEmailField,
  message: requiredStringField("message"),
});
