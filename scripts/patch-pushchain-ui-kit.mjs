import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(
  __dirname,
  "..",
  "node_modules",
  "@pushchain",
  "ui-kit",
  "src",
  "lib",
  "helpers",
  "txnAuthGuard.js",
);

if (!fs.existsSync(target)) {
  process.exit(0);
}

const before = "walletData.wallet.providerName";
const after = "walletData?.wallet?.providerName";

let content = fs.readFileSync(target, "utf8");
if (!content.includes(before)) {
  process.exit(0);
}

fs.writeFileSync(target, content.split(before).join(after));
