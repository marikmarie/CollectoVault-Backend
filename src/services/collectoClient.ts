import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const BASE = (process.env.COLLECTO_BASE || "https://collecto.cissytech.com/api").replace(/\/$/, "");
const USERNAME = process.env.COLLECTO_USERNAME;
const X_API_KEY = process.env.COLLECTO_API_KEY;

if (!USERNAME || !X_API_KEY) {
  console.warn("Collecto credentials not set. Put COLLECTO_USERNAME and COLLECTO_API_KEY in .env to call Collecto.");
}

async function call(method: string, body: any) {
  if (!USERNAME || !X_API_KEY) throw new Error("Collecto credentials missing (COLLECTO_USERNAME/COLLECTO_API_KEY)");
  const url = `${BASE}/${USERNAME}/${method}`;
  const resp = await axios.post(url, body, {
    headers: {
      "Content-Type": "application/json",
      "x-api-key": X_API_KEY
    },
    timeout: 20000
  });
  return resp.data;
}

export async function collectoRequestToPay(payload: { paymentOption: string; phone: string; amount: number; reference?: string }) {
  return call("requestToPay", payload);
}

export async function collectoRequestToPayStatus(payload: { transactionId: string }) {
  return call("requestToPayStatus", payload);
}

export async function collectoServicePayment(payload: { service: string; paymentOption: string; phone?: string; amount: number; message?: string }) {
  return call("servicePayment", payload);
}

export async function collectoServicePaymentStatus(payload: { service: string; transactionId: string }) {
  return call("servicePaymentStatus", payload);
}
