import Joi from "joi";
import { requiredStringField } from "../../../helpers";

export const collectStampSchema = Joi.object({
  branchId: requiredStringField("branchId"),
  customerId: requiredStringField("customerId"),
  stampId: requiredStringField("stampId"),
});
