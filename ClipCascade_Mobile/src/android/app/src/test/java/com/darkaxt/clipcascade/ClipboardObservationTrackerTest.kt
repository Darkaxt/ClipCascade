package com.darkaxt.clipcascade

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ClipboardObservationTrackerTest {
    @Test fun freshCopyOfIdenticalTextIsObservedButPollingIsNotACopy() {
        val tracker = ClipboardObservationTracker()
        tracker.seed("text:example", 100)
        assertFalse(tracker.observe("text:example", 100))
        assertTrue(tracker.observe("text:example", 200))
        assertFalse(tracker.observe("text:example", 200))
        assertTrue(tracker.observe("text:different", 200))
        assertFalse(tracker.observe(null, 0))
        assertTrue(tracker.observe("text:different", 200))
    }
}
