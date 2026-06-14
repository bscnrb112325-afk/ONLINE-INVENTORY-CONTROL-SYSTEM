import dotenv from "dotenv";
dotenv.config();

export class DarajaService {
  private static consumerKey = process.env.MPESA_CONSUMER_KEY;
  private static consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  private static passkey = process.env.MPESA_PASSKEY;
  private static shortcode = process.env.MPESA_SHORTCODE;
  private static baseUrl = process.env.MPESA_ENVIRONMENT === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

  // Generate OAuth Token
  public static async getOAuthToken(): Promise<string> {
    const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString("base64");
    try {
      const response = await fetch(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
        },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.errorMessage || "Failed to generate Daraja token");
      return data.access_token;
    } catch (error) {
      console.error("[DarajaService] getOAuthToken Error:", error);
      throw error;
    }
  }

  // Trigger STK Push
  public static async stkPush(phone: string, amount: number, accountReference: string, callbackUrl: string) {
    try {
      const token = await this.getOAuthToken();
      
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, -3); // YYYYMMDDHHmmss
      const password = Buffer.from(`${this.shortcode}${this.passkey}${timestamp}`).toString("base64");

      // Safaricom requires phone numbers starting with 254
      let formattedPhone = phone.replace(/\D/g, "");
      if (formattedPhone.startsWith("0")) formattedPhone = "254" + formattedPhone.slice(1);
      if (formattedPhone.startsWith("7") || formattedPhone.startsWith("1")) formattedPhone = "254" + formattedPhone;

      const payload = {
        BusinessShortCode: this.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount.toString(),
        PartyA: formattedPhone,
        PartyB: this.shortcode,
        PhoneNumber: formattedPhone,
        CallBackURL: callbackUrl,
        AccountReference: accountReference,
        TransactionDesc: "POS Payment",
      };

      console.log(`[DarajaService] Initiating STK Push for KSH ${amount} to ${formattedPhone}`);
      
      const response = await fetch(`${this.baseUrl}/mpesa/stkpush/v1/processrequest`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        console.error("[DarajaService] STK Push Failed:", data);
        throw new Error(data.errorMessage || data.errorCode || "Failed to initiate STK push");
      }
      
      return data; // Returns CheckoutRequestID and ResponseCode
    } catch (error) {
      console.error("[DarajaService] stkPush Error:", error);
      throw error;
    }
  }
}
