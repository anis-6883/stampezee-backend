import Joi from "joi";
import { numberField, requiredStringField } from "../../helpers";

export const notificationSchema = Joi.object({
  title: requiredStringField("title"),
  description: requiredStringField("description"),
  address: requiredStringField("address"),
  radius: numberField("radius"),
  longitude: requiredStringField("longitude"),
  latitude: requiredStringField("latitude"),
});
