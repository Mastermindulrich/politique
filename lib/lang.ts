import { cookies } from "next/headers";
import { getViewer } from "@/lib/supabase/server";

/** Interface language: the signed-in profile's choice, else the `lang` cookie, else French. */
export async function getLang(): Promise<"fr" | "en"> {
  const viewer = await getViewer();
  if (viewer) return viewer.lang;
  const store = await cookies();
  return store.get("lang")?.value === "en" ? "en" : "fr";
}
