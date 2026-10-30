package com.darkaxt.clipcascade

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ClipboardWriteOriginTest {
    @Test fun onlyTheActualLocalWriteIsExcludedNotAnIdenticalUserCopy() {
        repeat(40) { assertTrue(ClipboardWriteOrigin.isLocal(ClipboardWriteOrigin.token)) }
        assertFalse(ClipboardWriteOrigin.isLocal(null))
        assertFalse(ClipboardWriteOrigin.isLocal("different-process-or-device"))
    }
}
