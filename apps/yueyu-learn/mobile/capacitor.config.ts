import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.zykongjian.yueyu',
  appName: '粵語學習',
  webDir: 'www',
  server: {
    androidScheme: 'https',
    // 開發時可指向本地網頁；正式打包用打包進 APP 的 www
    // url: 'http://192.168.1.100:5173',
    // cleartext: true,
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#f7f3eb',
  },
  android: {
    backgroundColor: '#f7f3eb',
    allowMixedContent: false,
  },
  plugins: {
    StatusBar: {
      style: 'DEFAULT',
      backgroundColor: '#f7f3eb',
    },
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#f7f3eb',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
}

export default config
