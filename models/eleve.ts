export type Groupe = "A" | "B" | "C" | "D" | "E" | "F";
import { db, connect, ensureConnected } from "@config/database.ts";
export class Eleve {
  // ... [keep the other properties and constructor below the insertion point]
  static db = db;

  /**
   * Find the closest matches for the given prenom.
   * If the closest match has distance 0, return only that one.
   * Returns Eleve instances.
   */
  static async findClosestPrenom(input_name: string): Promise<Eleve[]> {
    await ensureConnected();
    const query = `
      SELECT 
        nom,
        prenom,
        wilaya,
        groupe,
        matricule,
        LEVENSHTEIN(prenom, ?) AS distance
      FROM eleve
      ORDER BY distance ASC
      LIMIT 5;`;
    const results = await this.db.query(query, [input_name]);
    if (results.length > 0 && results[0].distance === 0) {
      // return only the first as an array
      const r = results[0];
      return [new Eleve(r.nom, r.prenom, r.wilaya, r.groupe, r.matricule)];
    }

    // otherwise, map all results to Eleve
    return results.map(
      (r: any) => new Eleve(r.nom, r.prenom, r.wilaya, r.groupe, r.matricule)
    );
  }

  /**
   * Find the closest matches for the given nom (last name).
   * If the closest match has distance 0, return only that one.
   * Returns Eleve instances.
   */
  static async findClosestNom(input_name: string): Promise<Eleve[]> {
    await ensureConnected();
    const query = `
      SELECT 
        nom,
        prenom,
        wilaya,
        groupe,
        matricule,
        LEVENSHTEIN(nom, ?) AS distance
      FROM eleve
      ORDER BY distance ASC
      LIMIT 5;
    `;
    const results = await this.db.query(query, [input_name]);
    if (results.length > 0 && results[0].distance === 0) {
      // return only the first as an array
      const r = results[0];
      return [new Eleve(r.nom, r.prenom, r.wilaya, r.groupe, r.matricule)];
    }

    // otherwise, map all results to Eleve
    return results.map(
      (r: any) => new Eleve(r.nom, r.prenom, r.wilaya, r.groupe, r.matricule)
    );
  }

  /**
   * Find an exact match by nom (last name).
   * Returns a single Eleve instance if found, null otherwise.
   * @param nom - The last name to search for
   * @returns Eleve instance if found, null if not found
   */
  static async findByNom(nom: string): Promise<Eleve | null> {
    await ensureConnected();
    const query = `
      SELECT 
        nom,
        prenom,
        wilaya,
        groupe,
        matricule
      FROM eleve
      WHERE nom = ?
      LIMIT 1;
    `;
    const results = await this.db.query(query, [nom]);

    if (results.length === 0) {
      return null;
    }

    const r = results[0];
    return new Eleve(r.nom, r.prenom, r.wilaya, r.groupe, r.matricule);
  }

  /**
   * Check if this student has a 48h request (destination) in the current week.
   * @returns The destination string if found, null otherwise
   */
  async hasCurrent48h(): Promise<string | null> {
    if (!this.matricule) {
      return null;
    }

    await ensureConnected();
    const query = `
      SELECT destination
      FROM distination
      WHERE matricule = ?
        AND YEAR(created_in) = YEAR(CURDATE())
        AND WEEK(created_in, 1) = WEEK(CURDATE(), 1)
      LIMIT 1;
    `;
    const results = await Eleve.db.query(query, [this.matricule]);

    if (results.length === 0) {
      return null;
    }

    return results[0].destination || null;
  }

  /**
   * Set the destination for this student and insert it into the distination table.
   * @param destination - The destination string (max 20 characters)
   * @throws Error if the student doesn't have a matricule
   */

  async setDestination(
    destination: string = "",
    makenull = false
  ): Promise<void> {
    if (!this.matricule) {
      throw new Error("Cannot set destination: student has no matricule");
    }
    if (makenull) {
      await ensureConnected();

      // Delete the destination from distination table for this student's matricule, only if its created_in is within the current week.
      // Assuming "this week" means same YEAR and WEEK() as current.
      const deleteQuery = `
        DELETE FROM distination
        WHERE matricule = ?
          AND YEAR(created_in) = YEAR(CURDATE())
          AND WEEK(created_in, 1) = WEEK(CURDATE(), 1)
      `;
      await Eleve.db.query(deleteQuery, [this.matricule]);
      this.current_destination = null;
    } else {
      if (destination.length > 20) {
        throw new Error("Destination must be 20 characters or less");
      }

      await ensureConnected();

      const query = `
      INSERT INTO distination (matricule, destination, created_in)
      VALUES (?, ?, CURDATE())
    `;

      await Eleve.db.query(query, [this.matricule, destination]);
      this.current_destination = destination;
      await Eleve.db.query(
        "update  eleve set current_destination=? where matricule=?  ",
        [this.current_destination, this.matricule]
      );
    }
  }

  nom: string;
  prenom: string;
  wilaya?: string | null;
  groupe?: Groupe | null;
  matricule?: number;
  current_destination?: string | null;

  constructor(
    nom: string,
    prenom: string,
    wilaya?: string | null,
    groupe?: Groupe | null,
    matricule?: number
  ) {
    this.nom = nom;
    this.prenom = prenom;
    this.wilaya = wilaya ?? null;
    this.groupe = groupe ?? null;
    this.matricule = matricule;
  }
}
