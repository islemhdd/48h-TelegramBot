import { db, connect, ensureConnected } from "@config/database.ts";
import { Eleve } from "./eleve.ts";
export class User {
  username: string;
  token: string;
  matricule: string;
  constructor(username: string, token: string, matricule: string) {
    this.username = username;
    this.token = token;
    this.matricule = matricule;
  }

  static async findUser(username: string) {
    ensureConnected();

    const results = await db.query("SELECT * FROM users WHERE username=?", [
      username,
    ]);

    if (results.length > 0) {
      return results[0]; // retourne tout l'objet user
    }

    return null;
  }
  // Create a new user
  static async createUser(username: string, token: string, matricule: string) {
    await ensureConnected();
    await db.query(
      "INSERT INTO users (username, token, matricule) VALUES (?, ?, ?)",
      [username, token, matricule]
    );
    return new User(username, token, matricule);
  }

  // Get user by username
  static async getUserByUsername(username: string): Promise<User | null> {
    await ensureConnected();
    const results = await db.query("SELECT * FROM users WHERE username=?", [
      username,
    ]);
    if (results.length > 0) {
      const r = results[0];
      return new User(r.username, r.token, r.matricule);
    }
    return null;
  }

  // Get all users
  static async getAllUsers(): Promise<User[]> {
    await ensureConnected();
    const results = await db.query("SELECT * FROM users", []);
    return results.map((r: any) => new User(r.username, r.token, r.matricule));
  }

  // Update a user's data
  static async updateUser(
    username: string,
    data: { token?: string; matricule?: string }
  ): Promise<boolean> {
    await ensureConnected();
    const updates = [];
    const params = [];
    if (data.token !== undefined) {
      updates.push("token=?");
      params.push(data.token);
    }
    if (data.matricule !== undefined) {
      updates.push("matricule=?");
      params.push(data.matricule);
    }
    if (updates.length === 0) return false;
    params.push(username);
    const sql = `UPDATE users SET ${updates.join(", ")} WHERE username=?`;
    const res = await db.query(sql, params);
    // res.affectedRows for mysql client; adapt as needed
    return (res?.affectedRows ?? 0) > 0;
  }

  // Delete a user by username
  static async deleteUser(username: string): Promise<boolean> {
    await ensureConnected();
    const res = await db.query("DELETE FROM users WHERE username=?", [
      username,
    ]);
    return (res?.affectedRows ?? 0) > 0;
  }
}
