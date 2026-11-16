import Database from 'better-sqlite3';
import path from 'path';

type DatabaseInstance = Database.Database;

let database: DatabaseInstance | null = null;

export const getDatabase = (): DatabaseInstance => {
  if (database) {
    return database;
  }

  const dbPath =
    process.env.SQLITE_PATH ||
    path.join(process.env.DB_PATH || '/data', 'ft_transcendence.db');

  database = new Database(dbPath);
  return database;
};

