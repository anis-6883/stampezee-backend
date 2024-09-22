import mongoose from "mongoose";

const general = new mongoose.Schema({
  companyName: { type: String, default: "", trim: true },
  dialCode: { type: String, trim: true, required: true },
  phone: { type: String, trim: true, required: true },
  country: { type: String, trim: true, required: true },
  province: { type: String, trim: true, required: true },
  city: { type: String, trim: true, required: true },
  postalCode: { type: String, trim: true, required: true },
  address: { type: String, trim: true, required: true },
  contactEmail: { type: String, default: "", trim: true },
  timezone: {
    label: { type: String, default: "", trim: true },
    value: { type: String, default: "", trim: true },
  },
  androidDownloadLink: { type: String, default: "", trim: true },
  iosDownloadLink: { type: String, default: "", trim: true },
  facebook: { type: String, default: "", trim: true },
  instagram: { type: String, default: "", trim: true },
  tiktok: { type: String, default: "", trim: true },
  linkedin: { type: String, default: "", trim: true },
  emailHost: { type: String, default: "", trim: true },
  emailPort: { type: String, default: "", trim: true },
  emailUsername: { type: String, default: "", trim: true },
  emailPassword: { type: String, default: "", trim: true },
});

const notification = new mongoose.Schema({
  notificationType: { type: String, default: "FCM" },
  firebaseServerKey: { type: String, default: "", trim: true },
  firebaseTopics: { type: String, default: "", trim: true },
  oneSignalAppId: { type: String, default: "", trim: true },
  oneSignalApiKey: { type: String, default: "", trim: true },
});

const page = new mongoose.Schema({
  terms: { type: String, default: "", trim: true },
  policy: { type: String, default: "", trim: true },
  aboutUs: { type: String, default: "", trim: true },
});

const s3Bucket = new mongoose.Schema({
  awsRegion: { type: String, default: "", trim: true },
  awsAccessKeyId: { type: String, default: "", trim: true },
  awsSecretAccessKey: { type: String, default: "", trim: true },
  awsBucketName: { type: String, default: "", trim: true },
});

const stripe = new mongoose.Schema({
  stripeSecretKey: { type: String, default: "", trim: true },
  stripeWebhookSecretKey: { type: String, default: "", trim: true },
  planChangeCost: { type: Number, default: 1 },
  refundableThreshold: { type: Number, default: 1 },
  taxTitle: { type: String, default: "", trim: true },
  taxCost: { type: Number, default: 1 },
  taxStatus: { type: String, enum: ["on", "off"], default: "on" },
});

const googleMap = new mongoose.Schema({
  googleMapsApiKey: { type: String, default: "", trim: true },
});

const schema = new mongoose.Schema(
  {
    general,
    notification,
    s3Bucket,
    stripe,
    googleMap,
    page,
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Settings = mongoose.model("Settings", schema);

export default Settings;
