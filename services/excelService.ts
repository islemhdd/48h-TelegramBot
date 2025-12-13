import * as XLSX from "xlsx";
import {db,ensureConnected} from "@config/database.ts"
import { reset } from "https://deno.land/std@0.77.0/fmt/colors.ts";
import cron from "cron";

// cron.schedule("0 10 * * 0", () => {
//   // 0 10 * * 0 → every Sunday at 10:00 AM
//   console.log("Running task every Sunday at 10 AM!");
// });



export let closed=false

export  async function createFile()
{
ensureConnected()
const data = await db.query(`
    SELECT e.nom, e.prenom, d.destination
    FROM eleve e
    JOIN distination d
      ON e.matricule = d.matricule
    WHERE YEAR(d.created_in) = YEAR(CURDATE())
      AND WEEK(d.created_in) = WEEK(CURDATE())
  `);
// const dataJ=await JSON.parse(data)
const worksheet = XLSX.utils.json_to_sheet(data);


const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");


XLSX.writeFile(workbook, "D:/deno/telegrambot/assets/data.xlsx");
closed=true

}


createFile()