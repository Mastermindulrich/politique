"use client";

import "./globals.css";
import { useEffect } from "react";
import { ErrorScreen } from "./error";

/** Last resort when the root layout itself fails: same friendly screen, full page reload to retry. */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => console.error(error), [error]);
  return (
    <html lang="fr">
      <body>
        <ErrorScreen onRetry={() => window.location.reload()} />
      </body>
    </html>
  );
}
