import Joi from "joi";
import { requiredStringField, stringField } from "../../helpers";

const updateLongitude = Joi.when("address", {
  is: Joi.exist(),
  then: Joi.number().required().messages({
    "any.required": "longitude is required!",
    "number.base": "longitude must be number!",
  }),
  otherwise: Joi.number().messages({
    "number.base": "longitude must be number!",
  }),
});

const updateLatitude = Joi.when("address", {
  is: Joi.exist(),
  then: Joi.number().required().messages({
    "any.required": "latitude is required!",
    "number.base": "latitude must be number!",
  }),
  otherwise: Joi.number().messages({
    "number.base": "latitude must be number!",
  }),
});

export const branchSchema = Joi.object({
  name: requiredStringField("name"),
  address: requiredStringField("address"),
  longitude: requiredStringField("longitude"),
  latitude: requiredStringField("latitude"),
});

export const updateBranchSchema = Joi.object({
  name: stringField("name"),
  address: stringField("address"),
  longitude: updateLongitude,
  latitude: updateLatitude,
});
