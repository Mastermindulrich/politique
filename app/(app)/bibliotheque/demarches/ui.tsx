import { I } from "@/app/components/ui/icons";
import { MODE_LABEL, type Demarche, type DemarcheTheme } from "@/lib/demarches";

const MODE_CLASS: Record<Demarche["mode"], string> = {
  online: "bg-green/10 text-green-deep",
  partial: "bg-orange/10 text-orange",
  office: "bg-paper text-muted",
};

export function ModeBadge({ mode, lang }: { mode: Demarche["mode"]; lang: string }) {
  return (
    <span className={`chip whitespace-nowrap ${MODE_CLASS[mode]}`}>
      {mode !== "office" && <I.globe className="h-3.5 w-3.5" />}
      {MODE_LABEL[mode][lang === "fr" ? "fr" : "en"]}
    </span>
  );
}

const THEME_ICON: Record<DemarcheTheme, keyof typeof I> = {
  justice: "shield",
  identite: "user",
  "etat-civil": "file",
  elections: "flag",
  social: "heart",
  transport: "pin",
  entreprise: "chart",
};

export function ThemeIcon({ theme, className }: { theme: DemarcheTheme; className?: string }) {
  const Icon = I[THEME_ICON[theme]];
  return <Icon className={className} />;
}
