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
        private const val DEFAULT_PROBE_ATTEMPTS = 80
        private const val RESTART_PROBE_ATTEMPTS = 240
        private const val PROBE_INTERVAL_MS = 250L

        fun removeNotificationIfPresent(context: Context) {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.cancel(NOTIFICATION_ID)
            Log.i(TAG, "Inactive service notification cleared")
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
            Log.i(TAG, "Watchdog worker started")
            if(!hasNotificationPermission(applicationContext)) {
                Log.w(TAG, "Notification permission is missing; watchdog cannot alert")
                return Result.success()
            }

            val bridgeData = AsyncStorageBridge(applicationContext)
            if(!enableForegroundService(bridgeData)) {
                Log.i(TAG, "Foreground service preference is disabled; skipping watchdog probe")
                removeNotificationIfPresent(applicationContext)
                return Result.success()
            }

            if(foregroundServiceIsActive(bridgeData, "initial")) {
                Log.i(TAG, "Foreground JS service answered initial health ping")
                bridgeData.setValue("foreground_service_stopped_running", "false")
                removeNotificationIfPresent(applicationContext)
                return Result.success()
            }

            Log.w(TAG, "Foreground JS service missed initial health ping; requesting headless restart")
            bridgeData.setValue("foreground_service_stopped_running", "true")
            if (requestHeadlessRestart()) {
                if(foregroundServiceIsActive(bridgeData, "post-restart", RESTART_PROBE_ATTEMPTS)) {
                    Log.i(TAG, "Foreground JS service answered post-restart health ping")
                    bridgeData.setValue("foreground_service_stopped_running", "false")
                    removeNotificationIfPresent(applicationContext)
                    return Result.success()
                }
                Log.w(TAG, "Foreground JS service still inactive after headless restart probe")
            } else {
                Log.w(TAG, "Headless restart request failed before post-restart probe")
            }

            showNotificationIfNotPresent()

            return Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "Error running worker", e)
            return Result.failure()
        }
    }

    private fun requestHeadlessRestart(): Boolean {
        try {
            val intent = Intent(applicationContext, HeadlessTaskService::class.java).apply {
                putExtra("event", EVENT_SERVICE_INACTIVE)
            }
            val componentName = applicationContext.startService(intent)
            HeadlessJsTaskService.acquireWakeLockNow(applicationContext)
            Log.i(TAG, "Headless restart service requested: $componentName")
            return componentName != null
        } catch (e: Exception) {
            Log.e(TAG, "Failed to request headless foreground service restart", e)
            return false
        }
    }


    fun enableForegroundService(bridgeData: AsyncStorageBridge) : Boolean {
        // Get websocket(foreground service) status (enabled/disabled)
        val rawValue = bridgeData.getValue("wsIsRunning")
        val enabled = rawValue?.toBoolean() ?: false
        Log.i(TAG, "wsIsRunning raw=$rawValue enabled=$enabled")
        return enabled
    } 
    
    suspend fun foregroundServiceIsActive(
        bridgeData: AsyncStorageBridge,
        label: String = "probe",
        attempts: Int = DEFAULT_PROBE_ATTEMPTS
    ) : Boolean {
        // check if foreground service is running
        val previousEcho = bridgeData.getValue("echo")
        Log.i(TAG, "Probing foreground JS service label=$label attempts=$attempts previousEcho=$previousEcho")
        val pingWritten = bridgeData.setValue("echo", "ping")
        Log.i(TAG, "Foreground JS service probe ping write label=$label success=$pingWritten")
        val startedAt = System.currentTimeMillis()
        repeat(attempts) { attempt ->
            delay(PROBE_INTERVAL_MS)
            if (bridgeData.getValue("echo") == "pong") {
                val elapsedMs = System.currentTimeMillis() - startedAt
                Log.i(TAG, "Foreground JS service probe succeeded label=$label attempt=${attempt + 1} elapsedMs=$elapsedMs")
                return true
            }
        }
        val finalEcho = bridgeData.getValue("echo")
        Log.w(TAG, "Foreground JS service probe timed out label=$label attempts=$attempts finalEcho=$finalEcho")
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
            Log.w(TAG, "Inactive service notification posted")
        } else {
            Log.i(TAG, "Inactive service notification already active")
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
