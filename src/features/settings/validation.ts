import Joi from "joi";
import { numberField, stringField } from "../../helpers/index";

export const settingsSchema = Joi.object({
  general: Joi.object({
    companyName: stringField("companyName"),
    dialCode: stringField("dialCode"),
    phone: stringField("phone"),
    country: stringField("country"),
    city: stringField("city"),
    province: stringField("province"),
    postalCode: stringField("postalCode"),
    address: stringField("address"),
    contactEmail: stringField("contactEmail"),
    androidDownloadLink: stringField("androidDownloadLink"),
    iosDownloadLink: stringField("iosDownloadLink"),
    facebook: stringField("iosDownloadLink"),
    instagram: stringField("iosDownloadLink"),
    tiktok: stringField("iosDownloadLink"),
    linkedin: stringField("iosDownloadLink"),
    timezone: Joi.object({
      label: stringField("label"),
    }),
  }).messages({
    "object.base": "general must be object!",
  }),
  mail: Joi.object({
    host: stringField("host"),
    port: stringField("port"),
    username: stringField("username"),
    password: stringField("password"),
  }).messages({
    "object.base": "mail must be object!",
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
    stripePublishKey: stringField("stripeSecretKey"),
    stripeWebhookSecretKey: stringField("stripeWebhookSecretKey"),
    planChangeCost: numberField("planChangeCost"),
    refundableThreshold: numberField("refundableThreshold"),
    taxTitle: stringField("taxTitle"),
    taxCost: numberField("taxCost"),
    taxStatus: stringField("taxStatus"),
  }).messages({
    "object.base": "s3Bucket must be object!",
  }),
  googleMap: Joi.object({
    googleMapsApiKey: stringField("googleMapsApiKey"),
  }).messages({
    "object.base": "googleMap must be object!",
  }),
});
