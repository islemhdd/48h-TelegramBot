import "@std/dotenv/load";

//code:hellozaki
export async function verifycode(code:string){const encoder = new TextEncoder();
const data = encoder.encode(code); 

// Hash with SHA-256
const hashBuffer = await crypto.subtle.digest("SHA-256", data);

// Convert ArrayBuffer to hex string
const hashArray = Array.from(new Uint8Array(hashBuffer));
const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
return hashHex===Deno.env.get("SECRET_TOKEN")
}




