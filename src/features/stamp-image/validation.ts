import Joi from "joi";
import { requiredStringField, stringField } from "../../helpers";

export const stampImageSchema = Joi.object({
  title: requiredStringField("title"),
});

export const stampImageUpdateSchema = Joi.object({
  title: stringField("title"),
});
