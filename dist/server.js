"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const fs_1 = require("fs");
const path_1 = require("path");
const server = (0, http_1.createServer)((req, res) => {
    let filePath = (0, path_1.join)(process.cwd(), "dist", req.url === "/" ? "index.html" : req.url);
    if (!(0, fs_1.existsSync)(filePath)) {
        filePath = (0, path_1.join)(process.cwd(), "dist", "index.html"); // SPA fallback
    }
    try {
        const content = (0, fs_1.readFileSync)(filePath);
        res.writeHead(200);
        res.end(content);
    }
    catch {
        res.writeHead(404);
        res.end("Not found");
    }
});
server.listen(5000, () => console.log("Server running on port 5000"));
