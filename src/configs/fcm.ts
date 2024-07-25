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
    token = "",
    topic = "",
    sound = "default",
  }: {
    title: string;
    description?: string;
    data?: { [key: string]: string };
    imageUrl?: string;
    token?: string;
    topic?: string;
    sound?: string;
  }): Promise<void> {
    const stringData: any = {};
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        stringData[key] = String(data[key]);
      }
    }

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
        image: imageUrl, // use `image` for the image URL
      },
      data: stringData,
    };

    // Conditional properties
    if (token) {
      messageBody.token = token;
    } else if (topic) {
      messageBody.topic = topic;
    } else {
      throw new Error("Either token or topic must be provided.");
    }

    // Send the notification
    try {
      await getMessaging().send(messageBody);
      console.log("=> Notification sent!");
    } catch (err) {
      console.error("=> Error Sending Notification", err);
    }
  }
}

const notification = new NotificationClass();
export default notification;
