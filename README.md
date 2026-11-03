# RAJGAR Ludo – Android app

`web/` is the game (HTML/CSS/JS). `android/` is the native shell that bundles it.
GitHub Actions (`.github/workflows/android.yml`) builds on every push to `app` and publishes
the APK, the Play-ready `.aab` and emulator screenshots to the `builds` branch.

Local build (needs JDK 17 + Android SDK 36 + Gradle 8.14):

```
mkdir -p android/app/src/main/assets/www && cp -r web/. android/app/src/main/assets/www/
bash tools/fonts.sh android/app/src/main/assets/www/fonts
gradle -p android assembleDebug          # -> android/app/build/outputs/apk/debug/app-debug.apk
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
RG_KEYSTORE=/path/upload.jks RG_KEY_PASS=... gradle -p android bundleRelease   # -> .aab for Play
```
