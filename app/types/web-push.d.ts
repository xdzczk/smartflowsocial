declare module "web-push" {
  export interface PushSubscription {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  }

  export interface SendResult {
    statusCode: number;
  }

  export interface VapidKeys {
    publicKey: string;
    privateKey: string;
  }

  export function setVapidDetails(
    subject: string,
    publicKey: string,
    privateKey: string
  ): void;

  export function sendNotification(
    pushSubscription: PushSubscription,
    payload?: string | Buffer | null,
    options?: {
      TTL?: number;
      contentEncoding?: string;
      urgency?: "very-low" | "low" | "normal" | "high";
      topic?: string;
    }
  ): Promise<SendResult>;

  export function generateVAPIDKeys(): VapidKeys;
}
