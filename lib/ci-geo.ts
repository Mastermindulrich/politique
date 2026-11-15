// Administrative geography of Côte d'Ivoire: 2 autonomous districts + 12 districts,
// 31 regions, departments and the communes used for the voting location.
// Source of truth for both the sign-up form and supabase/seed/ci_geo.sql
// (regenerate with `node scripts/gen-geo-sql.mjs`).
//
// Departments follow the 2021 administrative map. Communes: the District of
// Abidjan, each department's chef-lieu, then every other commune with an
// elected council. Ids never change: add new entries at the end only.

export type Region = { id: number; district: string; name: string; autonomous?: true };
export type Department = { id: number; regionId: number; name: string };
export type Commune = { id: number; departmentId: number; name: string };

export const regions: Region[] = [
  { id: 1, district: "Abidjan", name: "District autonome d'Abidjan", autonomous: true },
  { id: 2, district: "Yamoussoukro", name: "District autonome de Yamoussoukro", autonomous: true },
  { id: 3, district: "Bas-Sassandra", name: "Gbôklé" },
  { id: 4, district: "Bas-Sassandra", name: "Nawa" },
  { id: 5, district: "Bas-Sassandra", name: "San-Pédro" },
  { id: 6, district: "Comoé", name: "Indénié-Djuablin" },
  { id: 7, district: "Comoé", name: "Sud-Comoé" },
  { id: 8, district: "Denguélé", name: "Folon" },
  { id: 9, district: "Denguélé", name: "Kabadougou" },
  { id: 10, district: "Gôh-Djiboua", name: "Gôh" },
  { id: 11, district: "Gôh-Djiboua", name: "Lôh-Djiboua" },
  { id: 12, district: "Lacs", name: "Bélier" },
  { id: 13, district: "Lacs", name: "Iffou" },
  { id: 14, district: "Lacs", name: "Moronou" },
  { id: 15, district: "Lacs", name: "N'Zi" },
  { id: 16, district: "Lagunes", name: "Agnéby-Tiassa" },
  { id: 17, district: "Lagunes", name: "Grands-Ponts" },
  { id: 18, district: "Lagunes", name: "La Mé" },
  { id: 19, district: "Montagnes", name: "Cavally" },
  { id: 20, district: "Montagnes", name: "Guémon" },
  { id: 21, district: "Montagnes", name: "Tonkpi" },
  { id: 22, district: "Sassandra-Marahoué", name: "Haut-Sassandra" },
  { id: 23, district: "Sassandra-Marahoué", name: "Marahoué" },
  { id: 24, district: "Savanes", name: "Bagoué" },
  { id: 25, district: "Savanes", name: "Poro" },
  { id: 26, district: "Savanes", name: "Tchologo" },
  { id: 27, district: "Vallée du Bandama", name: "Gbêkê" },
  { id: 28, district: "Vallée du Bandama", name: "Hambol" },
  { id: 29, district: "Woroba", name: "Bafing" },
  { id: 30, district: "Woroba", name: "Béré" },
  { id: 31, district: "Woroba", name: "Worodougou" },
  { id: 32, district: "Zanzan", name: "Bounkani" },
  { id: 33, district: "Zanzan", name: "Gontougo" },
  // Ivorians abroad vote at embassies and consulates.
  { id: 34, district: "Diaspora", name: "Diaspora (vote à l'étranger)" },
];

const deps: [number, string[]][] = [
  [1, ["Abidjan"]],
  [2, ["Yamoussoukro", "Attiégouakro"]],
  [3, ["Sassandra", "Fresco"]],
  [4, ["Soubré", "Buyo", "Guéyo", "Méagui"]],
  [5, ["San-Pédro", "Tabou"]],
  [6, ["Abengourou", "Agnibilékrou", "Bettié"]],
  [7, ["Aboisso", "Adiaké", "Grand-Bassam", "Tiapoum"]],
  [8, ["Minignan", "Kaniasso"]],
  [9, ["Odienné", "Gbéléban", "Madinani", "Samatiguila", "Séguélon"]],
  [10, ["Gagnoa", "Oumé"]],
  [11, ["Divo", "Guitry", "Lakota"]],
  [12, ["Toumodi", "Didiévi", "Djékanou", "Tiébissou"]],
  [13, ["Daoukro", "M'Bahiakro", "Prikro"]],
  [14, ["Bongouanou", "Arrah", "M'Batto"]],
  [15, ["Dimbokro", "Bocanda", "Kouassi-Kouassikro"]],
  [16, ["Agboville", "Sikensi", "Taabo", "Tiassalé"]],
  [17, ["Dabou", "Grand-Lahou", "Jacqueville"]],
  [18, ["Adzopé", "Akoupé", "Alépé", "Yakassé-Attobrou"]],
  [19, ["Guiglo", "Bloléquin", "Taï", "Toulépleu"]],
  [20, ["Duékoué", "Bangolo", "Facobly", "Kouibly"]],
  [21, ["Man", "Biankouma", "Danané", "Sipilou", "Zouan-Hounien"]],
  [22, ["Daloa", "Issia", "Vavoua", "Zoukougbeu"]],
  [23, ["Bouaflé", "Sinfra", "Zuénoula"]],
  [24, ["Boundiali", "Kouto", "Tengréla"]],
  [25, ["Korhogo", "Dikodougou", "M'Bengué", "Sinématiali"]],
  [26, ["Ferkessédougou", "Kong", "Ouangolodougou"]],
  [27, ["Bouaké", "Béoumi", "Botro", "Sakassou"]],
  [28, ["Katiola", "Dabakala", "Niakaramadougou"]],
  [29, ["Touba", "Koro", "Ouaninou"]],
  [30, ["Mankono", "Dianra", "Kounahiri"]],
  [31, ["Séguéla", "Kani"]],
  [32, ["Bouna", "Doropo", "Nassian", "Téhini"]],
  [33, ["Bondoukou", "Koun-Fao", "Sandégué", "Tanda", "Transua"]],
  [34, ["Diaspora — Afrique", "Diaspora — Europe", "Diaspora — Amériques", "Diaspora — Asie et Océanie"]],
];

