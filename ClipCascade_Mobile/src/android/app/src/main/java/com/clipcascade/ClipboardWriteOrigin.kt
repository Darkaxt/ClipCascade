package com.darkaxt.clipcascade

import java.util.UUID

internal object ClipboardWriteOrigin {
    const val EXTRA = "com.darkaxt.clipcascade.WRITE_ORIGIN"
    val token: String = UUID.randomUUID().toString()
    fun isLocal(value: String?): Boolean = value == token
}
