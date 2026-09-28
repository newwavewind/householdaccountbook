import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

export function revenueProxy() {
  const file = fileURLToPath(
    new URL("../.revenue-local-token", import.meta.url),
  );
  if (!existsSync(file))
    writeFileSync(file, randomBytes(32).toString("hex"), {
      mode: 0o600,
      flag: "wx",
    });
  return {
    target: "http://127.0.0.1:4001",
    changeOrigin: true,
    headers: { "X-Revenue-Local-Token": readFileSync(file, "utf8").trim() },
    timeout: 30000,
  };
}
