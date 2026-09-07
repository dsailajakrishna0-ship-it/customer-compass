import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgres://customer_compass:customer_compass_dev@localhost:5432/customer_compass",
});

