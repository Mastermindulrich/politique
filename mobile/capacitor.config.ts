import type { CapacitorConfig } from "@capacitor/cli";

/**
 * POLITIQUE app shell.
 *
 * The app opens the live site, so every change deployed on Vercel reaches the
 * Android and iOS apps at once, without a store update. Capacitor injects its
 * native bridge into pages of this host only, which is how the site reaches
 * native push (see lib/native.ts in the site).
 *
 * Only a change to this folder (native code, plugins, icons) needs a new store build.
 */
const SITE = process.env.POLITIQUE_URL || "https://politique.prototypex.org";

const config: CapacitorConfig = {
  appId: "org.prototypex.politique",
  appName: "POLITIQUE",
  webDir: "www",
  // The site reads this to know it runs inside the app (no "add to Home Screen" tips, native push).
  appendUserAgent: "PolitiqueApp/1.0",
  backgroundColor: "#16181C",
  server: {
    url: `${SITE}/accueil`,
    // Shown when the phone is offline or the site cannot be reached.
    errorPath: "offline.html",
    // Supabase storage serves photos and documents; everything else opens in the phone's browser.
    allowNavigation: ["politique.prototypex.org", "*.supabase.co"],
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
  },
  ios: {
    contentInset: "never",
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SystemBars: { insetsHandling: "native", initialViewportFitValueHint: "cover" },
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#16181C",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
      splashFullScreen: false,
      splashImmersive: false,
    },
    PushNotifications: {
      // In the foreground the site already shows its own live banner and sound.
      presentationOptions: [],
    },
  },
};

export default config;
