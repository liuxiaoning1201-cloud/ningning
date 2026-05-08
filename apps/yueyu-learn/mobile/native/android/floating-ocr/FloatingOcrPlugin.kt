/*
 * 粵語學習 — Capacitor 自定義插件「FloatingOcr」（Android 端）
 *
 * 暴露給 WebView 三個方法：
 *   - hasOverlayPermission()    檢查是否已授予 SYSTEM_ALERT_WINDOW
 *   - requestOverlayPermission() 跳轉到設置
 *   - startBubble() / stopBubble() 啟停浮窗服務
 *
 * 註冊：在 MainActivity.onCreate() 中：
 *   registerPlugin(FloatingOcrPlugin::class.java)
 */
package com.zykongjian.yueyu.floating

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "FloatingOcr")
class FloatingOcrPlugin : Plugin() {

    @PluginMethod
    fun hasOverlayPermission(call: PluginCall) {
        val granted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Settings.canDrawOverlays(context)
        } else {
            true
        }
        val ret = JSObject()
        ret.put("granted", granted)
        call.resolve(ret)
    }

    @PluginMethod
    fun requestOverlayPermission(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
            && !Settings.canDrawOverlays(context)) {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:${context.packageName}"),
            ).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
            context.startActivity(intent)
        }
        call.resolve()
    }

    @PluginMethod
    fun startBubble(call: PluginCall) {
        val intent = Intent(context, FloatingBubbleService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
        call.resolve()
    }

    @PluginMethod
    fun stopBubble(call: PluginCall) {
        val intent = Intent(context, FloatingBubbleService::class.java)
            .putExtra("kill", true)
        context.startService(intent)
        call.resolve()
    }
}
