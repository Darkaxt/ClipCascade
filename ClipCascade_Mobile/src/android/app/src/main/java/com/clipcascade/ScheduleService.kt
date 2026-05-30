// android\app\src\main\java\com\clipcascade\ScheduleService.kt
package com.darkaxt.clipcascade

import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.work.WorkerParameters
import android.app.NotificationChannel
import android.app.NotificationManager
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import kotlinx.coroutines.delay
import android.app.PendingIntent
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import android.util.Log
import com.facebook.react.HeadlessJsTaskService


class ScheduleService(context: Context, workerParams: WorkerParameters) : CoroutineWorker(context, workerParams) {
    
    companion object {
        private const val TAG = "ScheduleService"
        private const val NOTIFICATION_CHANNEL_ID = "clipcascade_foreground_service_stopped_running"
        private const val NOTIFICATION_ID = 1
        private const val EVENT_SERVICE_INACTIVE = "SERVICE_INACTIVE"

        fun removeNotificationIfPresent(context: Context) {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.cancel(NOTIFICATION_ID)
        }

        fun hasNotificationPermission(context: Context): Boolean {
            return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                ContextCompat.checkSelfPermission(
                    context,
                    android.Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED
            } else {
                true
            }
        }
    }

    // init
    override suspend fun doWork(): Result {

        // show notification if foreground service is not running
        try {
            if(hasNotificationPermission(applicationContext)) {
                val bridgeData = AsyncStorageBridge(applicationContext)
                if(enableForegroundService(bridgeData)) {
                    if(!foregroundServiceIsActive(bridgeData)) {
                        Log.w(TAG, "Foreground JS service did not answer health ping; requesting headless restart")
                        bridgeData.setValue("foreground_service_stopped_running", "true")
                        requestHeadlessRestart()
                        showNotificationIfNotPresent()
                    } else {
                        Log.i(TAG, "Foreground JS service answered health ping")
                        removeNotificationIfPresent(applicationContext)
                    }
                }
            }

            return Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "Error running worker", e)
            return Result.failure()
        }
    }

    private fun requestHeadlessRestart() {
        try {
            val intent = Intent(applicationContext, HeadlessTaskService::class.java).apply {
                putExtra("event", EVENT_SERVICE_INACTIVE)
            }
            applicationContext.startService(intent)
            HeadlessJsTaskService.acquireWakeLockNow(applicationContext)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to request headless foreground service restart", e)
        }
    }


    fun enableForegroundService(bridgeData: AsyncStorageBridge) : Boolean {
        // Get websocket(foreground service) status (enabled/disabled)
        return bridgeData.getValue("wsIsRunning")?.toBoolean() ?: false 
    } 
    
    suspend fun foregroundServiceIsActive(bridgeData: AsyncStorageBridge) : Boolean {
        // check if foreground service is running
        Log.i(TAG, "Probing foreground JS service")
        bridgeData.setValue("echo", "ping")
        repeat(80) { // 20000 ms
            delay(250) // Wait for 250 ms
            if (bridgeData.getValue("echo") == "pong") {
                Log.i(TAG, "Foreground JS service probe succeeded")
                return true
            }
        }
        Log.w(TAG, "Foreground JS service probe timed out")
        return false
    }

    private fun showNotificationIfNotPresent() {
        val notificationManager = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "ClipCascade Alerts",
                NotificationManager.IMPORTANCE_DEFAULT
            )
            notificationManager.createNotificationChannel(channel)
        }

        // Check if the notification is already shown
        if (!isNotificationActive(notificationManager)) {
            val intent = Intent(applicationContext, MainActivity::class.java).apply {
                action = "com.darkaxt.clipcascade.NOTIFICATION_ACTION"
                putExtra("action", "foreground_service_stopped_running")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            }

            val pendingIntent = PendingIntent.getActivity(
                applicationContext, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val notification = NotificationCompat.Builder(applicationContext, NOTIFICATION_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification_failure)
                .setContentTitle("ClipCascade Service Inactive")
                .setContentText("ClipCascade monitoring is inactive. Tap to restart.")
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .build()

            notificationManager.notify(NOTIFICATION_ID, notification)
        }
    }

    private fun isNotificationActive(notificationManager: NotificationManager): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val activeNotifications = notificationManager.activeNotifications
            return activeNotifications.any { it.id == NOTIFICATION_ID }
        }
        return false
    }
}
