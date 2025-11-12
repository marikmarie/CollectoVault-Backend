"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readJSON = readJSON;
function readJSON(req, opts) {
    const timeoutMs = opts?.timeoutMs ?? 10_000; // default 10s
    return new Promise((resolve, reject) => {
        // Quick exit: if method commonly has no body
        const method = (req.method || "GET").toUpperCase();
        const clHeader = req.headers["content-length"];
        const chunked = !!req.headers["transfer-encoding"];
        const contentLength = clHeader ? Number(clHeader) : NaN;
        // If it's a GET/HEAD/DELETE usually no body — return empty object immediately
        if (method === "GET" || method === "HEAD") {
            return resolve({});
        }
        // If content-length explicitly 0 and not chunked, resolve immediately
        if (!chunked && !Number.isNaN(contentLength) && contentLength === 0) {
            return resolve({});
        }
        let timer = setTimeout(() => {
            timer = null;
            reject(new Error(`Timeout reading request body after ${timeoutMs}ms`));
        }, timeoutMs);
        let buf = "";
        // Ensure we get strings, not Buffer
        req.setEncoding("utf8");
        function cleanup() {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            req.removeAllListeners("data");
            req.removeAllListeners("end");
            req.removeAllListeners("error");
            req.removeAllListeners("close");
        }
        req.on("data", (chunk) => {
            buf += chunk;
        });
        req.on("end", () => {
            cleanup();
            if (!buf)
                return resolve({});
            try {
                const parsed = JSON.parse(buf);
                resolve(parsed);
            }
            catch (err) {
                reject(new Error("Invalid JSON body: " + err.message));
            }
        });
        req.on("error", (err) => {
            cleanup();
            reject(err);
        });
        // Some clients may close without 'end' — handle close as a best-effort
        req.on("close", () => {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            // if we already have data, try parse; otherwise return {}
            if (buf) {
                try {
                    const parsed = JSON.parse(buf);
                    cleanup();
                    return resolve(parsed);
                }
                catch (err) {
                    cleanup();
                    return reject(new Error("Invalid JSON body on close: " + err.message));
                }
            }
            cleanup();
            return resolve({});
        });
    });
}
