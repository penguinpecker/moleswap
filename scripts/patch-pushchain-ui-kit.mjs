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

const before = "walletData.wallet.providerName";
const after = "walletData?.wallet?.providerName";

// Never fail the install — a missing/renamed target just means the upstream bug
// may be fixed or moved. But say so on stdout: this patch silently not applying
// is how the `walletData.wallet` TypeError reaches production, and a silent
// exit(0) gives no signal either way. Still present upstream as of 6.0.20.
if (!fs.existsSync(target)) {
  console.warn(
    `[patch-pushchain-ui-kit] SKIPPED — target not found: ${path.relative(process.cwd(), target)}\n` +
      `  Verify whether @pushchain/ui-kit still needs the walletData?.wallet?.providerName guard.`,
  );
  process.exit(0);
}

const content = fs.readFileSync(target, "utf8");

if (!content.includes(before)) {
  if (!content.includes(after)) {
    console.warn(
      "[patch-pushchain-ui-kit] SKIPPED — neither the unguarded nor the guarded " +
        "providerName access was found. txnAuthGuard.js has changed upstream; re-check the patch.",
    );
  }
  process.exit(0);
}

fs.writeFileSync(target, content.split(before).join(after));
console.log("[patch-pushchain-ui-kit] applied walletData?.wallet?.providerName guard");
