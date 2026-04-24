import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { env } from "../config/env";
import { pool } from "../db/pool";

type ScriptMode = "migrate" | "seed" | "setup";

const mode = (process.argv[2] ?? "setup") as ScriptMode;
const migrationsDir = path.resolve(__dirname, "../../sql/migrations");

const isSeedFile = (fileName: string) => fileName.toLowerCase().includes("seed");

const getFilesForMode = async (selectedMode: ScriptMode) => {
  const files = (await readdir(migrationsDir))
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right));

  if (selectedMode === "migrate") {
    return files.filter((fileName) => !isSeedFile(fileName));
  }

  if (selectedMode === "seed") {
    return files.filter(isSeedFile);
  }

  return files;
};

const run = async () => {
  if (!["migrate", "seed", "setup"].includes(mode)) {
    throw new Error("Use um modo valido: migrate, seed ou setup.");
  }

  if (env.DATA_PROVIDER === "memory") {
    console.log(`Modo "${mode}" ignorado porque DATA_PROVIDER=memory.`);
    return;
  }

  const files = await getFilesForMode(mode);

  if (files.length === 0) {
    console.log(`Nenhum arquivo SQL encontrado para o modo "${mode}".`);
    return;
  }

  for (const fileName of files) {
    const filePath = path.join(migrationsDir, fileName);
    const sql = await readFile(filePath, "utf8");

    console.log(`Executando ${fileName}...`);
    await pool.query(sql);
  }

  console.log(`Modo "${mode}" concluido com ${files.length} arquivo(s).`);
};

void run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
