// Native (Capacitor / Android) glue.
//
// This module is a NO-OP in a normal browser: every code path is guarded by
// `Capacitor.isNativePlatform()`, so the web/desktop build is unaffected and the
// `@capacitor/app` import simply sits unused. It only does anything inside the
// Android WebView shell produced by `npx cap sync android` (see ANDROID_BUILD.md).
//
// Today it does one important thing: it intercepts the Android hardware BACK
// button. Without a listener, Capacitor's default is to exit the app on back —
// an accidental press during a chase would silently quit the game. Instead we
// route it through performBack() (same precedence as the Escape key): close the
// open overlay, else toggle pause, and only leave the app from the title screen.
import { App } from '@capacitor/app';
import { performBack } from './input.js';

function isNative(){
  return !!((window as any).Capacitor && (window as any).Capacitor.isNativePlatform && (window as any).Capacitor.isNativePlatform());
}

export function setupNative(){
  if(!isNative())return;
  // Lets CSS hide browser-only chrome (e.g. the FULL button — the native shell
  // is already immersive-fullscreen) and tweak anything that's Android-specific.
  document.body.classList.add('is-native');

  App.addListener('backButton', () => {
    if(performBack()==='exit')App.exitApp();
  });
}
