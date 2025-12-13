
import {Client} from "https://deno.land/x/mysql/mod.ts"
import { Eleve } from "../models/eleve.ts";
// import { hostname } from "node:os";
export const db =new Client();

export async function connect()
{
    await db.connect(   {
        hostname:"127.0.0.1",
       username:"root",
       db:"bot_students",
       password:""
       ,
       poolSize: 3
   
       });
    console.log("connection a la base "+db.config.db);

}   

export async function ensureConnected() {
    // Assumes db.hasOwnProperty("connected") or similar state, else skip this
    // We'll use a simple connected flag on the db object for idempotency
    if (!(db as any)._isConnected) {
      await connect();
      (db as any)._isConnected = true;
    }
  }




