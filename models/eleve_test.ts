import { assert, assertEquals } from "@std/assert";
import { parse } from "@std/csv";
import { Eleve, type Groupe } from "./eleve.ts";

type CsvRow = {
  nom: string;
  prenom: string;
  wilaya: string | null;
  groupe: Groupe | null;
  matricule: number | undefined;
  current_destination: string | null;
};

const dataset = await loadCsvDataset();

function csvPath(): URL {
  // d:/deno/telegrambot/models -> ../../../ -> d:/ -> eleve.csv
  return new URL("../../../eleve.csv", import.meta.url);
}

async function loadCsvDataset(): Promise<CsvRow[]> {
  const raw = await Deno.readTextFile(csvPath());
  const records = parse(raw, {
    separator: ";",
    skipFirstRow: true,
  }) as Record<string, string>[];
  
  return records.map((record) => ({
    nom: record.nom?.trim() || "",
    prenom: record.prenom?.trim() || "",
    wilaya: record.wilaya?.trim() || null,
    groupe: (record.groupe?.trim() as Groupe | undefined) || null,
    matricule: record.matricule ? Number(record.matricule) : undefined,
    current_destination: record.current_destination?.trim() || null,
  }));
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[a.length][b.length];
}

type RankedRow = CsvRow & { distance: number };

