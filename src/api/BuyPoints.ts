import { IncomingMessage, ServerResponse } from "http";
import dotenv from "dotenv";
import {makeCollectoClient} from "./collectoAuth";
import { pool } from "../db/connection";

dotenv.config();


// async function call(method: string, body: any) {
// //  if (!USERNAME || !X_API_KEY) throw new Error("Collecto credentials missing (COLLECTO_USERNAME/COLLECTO_API_KEY)");
//   const url = `${BASE}/${USERNAME}/${method}`;
//   const resp = await axios.post(url, body, {
//     headers: {
//       "Content-Type": "application/json",
//       "x-api-key": X_API_KEY
//     },
//     timeout: 20000
//   });
//   return resp.data;
// }

export async function buyPointsRequest(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  //return ("requestToPay", payload);
  //const start = Date.now;
  try{

     await pool.query("INSERT INTO collecto_vault_transactions (customer_id,type,points,amount,status,external_tx_id,meta,created_at) VALUES (?,?,?,?,?,?,JSON_OBJECT('collecto',? ),NOW())",
        [req.id, "buy_points", body.points || 0, body.amount, "pending", transactionId || collectoResp?.transaction_id || null, JSON.stringify(collectoResp)]);
     
    const body = req.body || {};
    console.log("[CollectoAuth] body:", body);
    const client = makeCollectoClient();
    const r = await client.post("/buy-points", body);

    await pool.query("UPDATE collecto_vault_transactions SET status='success' WHERE external_tx_id = ?", [body.transactionId]);
        
    res.writeHead(r.status, { "content-type": "application/json" });
    res.end(JSON.stringify(r.data));
  }catch(err: any){
    const status = err?.response?.status ?? 500;
    const payload = err?.response?.data ?? { message: err.message };
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
    console.error("[CollectoAuth] error:", err?.message);
  }
}

export async function collectoRequestToPayStatus(payload: { transactionId: string }) {
 // return call("requestToPayStatus", payload);
}


export async function getCustomerServices(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  try {
    const body = req.body || {};
    console.log("[CollectoAuth] body:", body);
    const client = makeCollectoClient();
    const response = await client.post("/getServices", body);
    //const data = await forwardToCollecto("/getServices", body, headers);
    res.writeHead(response.status, { "content-type": "application/json" });
    res.end(JSON.stringify(response.data)); 
    // res.writeHead(200, { "content-type": "application/json" });
    // res.end(JSON.stringify(data));
  } catch (err: any) {
    const status = err?.response?.status ?? 500;
    const payload = err?.response?.data ?? { message: err.message };
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
    console.error("[CollectoAuth] error:", err?.message);}
}

export async function getCustomerInvoices(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  try {
    const body = req.body || {};
    console.log("[CollectoAuth] body:", body);
    const client = makeCollectoClient();
    const response = await client.post("/getInvoices", body);
   // const data = await forwardToCollecto("/getInvoices", body, headers); 
    res.writeHead(response.status, { "content-type": "application/json" });
    res.end(JSON.stringify(response.data)); 
    // res.writeHead(200, { "content-type": "application/json" });
    // res.end(JSON.stringify(data));
  } catch (err: any) {
    const status = err?.response?.status ?? 500;
    const payload = err?.response?.data ?? { message: err.message };
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
    console.error("[CollectoAuth] error:", err?.message);
  }
}
