"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthUser = getAuthUser;
exports.requireAuth = requireAuth;
const jwt_1 = require("../lib/jwt");
function getAuthUser(req) {
    const auth = (req.headers["authorization"] || "");
    if (!auth.startsWith("Bearer "))
        return null;
    const token = auth.slice(7);
    const payload = (0, jwt_1.verifyToken)(token);
    return payload;
}
function requireAuth(req, res) {
    const user = getAuthUser(req);
    if (!user) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Unauthorized" }));
        return null;
    }
    return user;
}
