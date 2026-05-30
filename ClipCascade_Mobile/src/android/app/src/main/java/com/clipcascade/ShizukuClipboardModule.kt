package com.darkaxt.clipcascade

import android.content.ClipData
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.IBinder
import android.os.Parcel
import android.os.UserHandle
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import rikka.shizuku.Shizuku
import rikka.shizuku.ShizukuBinderWrapper
import rikka.shizuku.SystemServiceHelper
import java.lang.reflect.InvocationTargetException
import java.lang.reflect.Method
import java.util.concurrent.atomic.AtomicBoolean

class ShizukuClipboardModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "ShizukuClipboard"
        private const val REQUEST_CODE = 4217
        private const val POLL_INTERVAL_MS = 750L

        private const val STATUS_NOT_AUTHORIZED = "not_authorized"
        private const val STATUS_CONNECTED = "connected"
        private const val STATUS_DISCONNECTED = "disconnected"
        private const val STATUS_UNSUPPORTED = "unsupported"

        private const val ICLIPBOARD_DESCRIPTOR = "android.content.IClipboard"
        private const val TRANSACTION_GET_PRIMARY_CLIP = IBinder.FIRST_CALL_TRANSACTION + 3
        private const val SHELL_PACKAGE = "com.android.shell"
        private const val DEFAULT_DEVICE_ID = 0
    }

    private val listening = AtomicBoolean(false)
    @Volatile private var pollThread: Thread? = null
    @Volatile private var lastSignature: String = ""
    @Volatile private var lastStatus: String = STATUS_DISCONNECTED

    private val binderReceivedListener = Shizuku.OnBinderReceivedListener {
        emitStatusIfChanged(resolveStatus())
    }

    private val binderDeadListener = Shizuku.OnBinderDeadListener {
        emitStatusIfChanged(STATUS_DISCONNECTED)
        stopListeningInternal(joinThread = false)
    }

    private val permissionResultListener =
        Shizuku.OnRequestPermissionResultListener { requestCode, grantResult ->
            if (requestCode == REQUEST_CODE) {
                val status = if (grantResult == PackageManager.PERMISSION_GRANTED) {
                    STATUS_CONNECTED
                } else {
                    STATUS_NOT_AUTHORIZED
                }
                emitStatusIfChanged(status)
            }
        }

    init {
        try {
            Shizuku.addBinderReceivedListenerSticky(binderReceivedListener)
            Shizuku.addBinderDeadListener(binderDeadListener)
            Shizuku.addRequestPermissionResultListener(permissionResultListener)
        } catch (e: Throwable) {
            Log.w(TAG, "Unable to register Shizuku listeners", e)
        }
    }

    override fun getName(): String {
        return "ShizukuClipboard"
    }

    @ReactMethod
    fun getStatus(promise: Promise) {
        promise.resolve(buildStatusMap(resolveStatus()))
    }

    @ReactMethod
    fun requestPermission(promise: Promise) {
        val status = resolveStatus()
        if (status == STATUS_CONNECTED) {
            promise.resolve(buildStatusMap(status))
            return
        }

        if (status != STATUS_NOT_AUTHORIZED) {
            promise.resolve(buildStatusMap(status))
            return
        }

        try {
            Shizuku.requestPermission(REQUEST_CODE)
            val result = buildStatusMap(STATUS_NOT_AUTHORIZED)
            result.putBoolean("requested", true)
            promise.resolve(result)
        } catch (e: Throwable) {
            promise.reject("SHIZUKU_PERMISSION_ERROR", "Unable to request Shizuku permission", e)
        }
    }

    @ReactMethod
    fun startListening(promise: Promise) {
        val status = resolveStatus()
        if (status != STATUS_CONNECTED) {
            val result = buildStatusMap(status)
            result.putBoolean("started", false)
            promise.resolve(result)
            return
        }

        if (listening.getAndSet(true)) {
            val result = buildStatusMap(STATUS_CONNECTED)
            result.putBoolean("started", true)
            promise.resolve(result)
            return
        }

        val initialEvent = try {
            readClipboardEvent()
        } catch (e: Throwable) {
            Log.w(TAG, "Shizuku clipboard backend unsupported during startup", e)
            emitStatusIfChanged(STATUS_UNSUPPORTED)
            val result = buildStatusMap(STATUS_UNSUPPORTED)
            result.putBoolean("started", false)
            promise.resolve(result)
            return
        }

        lastSignature = buildEventSignature(initialEvent)
        lastStatus = STATUS_CONNECTED
        pollThread = Thread {
            pollClipboardLoop()
        }.apply {
            name = "ClipCascade-ShizukuClipboard"
            isDaemon = true
            start()
        }

        val result = buildStatusMap(STATUS_CONNECTED)
        result.putBoolean("started", true)
        promise.resolve(result)
    }

    @ReactMethod
    fun stopListening(promise: Promise) {
        stopListeningInternal()
        promise.resolve(true)
    }

    @ReactMethod
    fun addListener(type: String?) {
        // Required for React Native NativeEventEmitter.
    }

    @ReactMethod
    fun removeListeners(type: Int?) {
        // Required for React Native NativeEventEmitter.
    }

    override fun invalidate() {
        super.invalidate()
        stopListeningInternal()
        try {
            Shizuku.removeBinderReceivedListener(binderReceivedListener)
            Shizuku.removeBinderDeadListener(binderDeadListener)
            Shizuku.removeRequestPermissionResultListener(permissionResultListener)
        } catch (e: Throwable) {
            Log.w(TAG, "Unable to unregister Shizuku listeners", e)
        }
    }

    private fun pollClipboardLoop() {
        while (listening.get()) {
            val status = resolveStatus()
            if (status != STATUS_CONNECTED) {
                emitStatusIfChanged(status)
                stopListeningInternal(joinThread = false)
                return
            }

            try {
                val event = readClipboardEvent()
                if (event != null) {
                    val signature = buildEventSignature(event)
                    if (signature != lastSignature) {
                        lastSignature = signature
                        sendEventToJS("onClipboardChange", event)
                    }
                }
            } catch (e: Throwable) {
                Log.w(TAG, "Shizuku clipboard polling failed", e)
                emitStatusIfChanged(STATUS_UNSUPPORTED)
                stopListeningInternal(joinThread = false)
                return
            }

            try {
                Thread.sleep(POLL_INTERVAL_MS)
            } catch (_: InterruptedException) {
                return
            }
        }
    }

    private fun stopListeningInternal(joinThread: Boolean = true) {
        listening.set(false)
        val thread = pollThread
        if (joinThread && thread != null && thread != Thread.currentThread()) {
            try {
                thread.interrupt()
                thread.join(250)
            } catch (_: InterruptedException) {
                Thread.currentThread().interrupt()
            }
        } else {
            thread?.interrupt()
        }
        pollThread = null
    }

    private fun resolveStatus(): String {
        return try {
            if (!Shizuku.pingBinder()) {
                STATUS_DISCONNECTED
            } else if (Shizuku.checkSelfPermission() != PackageManager.PERMISSION_GRANTED) {
                STATUS_NOT_AUTHORIZED
            } else {
                STATUS_CONNECTED
            }
        } catch (e: SecurityException) {
            STATUS_NOT_AUTHORIZED
        } catch (e: UnsupportedOperationException) {
            STATUS_UNSUPPORTED
        } catch (e: Throwable) {
            STATUS_DISCONNECTED
        }
    }

    private fun buildStatusMap(status: String): WritableMap {
        val result = Arguments.createMap()
        result.putString("status", status)
        try {
            if (Shizuku.pingBinder()) {
                result.putInt("version", Shizuku.getVersion())
                result.putInt("uid", Shizuku.getUid())
            }
        } catch (_: Throwable) {
            // Optional metadata only.
        }
        return result
    }

    private fun readClipboardEvent(): WritableMap? {
        val rawBinder = SystemServiceHelper.getSystemService(Context.CLIPBOARD_SERVICE)
            ?: throw IllegalStateException("Clipboard service unavailable")
        val clip = invokeGetPrimaryClip(rawBinder) ?: return null
        return clipDataToEvent(clip)
    }

    private fun invokeGetPrimaryClip(rawBinder: IBinder): ClipData? {
        val binder = ShizukuBinderWrapper(rawBinder)
        return try {
            invokeGetPrimaryClipViaBinder(binder)
        } catch (binderError: Throwable) {
            Log.w(TAG, "Direct Shizuku clipboard binder call failed; trying reflective fallback", binderError)
            invokeGetPrimaryClipReflectively(binder)
        }
    }

    private fun invokeGetPrimaryClipViaBinder(binder: IBinder): ClipData? {
        val data = Parcel.obtain()
        val reply = Parcel.obtain()
        return try {
            data.writeInterfaceToken(ICLIPBOARD_DESCRIPTOR)
            data.writeString(SHELL_PACKAGE)
            data.writeString(null)
            data.writeInt(currentUserId())
            data.writeInt(DEFAULT_DEVICE_ID)

            if (!binder.transact(TRANSACTION_GET_PRIMARY_CLIP, data, reply, 0)) {
                throw NoSuchMethodException("IClipboard.getPrimaryClip transaction unavailable")
            }
            reply.readException()
            readClipDataFromReply(reply)
        } finally {
            reply.recycle()
            data.recycle()
        }
    }

    private fun readClipDataFromReply(reply: Parcel): ClipData? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            reply.readTypedObject(ClipData.CREATOR)
        } else {
            @Suppress("DEPRECATION")
            if (reply.readInt() != 0) ClipData.CREATOR.createFromParcel(reply) else null
        }
    }

    private fun invokeGetPrimaryClipReflectively(binder: IBinder): ClipData? {
        val stubClass = Class.forName("android.content.IClipboard\$Stub")
        val asInterface = stubClass.getMethod("asInterface", IBinder::class.java)
        val clipboardService = asInterface.invoke(null, binder)
            ?: throw IllegalStateException("Clipboard interface unavailable")
        return invokeGetPrimaryClipReflectively(clipboardService)
    }

    private fun invokeGetPrimaryClipReflectively(clipboardService: Any): ClipData? {
        val clipboardClass = Class.forName("android.content.IClipboard")
        val methods = clipboardMethods(clipboardService, clipboardClass)
            .filter { it.name == "getPrimaryClip" }
            .sortedByDescending { it.parameterTypes.size }
        var lastError: Throwable? = null

        for (method in methods) {
            try {
                method.isAccessible = true
                val args = buildGetPrimaryClipArgs(method.parameterTypes)
                return method.invoke(clipboardService, *args) as? ClipData
            } catch (e: InvocationTargetException) {
                lastError = e.targetException ?: e
            } catch (e: Throwable) {
                lastError = e
            }
        }

        throw lastError ?: NoSuchMethodException("IClipboard.getPrimaryClip")
    }

    private fun clipboardMethods(clipboardService: Any, clipboardClass: Class<*>): List<Method> {
        val allMethods = mutableListOf<Method>()
        allMethods.addAll(clipboardService.javaClass.methods)
        allMethods.addAll(clipboardService.javaClass.declaredMethods)
        allMethods.addAll(clipboardClass.methods)
        allMethods.addAll(clipboardClass.declaredMethods)
        return allMethods.distinctBy { method ->
            method.name + method.parameterTypes.joinToString(prefix = "(", postfix = ")") { it.name }
        }
    }

    private fun buildGetPrimaryClipArgs(parameterTypes: Array<Class<*>>): Array<Any?> {
        var stringIndex = 0
        var intIndex = 0
        return Array(parameterTypes.size) { index ->
            val type = parameterTypes[index]
            when {
                type == String::class.java -> {
                    if (stringIndex++ == 0) {
                        "com.android.shell"
                    } else {
                        null
                    }
                }
                type == Int::class.javaPrimitiveType || type == java.lang.Integer::class.java -> {
                    if (intIndex++ == 0) {
                        currentUserId()
                    } else {
                        0
                    }
                }
                type == Boolean::class.javaPrimitiveType || type == java.lang.Boolean::class.java -> false
                type.name == "android.content.AttributionSource" -> buildAttributionSource()
                else -> null
            }
        }
    }

    private fun buildAttributionSource(): Any? {
        return try {
            val builderClass = Class.forName("android.content.AttributionSource\$Builder")
            val builder = builderClass
                .getConstructor(Int::class.javaPrimitiveType)
                .newInstance(android.os.Process.SHELL_UID)
            builderClass
                .getMethod("setPackageName", String::class.java)
                .invoke(builder, "com.android.shell")
            builderClass.getMethod("build").invoke(builder)
        } catch (e: Throwable) {
            Log.w(TAG, "Unable to build AttributionSource for clipboard call", e)
            null
        }
    }

    private fun clipDataToEvent(clip: ClipData): WritableMap? {
        if (clip.itemCount <= 0) {
            return null
        }

        val description = clip.description
        val mimeTypes = mutableListOf<String>()
        for (i in 0 until description.mimeTypeCount) {
            mimeTypes.add(description.getMimeType(i) ?: "")
        }

        val firstItem = clip.getItemAt(0)
        val text = firstItem.text?.toString()
        if (text != null && (mimeTypes.any { it.startsWith("text/") } || firstItem.uri == null)) {
            return buildClipboardEvent("text", text)
        }

        val uris = mutableListOf<String>()
        for (i in 0 until clip.itemCount) {
            clip.getItemAt(i).uri?.let { uri ->
                uris.add(uri.toString())
            }
        }

        if (uris.isEmpty()) {
            return null
        }

        val type = if (
            uris.size == 1 &&
            mimeTypes.any { it.startsWith("image/") }
        ) {
            "image"
        } else {
            "files"
        }
        return buildClipboardEvent(type, uris.joinToString(","))
    }

    private fun buildClipboardEvent(type: String, content: String): WritableMap {
        val params = Arguments.createMap()
        params.putString("content", content)
        params.putString("type", type)
        params.putString("backend", "shizuku")
        return params
    }

    private fun buildEventSignature(event: WritableMap?): String {
        if (event == null) {
            return ""
        }
        return "${event.getString("type")}:${event.getString("content")}"
    }

    private fun currentUserId(): Int {
        return try {
            val method = UserHandle::class.java.getDeclaredMethod("myUserId")
            method.isAccessible = true
            method.invoke(null) as Int
        } catch (_: Throwable) {
            0
        }
    }

    private fun emitStatusIfChanged(status: String) {
        if (status == lastStatus) {
            return
        }
        lastStatus = status
        val params = Arguments.createMap()
        params.putString("status", status)
        sendEventToJS("onShizukuStatusChange", params)
    }

    private fun sendEventToJS(eventName: String, params: WritableMap) {
        if (!reactApplicationContext.hasActiveCatalystInstance()) {
            return
        }
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }
}
