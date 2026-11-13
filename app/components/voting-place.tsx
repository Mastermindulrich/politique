"use client";

import { communes, departments, regions } from "@/lib/ci-geo";
import { t as dict } from "@/lib/i18n";
import { I } from "./ui/icons";

export type VotingPlace = {
  vote_region_id: number | null;
  vote_department_id: number | null;
  vote_commune_id: number | null;
  vote_locality: string;
  is_registered_voter: boolean;
};

export const emptyVotingPlace: VotingPlace = { vote_region_id: null, vote_department_id: null, vote_commune_id: null, vote_locality: "", is_registered_voter: true };

/** A voting place is usable once the region and the department are known. */
export function votingPlaceComplete(v: VotingPlace) {
  return Boolean(v.vote_region_id && v.vote_department_id);
}

const sorted = [...regions].sort((a, b) => (a.id === 34 ? 1 : b.id === 34 ? -1 : a.name.replace(/^District autonome d[e']\s?/, "").localeCompare(b.name.replace(/^District autonome d[e']\s?/, ""), "fr")));

/**
 * Region, department, commune and locality where the person votes.
 * This is private data: it is only ever written to private_profiles.
 */
export function VotingPlaceFields({ value, onChange, lang, showNotice = true }: { value: VotingPlace; onChange: (v: VotingPlace) => void; lang: "fr" | "en"; showNotice?: boolean }) {
  const t = dict(lang);
  const deps = value.vote_region_id ? departments.filter((d) => d.regionId === value.vote_region_id) : [];
  const coms = value.vote_department_id ? communes.filter((c) => c.departmentId === value.vote_department_id) : [];

  const setRegion = (id: number | null) => {
    const ds = id ? departments.filter((d) => d.regionId === id) : [];
    const dep = ds.length === 1 ? ds[0].id : null;
    const cs = dep ? communes.filter((c) => c.departmentId === dep) : [];
    onChange({ ...value, vote_region_id: id, vote_department_id: dep, vote_commune_id: cs.length === 1 ? cs[0].id : null });
  };
  const setDepartment = (id: number | null) => {
    const cs = id ? communes.filter((c) => c.departmentId === id) : [];
    onChange({ ...value, vote_department_id: id, vote_commune_id: cs.length === 1 ? cs[0].id : null });
  };

  return (
    <div className="flex flex-col gap-4">
      {showNotice && (
        <p className="flex items-start gap-2 rounded-2xl bg-green-soft px-4 py-3 text-[13px] leading-relaxed text-green-deep">
          <I.shield className="mt-0.5 h-4 w-4 flex-none" />
          {t.auth.votingPrivacy}
        </p>
      )}
      <label>
        <span className="label">{t.auth.region}</span>
        <select className="select" required value={value.vote_region_id ?? ""} onChange={(e) => setRegion(e.target.value ? Number(e.target.value) : null)}>
          <option value="" disabled>—</option>
          {sorted.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </label>
      <label>
        <span className="label">{t.auth.department}</span>
        <select className="select" required disabled={!deps.length} value={value.vote_department_id ?? ""} onChange={(e) => setDepartment(e.target.value ? Number(e.target.value) : null)}>
          <option value="" disabled>—</option>
          {deps.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </label>
      {coms.length > 0 && (
        <label>
          <span className="label">{t.auth.commune}</span>
          <select className="select" value={value.vote_commune_id ?? ""} onChange={(e) => onChange({ ...value, vote_commune_id: e.target.value ? Number(e.target.value) : null })}>
            <option value="">—</option>
            {coms.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      )}
      <label>
        <span className="label">{t.auth.locality}</span>
        <input className="input" maxLength={100} value={value.vote_locality} onChange={(e) => onChange({ ...value, vote_locality: e.target.value })} autoComplete="off" />
      </label>
      <label className="flex items-center gap-3 text-[14px]">
        <input type="checkbox" className="h-5 w-5 accent-[#0A7A4A]" checked={value.is_registered_voter} onChange={(e) => onChange({ ...value, is_registered_voter: e.target.checked })} />
        {t.auth.registered}
      </label>
    </div>
  );
}
