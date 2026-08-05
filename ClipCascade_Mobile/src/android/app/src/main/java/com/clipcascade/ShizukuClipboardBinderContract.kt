package com.darkaxt.clipcascade

internal object ShizukuClipboardBinderContract {
    private const val DEVICE_ID_ADDED_SDK = 34
    private const val DEFAULT_DEVICE_ID = 0

    fun getPrimaryClipIntArguments(sdkInt: Int, userId: Int): IntArray {
        return if (sdkInt >= DEVICE_ID_ADDED_SDK) {
            intArrayOf(userId, DEFAULT_DEVICE_ID)
        } else {
            intArrayOf(userId)
        }
    }
}
