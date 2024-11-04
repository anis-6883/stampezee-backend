import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import Settings from "../models/settings";
import { AWS_BUCKET_EXPIRE_TIME } from "./constants";

async function getS3BucketInstance() {
  // Get s3Bucket metadata
  const s3BucketMetadata = await Settings.findOne(
    {},
    {
      "s3Bucket.awsRegion": 1,
      "s3Bucket.awsAccessKeyId": 1,
      "s3Bucket.awsSecretAccessKey": 1,
      "s3Bucket.awsBucketName": 1,
    }
  );

  if (!s3BucketMetadata) {
    throw "Something went wrong in s3Bucket settings!";
  }

  const { awsRegion, awsAccessKeyId, awsSecretAccessKey, awsBucketName } = s3BucketMetadata.s3Bucket;

  const s3: any = new S3Client({
    region: awsRegion,
    credentials: {
      accessKeyId: awsAccessKeyId,
      secretAccessKey: awsSecretAccessKey,
    },
  });

  return [s3, awsBucketName];
}

const randomString = () => {
  return crypto.randomBytes(16).toString("hex");
};

// Upload file to S3 Bucket
export const uploadFileToS3Bucket = async (bufferFile: Buffer, mimeType: string, folderName: string) => {
  try {
    const [s3, awsBucketName] = await getS3BucketInstance();
    const Key = `${folderName}/${randomString()}.png`;

    const params = {
      Bucket: awsBucketName,
      Key,
      Body: bufferFile,
      ContentType: mimeType,
    };

    const command = new PutObjectCommand(params);
    await s3.send(command);

    return {
      status: true,
      message: "File uploaded successfully!",
      key: Key,
    };
  } catch (error) {
    console.log(error);
    return {
      status: false,
      message: "Something went wrong!",
    };
  }
};

// Get Secure Url From S3 Bucket
export const getSecureUrlFromS3Bucket = async (key: string) => {
  try {
    const [s3, awsBucketName] = await getS3BucketInstance();

    const params: any = {
      Bucket: awsBucketName,
      Key: key,
    };

    const secureUrl = await getSignedUrl(s3, new GetObjectCommand(params), { expiresIn: AWS_BUCKET_EXPIRE_TIME }); // 60 seconds

    return secureUrl;
  } catch (error) {
    console.log(error);
    return null;
  }
};

// Delete File From S3 Bucket
export const deleteFileFromS3Bucket = async (key: string) => {
  try {
    if (!key) {
      return {
        status: true,
        message: "No image detected!",
      };
    }

    if (key.includes("default")) {
      return {
        status: true,
        message: "Default image detected!",
      };
    } else {
      const [s3, awsBucketName] = await getS3BucketInstance();

      const params: any = {
        Bucket: awsBucketName,
        Key: key,
      };

      const command: any = new DeleteObjectCommand(params);
      await s3.send(command);

      return {
        status: true,
        message: "File deleted successfully!",
      };
    }
  } catch (error) {
    console.log(error);
    return {
      status: false,
      message: "Something went wrong!",
    };
  }
};
