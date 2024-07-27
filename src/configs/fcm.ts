import * as admin from "firebase-admin";
import { getMessaging } from "firebase-admin/messaging";
import * as path from "path";

class NotificationClass {
  constructor() {
    this.initialize();
  }

  async initialize(): Promise<void> {
    console.log("=> Notification service started");
    admin.initializeApp({
      credential: admin.credential.cert(path.join(process.cwd(), "stampezee-demo-09ac07adc7b7.json")),
    });
  }

  async sendNotification({
    title,
    description = "",
    data = {},
    imageUrl = "",
    tokens = [],
    topic = "",
    sound = "default",
  }: {
    title: string;
    description?: string;
    data?: { [key: string]: string };
    imageUrl?: string;
    tokens?: string[];
    topic?: string;
    sound?: string;
  }): Promise<void> {
    const stringData: any = {};
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        stringData[key] = String(data[key]);
      }
    }

    console.log("Preparing to send notification...");
    // Create the message description
    const messageBody: any = {
      apns: {
        payload: {
          aps: {
            sound,
          },
        },
      },
      notification: {
        title,
        body: description,
        image: imageUrl,
      },
      data: stringData,
    };

    // Conditional properties
    if (tokens && tokens.length > 0) {
      // Using `sendMulticast` for multiple tokens
      const multicastMessage = {
        ...messageBody,
        tokens: tokens, // Use the array of tokens
      };

      try {
        const response: any = await getMessaging().sendEachForMulticast(multicastMessage);
        console.log(`=> Notification sent to ${response.successCount} devices`);
        if (response.failureCount > 0) {
          console.error(`=> ${response.failureCount} notifications failed`);
        }
      } catch (err) {
        console.error("=> Error Sending Notification", err);
      }
    } else if (topic) {
      // Send to a topic if tokens are not provided
      try {
        await getMessaging().send({ ...messageBody, topic });
        console.log("=> Notification sent to topic!");
      } catch (err) {
        console.error("=> Error Sending Notification", err);
      }
    } else {
      throw new Error("Either tokens or topic must be provided.");
    }
  }
}

const notification = new NotificationClass();
export default notification;
