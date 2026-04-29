import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import Database from "better-sqlite3";
import path from "path";

const sqlite = new Database(path.join(process.cwd(), "ella_mdm.db"));

export const auth = betterAuth({
  database: sqlite,
  emailAndPassword: {
    enabled: true,
  },
  plugins: [nextCookies(), admin()],
});
