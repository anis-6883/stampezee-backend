import Joi from "joi";
import { requiredEmailField } from "../../helpers";

export const newsletterSchema = Joi.object({
  email: requiredEmailField,
});
