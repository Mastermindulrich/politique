import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/app/components/shell/shell";
import { social } from "@/lib/i18n-social";
import { getViewer } from "@/lib/supabase/server";
import { PeoplePicker } from "./people-picker";

export const metadata: Metadata = { title: "Nouveau message" };

export default async function NewMessagePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/connexion");
  return (
    <>
      <PageHeader title={social(viewer.lang).messages.new} back="/messages" />
      <PeoplePicker lang={viewer.lang} />
    </>
  );
}
