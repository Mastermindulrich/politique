// The root layout sets <html lang="fr">; this script corrects it for the
// English route before paint, without duplicating the whole layout.
export default function EnLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: "document.documentElement.lang='en';if(!/(?:^|; )lang=/.test(document.cookie))document.cookie='lang=en; path=/; max-age=31536000; samesite=lax'" }} />
      {children}
    </>
  );
}
