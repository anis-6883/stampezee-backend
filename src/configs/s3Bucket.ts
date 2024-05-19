import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import { AWS_BUCKET_EXPIRE_TIME } from "./constants";

async function getS3BucketInstance() {
  //   const generalSettings = await GeneralSettings.findOne();

  //   if (
  //     generalSettings?.awsRegion === "" ||
  //     generalSettings?.awsAccessKeyId === "" ||
  //     generalSettings?.awsSecretAccessKey === "" ||
  //     generalSettings?.awsBucketName === ""
  //   ) {
  //     throw new Error("Update the AWS S3 Bucket config first!");
  //   }

  const s3: any = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  return [s3, process.env.AWS_BUCKET_NAME];
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

    // const imageUrl = `${process.env.S3_BASE_URL}/${Key}`;

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
