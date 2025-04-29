import Joi from "joi";
import {
  numberField,
  requiredBooleanField,
  requiredNumberField,
  requiredStringField,
  stringField,
} from "../../helpers";

export const currencyExchangeSchema = Joi.object({
  name: requiredStringField("name"),
  currency: requiredStringField("currency"),
  currencyIcon: requiredStringField("currencyIcon"),
  exchangeRate: requiredNumberField("exchangeRate"),
});

export const updateCurrencyExchangeSchema = Joi.object({
  name: stringField("name"),
  currency: stringField("currency"),
  currencyIcon: stringField("currencyIcon"),
  exchangeRate: numberField("exchangeRate"),
});

export const currencyExchangeStatusSchema = Joi.object({
  status: requiredBooleanField("status"),
});
