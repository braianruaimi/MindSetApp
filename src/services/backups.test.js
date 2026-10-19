import { describe, expect, it } from "vitest";
import { parseBackupText } from "./backups";

describe("JSON backup validation", () => {
  it("accepts a database and an exported snapshot", () => {
    const database = { version: 1, clients: [], loans: [] };
    expect(parseBackupText(JSON.stringify(database))).toMatchObject(database);
    expect(parseBackupText(JSON.stringify({ state: database, createdAt: "2025-01-01" }))).toMatchObject(database);
  });

  it("rejects invalid JSON and malformed database data", () => {
    expect(() => parseBackupText("{")).toThrow("JSON válido");
    expect(() => parseBackupText(JSON.stringify({ clients: "not-an-array", loans: [] }))).toThrow("listas válidas");
  });
});
