// android\app\src\main\java\com\clipcascade\HeadlessTaskService.kt
package com.darkaxt.clipcascade

import android.content.Intent
import android.util.Log
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig


class HeadlessTaskService : HeadlessJsTaskService() {
    companion object {
        private const val TAG = "HeadlessTaskService"
    }

    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
        val event = intent?.extras?.getString("event")
        Log.i(TAG, "Creating headless JS task config event=$event hasExtras=${intent?.extras != null}")
        return intent?.extras?.let {
            HeadlessJsTaskConfig(
                "Restart", // JS task name
                Arguments.fromBundle(it), // Data passed to the task
                60000, // Timeout for foreground service startup
                true // Allow task to run in foreground
            )
        }
    } 
}
