import { Bot } from "@gramio/core";
import { connect } from "@config/database.ts";
import { Eleve } from "./models/eleve.ts";
import { verifycode } from "./security.ts";
import { createFile } from "./services/excelService.ts";
import { MediaUpload, MediaInput } from "@gramio/files";
import { User } from "@gramio/core";

import "@std/dotenv/load";
import { stat } from "node:fs";

console.log(await connect());

const Token = Deno.env.get("BOT_TOKEN");
if (!Token) {
  throw new Error("BOT_TOKEN not found");
}

const bot = new Bot(Token);

type UserState = {
  step:
    | "idle"
    | "waiting_nom"
    | "selecting_student"
    | "waiting_destination"
    | "has_48h_choice"
    | "waiting_code"
    | "code_verified";
  candidates?: Eleve[];
  selectedStudent?: Eleve;
  current48h?: string | null;
};

const userStates: Map<number, UserState> = new Map();

bot.command("start", (ctx) => {
  const id = ctx.from!.id;
  userStates.set(id, { step: "idle" });
  ctx.send("Welcome! Use /48h to make a 48-hour request.");
});

bot.command("48h", (ctx) => {
  const id = ctx.from!.id;
  const dayNumber = new Date().getDay() + 2;
  // if (false) {
  //   ctx.send("you were late , sorry 🤦 ");
  //   const existeduser = userStates.get(id);
  //   if (existeduser && existeduser.current48h) {
  //     ctx.send("but you are already list 😁");
  //   } else {
  //     ctx.send(" and you were not added  in the list 🤷‍♂️ ");
  //   }
  //   return;
  // }
  // 0 = Sunday, 1 = Monday, … 6 = Saturday

  userStates.set(id, { step: "waiting_nom" });

  ctx.send("Please send me your family name (nom).");
});
bot.command("list", (ctx) => {
  const id = ctx.from!.id;
  const user = userStates.get(id)!;
  if (!user) {
    ctx.send("please use the /start command first ");
  } else {
    ctx.send("please write the secret code ");
    user.step = "waiting_code";
  }
});
/**
 *#devided to states in the ifs
 *#for each stat u execut a diffrent function
 *#cant use multiple commands cuz they will be interpreted as messages
 *#best solution i could thing of ..💔
 *
 */
bot.on("message", async (ctx) => {
  const id = ctx.from!.id;
  const text = ctx.text ?? "";
  // # first use
  if (!userStates.has(id)) {
    ctx.send("Please use /start first!");
    return;
  }

  const state = userStates.get(id)!; //get the users experience kichghol

  try {
    if (state.step === "waiting_code") {
      if (await verifycode(text)) {
        createFile();
        ctx.sendMediaGroup([
          MediaInput.document(MediaUpload.path("./assets/data.xlsx")),
        ]);
        userStates.delete(id);
      } else {
        await ctx.reply("Invalid code.");
      }
    }

    if (state.step === "waiting_nom") {
      //traitement de la base
      let student = await Eleve.findByNom(text.trim());

      if (!student) {
        // Try fuzzy match
        const candidates = await Eleve.findClosestNom(text.trim());

        if (candidates.length === 0) {
          ctx.send(
            "❌ No student found. Please check the spelling and try again, or use /start to restart."
          );

          return;
        }

        // Show candidates for user to select
        if (candidates.length === 1) {
          // Only one match, use it directly
          student = candidates[0];
        } else {
          // Multiple candidates, ask user to select
          let message =
            "Found multiple matches. Please select your name by sending the number:\n\n";
          candidates.forEach((c, index) => {
            message += `${index + 1}. ${c.nom} ${c.prenom}\n`;
          });
          ctx.send(message);
          state.step = "selecting_student";
          state.candidates = candidates;
          return;
        }
      }

      // Check if student has current 48h
      const current48h = await student.hasCurrent48h();
      //# ida ran marki deja
      if (current48h) {
        state.step = "has_48h_choice";
        state.selectedStudent = student;
        state.current48h = current48h;
        ctx.send(
          `You already have a 48h request for: ${current48h}\n\n` +
            `What would you like to do?\n` +
            `Send "delete" to remove it, or send a new destination to update it.`
        );
        return;
      }

      // nsna string ta3 destination
      //TODO add wilaya verification (use the distance in the base or with the id)
      state.step = "waiting_destination"; //so he inters to the destination if next time
      state.selectedStudent = student;
      ctx.send(
        `Found: ${student.nom} ${student.prenom}\n\n` +
          `Please send me your destination (max 20 characters).`
      );

      //  the selection gave multiple candidates
    } else if (state.step === "selecting_student") {
      const choice = parseInt(text.trim());

      if (
        isNaN(choice) ||
        choice < 1 ||
        choice > (state.candidates?.length ?? 0)
      ) {
        ctx.send(
          "❌ Invalid selection. Please send a valid number from the list, or use /start to restart."
        );
        return;
      }

      const student = state.candidates![choice - 1];

      // Check if student has current 48h
      const current48h = await student.hasCurrent48h();

      if (current48h) {
        state.step = "has_48h_choice";
        state.selectedStudent = student;
        state.current48h = current48h;
        state.candidates = undefined;
        ctx.send(
          `You already have a 48h request for: ${current48h}\n\n` +
            `What would you like to do?\n` +
            `Send "delete" to remove it, or send a new destination to update it.`
        );
        return;
      }

      // No current 48h, proceed to ask for destination
      state.step = "waiting_destination";
      state.selectedStudent = student;
      state.candidates = undefined;
      ctx.send(
        `Selected: ${student.nom} ${student.prenom}\n\n` +
          `Please send me your destination (max 20 characters).`
      );
    } else if (state.step === "has_48h_choice") {
      // User has existing 48h and needs to choose
      const lowerText = text.trim().toLowerCase();

      if (lowerText === "delete" || lowerText === "remove") {
        // Delete the 48h request
        await state.selectedStudent!.setDestination("", true);
        ctx.send("✅ Your 48h request has been deleted.");
        userStates.set(id, { step: "idle" });
      } else {
        // Update with new destination
        if (text.length > 20) {
          ctx.send(
            "❌ Destination must be 20 characters or less. Please try again."
          );
          return;
        }

        await state.selectedStudent!.setDestination(text.trim());
        ctx.send(`✅ Your destination has been updated to: ${text.trim()}`);
        userStates.set(id, { step: "idle" });
      }
    } else if (state.step === "waiting_destination") {
      // User is providing destination
      if (text.length > 20) {
        ctx.send(
          "❌ Destination must be 20 characters or less. Please try again."
        );
        return;
      }

      await state.selectedStudent!.setDestination(text.trim());
      ctx.send(
        `✅ Your 48h request has been saved!\nDestination: ${text.trim()}`
      );
      userStates.set(id, { step: "idle" });
    }
  } catch (error: unknown) {
    console.error("Error in bot handler:", error);

    await ctx.send(
      "❌ An error occurred. Please try again or use /start to restart."
    );

    if (error instanceof Error) {
      await ctx.send(`Error details: ${error.message}`);
    }

    userStates.set(id, { step: "idle" });
  }
});

bot.start();
