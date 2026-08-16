# Resident Training Mobile App

The mobile app is a Capacitor 8 native wrapper around the live Resident Training portal.

## Live web source

`https://alexcardiology.github.io/Residents/`

Both Android and iOS therefore use the same Supabase accounts and data as the website, and normal web updates are visible inside the installed app without creating a second database.

## Android

`.github/workflows/mobile-build.yml` builds an installable Android APK whenever the main portal frontend or mobile configuration changes. The stable public download URL is:

`https://github.com/alexcardiology/Residents/releases/download/mobile-latest/resident-training-android.apk`

The initial automated package is a beta/debug-signed APK. Before broad long-term distribution, configure a private Android release keystore in GitHub Actions so future versions can update an already installed app without uninstalling it.

## iOS

The same workflow creates the native Xcode project and uploads it as a workflow artifact. Installing on ordinary iPhones requires Apple code signing and distribution through TestFlight or the App Store. Once an Apple Developer account and App Store Connect signing credentials are connected, replace the pending iPhone button in `download.html` with the TestFlight public link.

## Download page

`download.html` is the public download landing page for Android and iPhone/iPad.
