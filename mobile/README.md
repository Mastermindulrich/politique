# POLITIQUE for Android and iOS

The apps are a [Capacitor](https://capacitorjs.com) shell around the live site
(`https://politique.prototypex.org`). Everything deployed to Vercel reaches the apps at once;
only changes inside this folder (native code, plugins, icons, splash) need a new store build.

What is native:

- **Push notifications**: FCM on Android, APNs on iPhone. The site detects the app
  (`window.Capacitor`, user agent `PolitiqueApp/1.0`) and switches from Web Push to native
  push (`lib/native.ts`). Devices are saved in `politique.push_subscriptions` with the endpoint
  `https://native.invalid/<android|ios>/<token>`, and `lib/native-push.ts` sends to them. No
  database change was needed.
- Icon, splash screen, status bar, Android back button, notification channels
  ("Messages" and "Activité"), tap on a notification opens the right page.
- Links to other sites open in the phone's browser; `www/offline.html` shows when there is no
  connection.

App id (both stores): `org.prototypex.politique`.

## Build

GitHub Actions (`.github/workflows/mobile.yml`) builds on every change to `mobile/`:

- **Android test app**: download `politique-android-test-apk` from the run's Artifacts,
  copy it to an Android phone and open it (allow "install unknown apps").
- **Play Store bundle** (`.aab`): built when the keystore secrets exist.
- **iOS**: compiled for the simulator to catch errors. Real iPhone builds need the Apple
  account (below).

Locally: `npm ci && npx cap sync`, then `npx cap open android` (Android Studio) or
`npx cap open ios` (Xcode, Mac only). Regenerate icons and splash from `assets/` with
`npm run assets`.

## One-time setup (owner)

### 1. Firebase (Android push), free

1. https://console.firebase.google.com → Add project "POLITIQUE" (Analytics not needed).
2. Add an Android app with package name `org.prototypex.politique`. Download
   `google-services.json` and save its content as the GitHub secret `GOOGLE_SERVICES_JSON`.
3. Project settings → Service accounts → Generate new private key. Put the whole JSON in the
   Vercel env var `FCM_SERVICE_ACCOUNT` (production + preview) of project `politique`.

### 2. Apple (iPhone push and App Store), 99 USD per year

1. Enrol at https://developer.apple.com/programs/ (as an organisation this needs a D-U-N-S
   number; as an individual it's faster).
2. Certificates, IDs & Profiles → Identifiers → register App ID `org.prototypex.politique`
   with **Push Notifications** enabled.
3. Keys → create a key with **Apple Push Notifications service (APNs)**. Download the `.p8`
   (only once). Vercel env vars: `APNS_KEY` (file content), `APNS_KEY_ID`, `APNS_TEAM_ID`
   (`APNS_BUNDLE_ID` defaults to `org.prototypex.politique`).
4. App Store Connect → create the app "POLITIQUE" with that bundle id, then an
   **App Store Connect API key** (Users and Access → Integrations) so CI can upload to
   TestFlight.

### 3. Google Play, 25 USD once

1. https://play.google.com/console → create a developer account (identity check takes a few
   days; new personal accounts must run a closed test with 12 testers for 14 days before
   production).
2. Create the app "POLITIQUE". Use **Play App Signing**.
3. Create an upload keystore once, keep it safe, and add the secrets
   `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
   `ANDROID_KEY_PASSWORD`:

   ```sh
   keytool -genkeypair -v -keystore upload.jks -alias politique -keyalg RSA -keysize 2048 -validity 10000
   base64 -i upload.jks | pbcopy   # macOS; on Linux: base64 -w0 upload.jks
   ```

### Store listing checklist

Privacy policy URL `https://politique.prototypex.org/confidentialite`, support e-mail,
screenshots (phone), short and long description (FR + EN), content rating questionnaire,
data safety form (e-mail, voting place kept private, user content), account deletion
(in app: Paramètres → Supprimer mon compte), user reporting and blocking (present).