// Departments created after the first seed. Append only: ids follow on from `deps`.
const laterDeps: [number, string][] = [
  [13, "Ouellé"],
  [23, "Bonon"],
  [23, "Gohitafla"],
];

export const departments: Department[] = [];
{
  let id = 1;
  for (const [regionId, names] of deps) for (const name of names) departments.push({ id: id++, regionId, name });
  for (const [regionId, name] of laterDeps) departments.push({ id: id++, regionId, name });
}

// Communes: Abidjan's 13 (10 urban + Anyama, Bingerville, Songon), then one
// commune per department chef-lieu (same name as the department).
const abidjan = ["Abobo", "Adjamé", "Attécoubé", "Cocody", "Koumassi", "Marcory", "Plateau", "Port-Bouët", "Treichville", "Yopougon", "Anyama", "Bingerville", "Songon"];


// Every other commune with an elected council (Ministère de l'Intérieur, E-CONSEIL,
// mandature 2023-2028), grouped by department. Append only: ids follow on.
const laterCommunes: [string, string[]][] = [
  ["Agboville", ["Azaguié", "Rubino"]],
  ["Tiassalé", ["N'Douci"]],
  ["Koro", ["Booko", "Borotou"]],
  ["Touba", ["Guintéguéla"]],
  ["Ouaninou", ["Koonan"]],
  ["Kouto", ["Gbon", "Kolia"]],
  ["Tengréla", ["Kanakono"]],
  ["Boundiali", ["Kasséré"]],
  ["Toumodi", ["Kokoumbo"]],
  ["Didiévi", ["Tié-N'Diékro"]],
  ["Kounahiri", ["Kongasso"]],
  ["Mankono", ["Sarhala", "Tiéningboué"]],
  ["Kaniasso", ["Goulia"]],
  ["Minignan", ["Tienko"]],
  ["Béoumi", ["Bodokro"]],
  ["Bouaké", ["Brobo", "Djébonoua"]],
  ["Botro", ["Diabo"]],
  ["Oumé", ["Diégonéfla"]],
  ["Gagnoa", ["Guibéroua", "Ouragahio"]],
  ["Transua", ["Assuéfry"]],
  ["Koun-Fao", ["Kouassi-Datékro"]],
  ["Dabakala", ["Bassawa", "Boniérédougou", "Foumbolo", "Satama-Sokoro", "Satama-Sokoura"]],
  ["Katiola", ["Fronan"]],
  ["Niakaramadougou", ["Tafiré", "Tortiya"]],
  ["Daloa", ["Bédiala", "Gboguhé"]],
  ["Issia", ["Saïoua"]],
  ["Daoukro", ["Ettrokro"]],
  ["Abengourou", ["Niablé"]],
  ["Odienné", ["Bako", "Dioulatièdougou", "Tiémé"]],
  ["Gbéléban", ["Seydougou"]],
  ["Akoupé", ["Afféry"]],
  ["Adzopé", ["Agou"]],
  ["Lakota", ["Zikisso"]],
  ["M'Batto", ["Anoumaba", "Tiémélékro"]],
  ["Soubré", ["Grand-Zattry", "Mayo"]],
  ["Dikodougou", ["Guiembé"]],
  ["Korhogo", ["Karakoro", "Komborodougou", "Napié", "Niofoin", "Sirasso", "Tioroniaradougou"]],
  ["Tabou", ["Grabo"]],
  ["San-Pédro", ["Grand-Béréby"]],
  ["Adiaké", ["Assinie-Mafia"]],
  ["Aboisso", ["Ayamé", "Maféré"]],
  ["Grand-Bassam", ["Bonoua"]],
  ["Ouangolodougou", ["Diawala", "Niellé"]],
  ["Ferkessédougou", ["Koumbala"]],
  ["Zouan-Hounien", ["Bin-Houyé"]],
  ["Biankouma", ["Gbonné"]],
  ["Man", ["Logoualé", "Sangouiné"]],
  ["Kani", ["Djibrosso", "Morondo"]],
  ["Séguéla", ["Dualla", "Sifié", "Worofla"]],
];

export const communes: Commune[] = [];
{
  let id = 1;
  for (const name of abidjan) communes.push({ id: id++, departmentId: 1, name });
  for (const d of departments) if (d.id !== 1) communes.push({ id: id++, departmentId: d.id, name: d.name });
  for (const [dep, names] of laterCommunes) {
    const d = departments.find((x) => x.name === dep);
    if (!d) throw new Error(`ci-geo: unknown department ${dep}`);
    for (const name of names) communes.push({ id: id++, departmentId: d.id, name });
  }
}

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const regionById = new Map(regions.map((r) => [r.id, r]));
export const departmentById = new Map(departments.map((d) => [d.id, d]));
export const communeById = new Map(communes.map((c) => [c.id, c]));

export function communeLabel(id: number | null | undefined) {
  if (!id) return null;
  const c = communeById.get(id);
  if (!c) return null;
  const d = departmentById.get(c.departmentId);
  const r = d && regionById.get(d.regionId);
  return { commune: c.name, department: d?.name ?? "", region: r?.name ?? "", district: r?.district ?? "" };
}
