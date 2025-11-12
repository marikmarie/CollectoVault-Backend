"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promise_1 = __importDefault(require("mysql2/promise"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.default = promise_1.default.createPool({
    host: process.env.COLLECTO_DB_HOST ?? '127.0.0.1',
    port: Number(process.env.COLLECTO_DB_PORT ?? 3306),
    user: process.env.COLLECTO_DB_USER ?? 'root',
    password: process.env.COLLECTO_DB_PASS ?? '',
    database: process.env.COLLECTO_DB_NAME ?? 'collecto_db',
    waitForConnections: true,
    connectionLimit: 10
});