function rankMatches(input: string, limit = 5): RankedRow[] {
  const lowerInput = input.toLowerCase();
  return dataset
    .map((row) => ({
      ...row,
      distance: levenshtein(row.prenom.toLowerCase(), lowerInput),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

function withMockedDb(fn: () => Promise<void>) {
  return async () => {
    const originalDb = Eleve.db;
    const mockDb = {
      _isConnected: true,
      query(sql: string, params: unknown[]) {
        // Handle findByNom queries (exact match by nom)
        if (sql.includes("WHERE nom =")) {
          const [nom] = params as [string];
          const found = dataset.find((s) => s.nom === nom);
          return Promise.resolve(found ? [found] : []);
        }
        // Handle findClosestPrenom queries (fuzzy match)
        const [input] = params;
        return Promise.resolve(rankMatches(String(input)));
      },
    };
    Eleve.db = mockDb as unknown as typeof Eleve.db;
    try {
      await fn();
    } finally {
      Eleve.db = originalDb;
    }
  };
}

function withMockedDbForDestination(fn: () => Promise<void>) {
  return async () => {
    const originalDb = Eleve.db;
    const insertedDestinations: Array<{ matricule: number; destination: string }> = [];
    const mockDb = {
      _isConnected: true,
      query(sql: string, params: unknown[]) {
        // Handle findByNom queries (exact match by nom)
        if (sql.includes("WHERE nom =")) {
          const [nom] = params as [string];
          const found = dataset.find((s) => s.nom === nom);
          return Promise.resolve(found ? [found] : []);
        }
        // Handle SELECT queries (for findClosestPrenom)
        if (sql.includes("SELECT") || sql.includes("LEVENSHTEIN")) {
          const [input] = params;
          return Promise.resolve(rankMatches(String(input)));
        }
        // Handle INSERT queries (for setDestination)
        if (sql.includes("INSERT INTO distination")) {
          const [matricule, destination] = params as [number, string];
          insertedDestinations.push({ matricule, destination });
          return Promise.resolve({ affectedRows: 1, insertId: 1 });
        }
        return Promise.resolve([]);
      },
    };
    Eleve.db = mockDb as unknown as typeof Eleve.db;
    try {
      await fn();
    } finally {
      Eleve.db = originalDb;
    }
  };
}

Deno.test(
  "returns single exact match when distance is zero",
  withMockedDb(async () => {
    const perfect = dataset[0];
    const results = await Eleve.findClosestPrenom(perfect.prenom);
    assertEquals(results.length, 1);
    assertEquals(results[0].prenom, perfect.prenom);
    assertEquals(results[0].nom, perfect.nom);
    assertEquals(results[0].groupe, perfect.groupe);
  }),
);

Deno.test(
  "returns top closest matches for fuzzy input",
  withMockedDb(async () => {
    const input = "Abdela";
    const expected = rankMatches(input);
    const results = await Eleve.findClosestPrenom(input);

    assertEquals(results.length, expected.length);
    const actualPrenoms = results.map((r) => r.prenom);
    const expectedPrenoms = expected.map((r) => r.prenom);
    assertEquals(actualPrenoms, expectedPrenoms);

    const maxExpectedDistance = expected.at(-1)?.distance ?? 0;
    const maxActualDistance = Math.max(
      ...results.map((r) => levenshtein(r.prenom.toLowerCase(), input.toLowerCase())),
    );
    assert(
      maxActualDistance <= maxExpectedDistance,
      "Returned matches should not be further than the ranked results",
    );
  }),
);

Deno.test(
  "never returns more than five matches even when dataset is large",
  withMockedDb(async () => {
    const input = "Mohamed";
    const results = await Eleve.findClosestPrenom(input);
    assert(results.length <= 5);
    assert(results.every((eleve) => typeof eleve.prenom === "string"));
  }),
);

Deno.test(
  "setDestination successfully inserts destination into database",
  withMockedDbForDestination(async () => {
    const student = dataset.find((s) => s.matricule);
    assert(student, "Test requires at least one student with matricule");
    
    const eleve = new Eleve(
      student.nom,
      student.prenom,
      student.wilaya,
      student.groupe,
      student.matricule,
    );
    
    const destination = "Algiers";
    await eleve.setDestination(destination);
    
    assertEquals(eleve.current_destination, destination);
  }),
);

Deno.test(
  "setDestination throws error when student has no matricule",
  withMockedDbForDestination(async () => {
    const eleve = new Eleve("Test", "Student");
    // No matricule set
    
    let errorThrown = false;
    try {
      await eleve.setDestination("Somewhere");
    } catch (error) {
      errorThrown = true;
      assert(error instanceof Error);
      assert(error.message.includes("matricule"));
    }
    assert(errorThrown, "Expected error to be thrown");
  }),
);

Deno.test(
  "setDestination throws error when destination exceeds 20 characters",
  withMockedDbForDestination(async () => {
    const student = dataset.find((s) => s.matricule);
    assert(student, "Test requires at least one student with matricule");
    
    const eleve = new Eleve(
      student.nom,
      student.prenom,
      student.wilaya,
      student.groupe,
      student.matricule,
    );
    
    const longDestination = "A".repeat(21); // 21 characters
    let errorThrown = false;
    try {
      await eleve.setDestination(longDestination);
    } catch (error) {
      errorThrown = true;
      assert(error instanceof Error);
      assert(error.message.includes("20 characters"));
    }
    assert(errorThrown, "Expected error to be thrown for long destination");
  }),
);

Deno.test(
  "setDestination accepts destination of exactly 20 characters",
  withMockedDbForDestination(async () => {
    const student = dataset.find((s) => s.matricule);
    assert(student, "Test requires at least one student with matricule");
    
    const eleve = new Eleve(
      student.nom,
      student.prenom,
      student.wilaya,
      student.groupe,
      student.matricule,
    );
    
    const maxLengthDestination = "A".repeat(20); // Exactly 20 characters
    await eleve.setDestination(maxLengthDestination);
    
    assertEquals(eleve.current_destination, maxLengthDestination);
  }),
);

Deno.test(
  "findByNom returns exact match when nom exists",
  withMockedDb(async () => {
    const testStudent = dataset[0];
    const result = await Eleve.findByNom(testStudent.nom);
    
    assert(result !== null, "Expected to find a student");
    assertEquals(result!.nom, testStudent.nom);
    assertEquals(result!.prenom, testStudent.prenom);
    assertEquals(result!.matricule, testStudent.matricule);
    assertEquals(result!.groupe, testStudent.groupe);
  }),
);

Deno.test(
  "findByNom returns null when nom does not exist",
  withMockedDb(async () => {
    const result = await Eleve.findByNom("NONEXISTENT_NAME_12345");
    assertEquals(result, null);
  }),
);

Deno.test(
  "findByNom is case sensitive for exact match",
  withMockedDb(async () => {
    const testStudent = dataset[0];
    // Try with different case
    const lowerCaseNom = testStudent.nom.toLowerCase();
    const result = await Eleve.findByNom(lowerCaseNom);
    
    // Should return null if case doesn't match (exact match)
    if (testStudent.nom !== lowerCaseNom) {
      assertEquals(result, null);
    }
  }),
);

