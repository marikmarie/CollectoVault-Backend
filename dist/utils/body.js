"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jsonBody = jsonBody;
async function jsonBody(req, limit = 1e6) {
    return new Promise((resolve, reject) => {
        let body = "";
        req.on("data", (chunk) => {
            body += chunk;
            if (body.length > limit) {
                reject(new Error("Payload too large"));
                req.socket.destroy();
            }
        });
        req.on("end", () => {
            if (!body)
                return resolve(undefined);
            try {
                const parsed = JSON.parse(body);
                resolve(parsed);
            }
            catch (err) {
                reject(new Error("Invalid JSON"));
            }
        });
        req.on("error", (err) => reject(err));
    });
}
