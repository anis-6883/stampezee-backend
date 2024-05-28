import Joi from "joi";

const name = Joi.string().trim().required().messages({
  "any.required": "name is required!",
  "string.base": "name must be string!",
  "string.empty": "name must be not empty!",
});

const updateName = Joi.string().trim().messages({
  "string.base": "name must be string!",
  "string.empty": "name must be not empty!",
});

const address = Joi.string().trim().required().messages({
  "any.required": "address is required!",
  "string.base": "address must be string!",
});

const updateAddress = Joi.string().trim().messages({
  "string.base": "address must be string!",
  "string.empty": "name must be not empty!",
});

const longitude = Joi.number().required().messages({
  "any.required": "longitude is required!",
  "number.base": "longitude must be number!",
});

const latitude = Joi.number().required().messages({
  "any.required": "latitude is required!",
  "number.base": "latitude must be number!",
});

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
  name,
  address,
  longitude,
  latitude,
});

export const updateBranchSchema = Joi.object({
  name: updateName,
  address: updateAddress,
  longitude: updateLongitude,
  latitude: updateLatitude,
});
