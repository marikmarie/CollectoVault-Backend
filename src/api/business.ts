import { IncomingMessage, ServerResponse } from "http";
import dotenv from "dotenv";
import {makeCollectoClient} from "./collectoAuth";
import { pool } from "../db/connection";

dotenv.config();
