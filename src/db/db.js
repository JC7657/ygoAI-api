import pg from "pg";
const { Pool } = pg;

let pool = null;

export const getPool = () => {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
    });
  }
  return pool;
};

export default { getPool };