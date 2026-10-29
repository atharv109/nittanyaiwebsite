// node build.mjs --audit : proves the geometry of Fig 1 (anatomy kit audit). The site build imports figure.mjs directly.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as A from "./kit/audit.mjs";
import { buildCustody } from "./figure.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const data = (name) => JSON.parse(readFileSync(join(HERE, "..", "..", "..", "data", name), "utf8"));
const t0 = Date.now();
const { plate, R, P } = buildCustody({ pipe: data("pipeline.json"), runs: data("runs.json") });
console.log(`built ${R.items.length} items, ${R.solids.length} solids, ${(plate.length / 1024).toFixed(0)} KB in ${Date.now() - t0} ms`);
A.auditOrExit(R, P, {});
