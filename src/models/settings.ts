import { app } from "firebase-admin";
import { Document, model, Schema } from "mongoose";

// Define interfaces for each sub-document
interface IGeneral extends Document {
  companyName: string;
  dialCode?: string;
  phone?: string;
  country?: string;
  province?: string;
  city?: string;
  postalCode?: string;
  address?: string;
  contactEmail: string;
  timezone: {
    label: string;
  };
  androidDownloadLink?: string;
  iosDownloadLink?: string;
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  linkedin?: string;
}

interface IMail extends Document {
  host: string;
  port: string;
  username: string;
  password: string;
}

interface INotification extends Document {
  notificationType: string;
  firebaseServerKey: string;
  firebaseTopics: string;
  oneSignalAppId: string;
  oneSignalApiKey: string;
}

interface IAppVersion extends Document {
  version: string;
  forceUpdate: boolean;
  appUrl: string;
  buttonText: string;
  description: string;
}

interface IPage extends Document {
  terms: string;
  policy: string;
  aboutUs: string;
}

interface IS3Bucket extends Document {
  awsRegion: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsBucketName: string;
}

interface IStripe extends Document {
  stripeSecretKey: string;
  stripePublishKey: string;
  stripeWebhookSecretKey: string;
  planChangeCost: number;
  refundableThreshold: number;
  taxTitle: string;
  taxCost: number;
  taxStatus: "on" | "off";
}

interface IGoogleMap extends Document {
  googleMapsApiKey: string;
}

interface ISettings extends Document {
  general: IGeneral;
  mail: IMail;
  notification: INotification;
  s3Bucket: IS3Bucket;
  appVersion: {
    ios: IAppVersion;
    android: IAppVersion;
  };
  stripe: IStripe;
  googleMap: IGoogleMap;
  page: IPage;
}

// Create the main settings schema
const settingsSchema = new Schema<ISettings>(
  {
    general: {
      companyName: { type: String, default: "", trim: true },
      dialCode: { type: String, trim: true },
      phone: { type: String, trim: true },
      country: { type: String, trim: true },
      province: { type: String, trim: true },
      city: { type: String, trim: true },
      postalCode: { type: String, trim: true },
      address: { type: String, trim: true },
      contactEmail: { type: String, default: "", trim: true },
      timezone: {
        label: { type: String, default: "", trim: true },
      },
      androidDownloadLink: { type: String, default: "", trim: true },
      iosDownloadLink: { type: String, default: "", trim: true },
      facebook: { type: String, default: "", trim: true },
      instagram: { type: String, default: "", trim: true },
      tiktok: { type: String, default: "", trim: true },
      linkedin: { type: String, default: "", trim: true },
    },
    mail: {
      host: { type: String, default: "", trim: true },
      port: { type: String, default: "", trim: true },
      username: { type: String, default: "", trim: true },
      password: { type: String, default: "", trim: true },
    },
    notification: {
      notificationType: { type: String, default: "FCM" },
      firebaseServerKey: { type: String, default: "", trim: true },
      firebaseTopics: { type: String, default: "", trim: true },
      oneSignalAppId: { type: String, default: "", trim: true },
      oneSignalApiKey: { type: String, default: "", trim: true },
    },
    s3Bucket: {
      awsRegion: { type: String, default: "", trim: true },
      awsAccessKeyId: { type: String, default: "", trim: true },
      awsSecretAccessKey: { type: String, default: "", trim: true },
      awsBucketName: { type: String, default: "", trim: true },
    },
    stripe: {
      stripeSecretKey: { type: String, default: "", trim: true },
      stripePublishKey: { type: String, default: "", trim: true },
      stripeWebhookSecretKey: { type: String, default: "", trim: true },
      planChangeCost: { type: Number, default: 1 },
      refundableThreshold: { type: Number, default: 1 },
      taxTitle: { type: String, default: "", trim: true },
      taxCost: { type: Number, default: 1 },
      taxStatus: { type: String, enum: ["on", "off"], default: "on" },
    },
    appVersion: {
      ios: {
        version: { type: Number, default: 1, trim: true },
        forceUpdate: { type: Boolean, default: false },
        appUrl: { type: String, default: "", trim: true },
        buttonText: { type: String, default: "", trim: true },
        description: { type: String, default: "", trim: true },
      },
      android: {
        version: { type: Number, default: 1, trim: true },
        forceUpdate: { type: Boolean, default: false },
        appUrl: { type: String, default: "", trim: true },
        buttonText: { type: String, default: "", trim: true },
        description: { type: String, default: "", trim: true },
      },
    },
    googleMap: {
      googleMapsApiKey: { type: String, default: "", trim: true },
    },
    page: {
      terms: { type: String, default: "", trim: true },
      policy: { type: String, default: "", trim: true },
      aboutUs: { type: String, default: "", trim: true },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Settings = model<ISettings>("settings", settingsSchema);

export default Settings;
