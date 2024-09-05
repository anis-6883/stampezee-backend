import Joi from "joi";
import { numberField, stringField } from "../../helpers/index";

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
    stripeSecretKey: stringField("stripeSecretKey"),
    stripeWebhookSecretKey: stringField("stripeWebhookSecretKey"),
    planChangeCost: numberField("planChangeCost"),
    refundableThreshold: numberField("refundableThreshold"),
    taxTitle: stringField("taxTitle"),
    taxCost: numberField("taxCost"),
    taxStatus: stringField("taxStatus"),
    defaultCurrency: Joi.object({
      country: stringField("country"),
      currency: stringField("currency"),
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
