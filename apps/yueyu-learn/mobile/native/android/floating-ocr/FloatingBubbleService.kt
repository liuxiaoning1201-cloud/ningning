/*
 * 粵語學習 — Android 浮窗 OCR 服務（Kotlin）
 *
 * 在其他視頻 APP（YouTube / bilibili / 騰訊視頻）上方顯示一個小球，
 * 點擊小球觸發 MediaProjection 截屏，把截圖送回 WebView 走 OCR + 翻譯。
 *
 * ╔══ 用戶在 Android Studio 中：═══════════════════════════════════════╗
 * ║ 1. 把本檔放到 app/src/main/java/com/zykongjian/yueyu/floating/      ║
 * ║ 2. AndroidManifest.xml 加：                                       ║
 * ║      <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW"/> ║
 * ║      <uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>   ║
 * ║      <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION"/>║
 * ║      <service                                                      ║
 * ║         android:name=".floating.FloatingBubbleService"             ║
 * ║         android:exported="false"                                   ║
 * ║         android:foregroundServiceType="mediaProjection" />         ║
 * ║ 3. 在 MainActivity 添加 startService(Intent(...)) 觸發顯示          ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */
package com.zykongjian.yueyu.floating

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.IBinder
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.ImageView

class FloatingBubbleService : Service() {

    companion object {
        const val CHANNEL_ID = "yueyu_floating"
        const val NOTI_ID = 4567

        var pendingScreenshotResult: ((String) -> Unit)? = null
    }

    private lateinit var windowManager: WindowManager
    private var bubbleView: View? = null
    private var mediaProjection: MediaProjection? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        startForeground(NOTI_ID, buildNotification())
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        showBubble()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.getBooleanExtra("kill", false) == true) {
            stopSelf()
        }
        return START_STICKY
    }

    private fun showBubble() {
        val bubble = ImageView(this).apply {
            setImageResource(android.R.drawable.ic_menu_camera)
            setBackgroundResource(android.R.drawable.btn_default_small)
            setPadding(20, 20, 20, 20)
        }

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            else
                @Suppress("DEPRECATION")
                WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = 100
            y = 400
        }

        var initX = 0
        var initY = 0
        var touchX = 0f
        var touchY = 0f

        bubble.setOnTouchListener { _, ev ->
            when (ev.action) {
                MotionEvent.ACTION_DOWN -> {
                    initX = params.x; initY = params.y
                    touchX = ev.rawX; touchY = ev.rawY
                    false
                }
                MotionEvent.ACTION_MOVE -> {
                    params.x = initX + (ev.rawX - touchX).toInt()
                    params.y = initY + (ev.rawY - touchY).toInt()
                    windowManager.updateViewLayout(bubble, params)
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (kotlin.math.abs(ev.rawX - touchX) < 10
                        && kotlin.math.abs(ev.rawY - touchY) < 10) {
                        triggerScreenshot()
                    }
                    true
                }
                else -> false
            }
        }

        windowManager.addView(bubble, params)
        bubbleView = bubble
    }

    private fun triggerScreenshot() {
        // 觸發 MainActivity 申請 MediaProjection 並截屏。
        // 結果通過 pendingScreenshotResult 回調 / LocalBroadcast 送回 WebView。
        val intent = Intent("com.zykongjian.yueyu.REQUEST_SCREENSHOT")
            .setPackage(packageName)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        sendBroadcast(intent)
    }

    private fun buildNotification(): Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_ID,
                    "粵語學習浮窗",
                    NotificationManager.IMPORTANCE_LOW,
                ),
            )
        }
        return Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_view)
            .setContentTitle("粵語學習浮窗")
            .setContentText("點擊小球截屏並翻譯字幕")
            .setOngoing(true)
            .build()
    }

    override fun onDestroy() {
        bubbleView?.let { windowManager.removeView(it) }
        bubbleView = null
        mediaProjection?.stop()
        super.onDestroy()
    }
}
