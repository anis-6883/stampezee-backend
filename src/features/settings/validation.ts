import Joi from "joi";
import { numberField, requiredStringField, stringField } from "../../helpers/index";

export const settingsSchema = Joi.object({
  general: Joi.object({
    companyName: stringField("companyName"),
    siteTitle: stringField("siteTitle"),
    contactEmail: stringField("contactEmail"),
    emailUsername: stringField("emailUsername"),
    emailPassword: stringField("emailPassword"),
    androidDownloadLink: stringField("androidDownloadLink"),
    iosDownloadLink: stringField("iosDownloadLink"),
    timezone: Joi.object({
      label: stringField("label"),
      value: numberField("value"),
    }),
  }).messages({
    "object.base": "general must be object!",
  }),
  notification: Joi.object({
    notificationType: stringField("notificationType"),
    firebaseServerKey: stringField("firebaseServerKey"),
    firebaseTopics: stringField("firebaseTopics"),
    oneSignalAppId: stringField("oneSignalAppId"),
    oneSignalApiKey: stringField("oneSignalApiKey"),
  }).messages({
    "object.base": "notification must be object!",
  }),
  page: Joi.object({
    terms: stringField("terms"),
    policy: stringField("policy"),
  }).messages({
    "object.base": "page must be object!",
  }),
  s3Bucket: Joi.object({
    awsRegion: stringField("awsRegion"),
    awsAccessKeyId: stringField("awsAccessKeyId"),
    awsSecretAccessKey: stringField("awsSecretAccessKey"),
    awsBucketName: stringField("awsBucketName"),
  }).messages({
    "object.base": "s3Bucket must be object!",
  }),
  stripe: Joi.object({
    stripeSecretKey: stringField("googleMapsApiKey"),
    planChangeCost: numberField("planChangeCost"),
    refundableThreshold: numberField("refundableThreshold"),
    taxTitle: stringField("taxTitle"),
    taxCost: numberField("taxCost"),
    taxStatus: stringField("taxStatus"),
    allowCurrencies: Joi.array()
      .items(
        Joi.object({
          country: requiredStringField("country"),
          currency: requiredStringField("currency"),
        })
          .required()
          .messages({
            "object.base": "allowCurrencies item must be object!",
          })
      )
      .messages({
        "array.base": "allowCurrencies must be array!",
        "array.includesRequiredUnknowns": "At least one currency is required!",
      }),
  }).messages({
    "object.base": "s3Bucket must be object!",
  }),
  googleMap: Joi.object({
    googleMapsApiKey: stringField("googleMapsApiKey"),
  }).messages({
    "object.base": "googleMap must be object!",
  }),
});
