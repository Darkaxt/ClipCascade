import unittest

from core.constants import is_version_greater


class VersionCheckTests(unittest.TestCase):
    def test_remote_base_version_is_not_newer_than_fork_revision(self):
        self.assertFalse(is_version_greater("3.2.0", "3.2.0.5"))

    def test_remote_higher_fork_revision_is_newer(self):
        self.assertTrue(is_version_greater("3.2.0.6", "3.2.0.5"))

    def test_missing_segments_compare_as_zero(self):
        self.assertFalse(is_version_greater("3.2.0.0", "3.2.0"))


if __name__ == "__main__":
    unittest.main()
