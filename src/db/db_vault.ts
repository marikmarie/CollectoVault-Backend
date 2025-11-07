import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

export default mysql.createPool({
  host: process.env.VAULT_DB_HOST,
  port: Number(process.env.VAULT_DB_PORT),
  user: process.env.VAULT_DB_USER,
  password: process.env.VAULT_DB_PASS,
  database: process.env.VAULT_DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});
