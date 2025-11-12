"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promise_1 = __importDefault(require("mysql2/promise"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.default = promise_1.default.createPool({
    host: process.env.VAULT_DB_HOST,
    port: Number(process.env.VAULT_DB_PORT),
    user: process.env.VAULT_DB_USER,
    password: process.env.VAULT_DB_PASS,
    database: process.env.VAULT_DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});
