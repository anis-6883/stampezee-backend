import Joi from "joi";
import { requiredStringField } from "../../helpers";

export const stampImageSchema = Joi.object({
  title: requiredStringField("title"),
  status: Joi.boolean().default(true),
});
