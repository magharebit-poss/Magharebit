export interface WhatsAppMessage {
  to: string;   // phone with country code, no +, e.g. "212612345678"
  body: string; // plain text (Green API free tier = text only)
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface WhatsAppProvider {
  send(message: WhatsAppMessage): Promise<WhatsAppSendResult>;
  name: string; // "green-api" | "meta-cloud-api"
}
