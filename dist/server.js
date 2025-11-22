"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// dist/server.js (Cloud Run ready)
const http_1 = require("http");
const fs_1 = require("fs");
const path_1 = require("path");
const router_js_1 = require("./router.js");
const PORT = process.env.PORT || 5000;
const server = (0, http_1.createServer)(async (req, res) => {
    try {
        if (req.url?.startsWith("/api")) {
            await (0, router_js_1.router)(req, res);
            return;
        }
        let filePath = (0, path_1.join)(process.cwd(), "dist", req.url === "/" ? "index.html" : req.url);
        if (!(0, fs_1.existsSync)(filePath)) {
            filePath = (0, path_1.join)(process.cwd(), "dist", "index.html");
        }
        const content = (0, fs_1.readFileSync)(filePath);
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(content);
    }
    catch (err) {
        console.error(err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Internal server error" }));
    }
});
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
