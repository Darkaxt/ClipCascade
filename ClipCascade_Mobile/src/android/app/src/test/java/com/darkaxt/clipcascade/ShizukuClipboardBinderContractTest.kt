package com.darkaxt.clipcascade

import org.junit.Assert.assertArrayEquals
import org.junit.Test

class ShizukuClipboardBinderContractTest {

    @Test
    fun android13WritesOnlyTheUserId() {
        assertArrayEquals(
            intArrayOf(10),
            ShizukuClipboardBinderContract.getPrimaryClipIntArguments(
                sdkInt = 33,
                userId = 10
            )
        )
    }

    @Test
    fun android14AndNewerAlsoWriteTheDeviceId() {
        assertArrayEquals(
            intArrayOf(10, 0),
            ShizukuClipboardBinderContract.getPrimaryClipIntArguments(
                sdkInt = 34,
                userId = 10
            )
        )
    }
}
