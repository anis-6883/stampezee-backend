import Joi from "joi";
import { requiredStringField } from "../../../../helpers";

export const collectStampSchema = Joi.object({
  branchId: requiredStringField("branchId"),
  stampId: requiredStringField("stampId"),
});
