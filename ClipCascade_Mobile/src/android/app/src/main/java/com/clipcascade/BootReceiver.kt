// android\app\src\main\java\com\clipcascade\BootReceiver.kt
package com.darkaxt.clipcascade

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent?.action) {
            Intent.ACTION_BOOT_COMPLETED -> startHeadlessTask(context, "BOOT_COMPLETED")
            Intent.ACTION_MY_PACKAGE_REPLACED -> startHeadlessTask(context, "PACKAGE_REPLACED")
        }
    }

    private fun startHeadlessTask(context: Context, event: String) {
        val headlessTaskIntent = Intent(context, HeadlessTaskService::class.java).apply {
            putExtra("event", event)
        }
        context.startService(headlessTaskIntent)
    }
}
