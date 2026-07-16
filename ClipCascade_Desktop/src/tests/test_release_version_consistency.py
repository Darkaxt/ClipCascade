import json
import re
import tomllib
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]


def _read_text(relative_path):
    return (REPO_ROOT / relative_path).read_text(encoding="utf-8")


def _match(pattern, text, label):
    match = re.search(pattern, text, flags=re.MULTILINE)
    if match is None:
        raise AssertionError(f"Could not find {label}")
    return match.group(1)


def _android_version_code(version):
    major, minor, patch, revision = (int(part) for part in version.split("."))
    return major * 1_000_000 + minor * 10_000 + patch * 100 + revision


class ReleaseVersionConsistencyTests(unittest.TestCase):
    def test_all_client_metadata_matches_the_release_version(self):
        versions = json.loads(_read_text("version.json"))
        release_version = versions["windows"]

        self.assertEqual(release_version, versions["android"])

        package = json.loads(_read_text("ClipCascade_Mobile/src/package.json"))
        self.assertEqual(release_version, package["version"].replace("-", "."))

        package_lock = json.loads(
            _read_text("ClipCascade_Mobile/src/package-lock.json")
        )
        self.assertEqual(release_version, package_lock["version"].replace("-", "."))
        self.assertEqual(
            release_version,
            package_lock["packages"][""]["version"].replace("-", "."),
        )

        gradle = _read_text("ClipCascade_Mobile/src/android/app/build.gradle")
        self.assertEqual(
            release_version,
            _match(r'versionName\s+"([^"]+)"', gradle, "Android versionName"),
        )
        self.assertEqual(
            _android_version_code(release_version),
            int(_match(r"versionCode\s+(\d+)", gradle, "Android versionCode")),
        )

        pyproject = tomllib.loads(_read_text("ClipCascade_Desktop/src/pyproject.toml"))
        self.assertEqual(release_version, pyproject["project"]["version"])

        constants = _read_text("ClipCascade_Desktop/src/core/constants.py")
        self.assertEqual(
            release_version,
            _match(
                r'if PLATFORM == WINDOWS:\s+APP_VERSION = "([^"]+)"',
                constants,
                "Windows APP_VERSION",
            ),
        )

        version_info = _read_text("ClipCascade_Desktop/src/version_info.txt")
        self.assertIn(f"FileVersion', '{release_version}'", version_info)
        self.assertIn(f"ProductVersion', '{release_version}'", version_info)

        windows_spec = _read_text("ClipCascade_Desktop/src/ClipCascade_win.spec")
        self.assertIn("version='version_info.txt'", windows_spec)


if __name__ == "__main__":
    unittest.main()
