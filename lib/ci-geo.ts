// Administrative geography of Côte d'Ivoire: 2 autonomous districts + 12 districts,
// 31 regions, departments and the communes used for the voting location.
// Source of truth for both the sign-up form and supabase/seed/ci_geo.sql
// (regenerate with `node scripts/gen-geo-sql.mjs`).
//
// Departments follow the 2021 administrative map. Communes listed here are the
// chef-lieu of each department plus the communes of the District of Abidjan;
// smaller communes can be added later without changing ids (append only).

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
  [28, ["Katiola", "Dabakala", "Niakaramandougou"]],
  [29, ["Touba", "Koro", "Ouaninou"]],
  [30, ["Mankono", "Dianra", "Kounahiri"]],
  [31, ["Séguéla", "Kani"]],
  [32, ["Bouna", "Doropo", "Nassian", "Téhini"]],
  [33, ["Bondoukou", "Koun-Fao", "Sandégué", "Tanda", "Transua"]],
];

export const departments: Department[] = [];
{
  let id = 1;
  for (const [regionId, names] of deps) for (const name of names) departments.push({ id: id++, regionId, name });
}

// Communes: Abidjan's 13 (10 urban + Anyama, Bingerville, Songon), then one
// commune per department chef-lieu (same name as the department).
const abidjan = ["Abobo", "Adjamé", "Attécoubé", "Cocody", "Koumassi", "Marcory", "Plateau", "Port-Bouët", "Treichville", "Yopougon", "Anyama", "Bingerville", "Songon"];

export const communes: Commune[] = [];
{
  let id = 1;
  for (const name of abidjan) communes.push({ id: id++, departmentId: 1, name });
  for (const d of departments) if (d.id !== 1) communes.push({ id: id++, departmentId: d.id, name: d.name });
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
