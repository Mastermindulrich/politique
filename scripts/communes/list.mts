// Writes scripts/communes/communes.tsv (id, name, department, region) from lib/ci-geo.ts,
// the list the GitHub Actions workflow reads to fetch each commune's public sources.
import { writeFileSync } from "node:fs";
import { communes, departmentById, regionById } from "../../lib/ci-geo.ts";
const rows = communes
  .filter((c) => departmentById.get(c.departmentId)?.regionId !== 34)
  .map((c) => {
    const d = departmentById.get(c.departmentId)!;
    return [c.id, c.name, d.name, regionById.get(d.regionId)!.name].join("\t");
  });
writeFileSync(new URL("./communes.tsv", import.meta.url), rows.join("\n") + "\n");
console.log(rows.length, "communes");
