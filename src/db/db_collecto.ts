import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

export default mysql.createPool({
  host: process.env.COLLECTO_DB_HOST ?? '127.0.0.1',
  port: Number(process.env.COLLECTO_DB_PORT ?? 3306),
  user: process.env.COLLECTO_DB_USER ?? 'root',
  password: process.env.COLLECTO_DB_PASS ?? '',
  database: process.env.COLLECTO_DB_NAME ?? 'collecto_db',
  waitForConnections: true,
  connectionLimit: 10
});
