package com.darkaxt.clipcascade

internal class ClipboardObservationTracker {
    private var previous: Pair<String, Long>? = null

    fun seed(signature: String?, timestamp: Long) {
        previous = signature?.let { it to timestamp }
    }

    fun observe(signature: String?, timestamp: Long): Boolean {
        val current = signature?.let { it to timestamp }
        val changed = current != previous
        previous = current
        return current != null && changed
    }
}
