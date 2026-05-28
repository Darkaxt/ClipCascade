import sys
import unittest
from pathlib import Path


SRC_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SRC_DIR))

from core.config import Config  # noqa: E402
from utils.cipher_manager import CipherManager  # noqa: E402


class CipherManagerSyncKeyTest(unittest.TestCase):
    def test_sync_encryption_key_decodes_to_aes_256_key(self):
        key = CipherManager.sync_encryption_key_to_bytes(
            "ccsk_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        )

        self.assertEqual(len(key), 32)

    def test_sync_encryption_key_can_encrypt_without_password_derivation(self):
        config = Config()
        config.data["sync_encryption_key"] = "ccsk_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        config.data["hashed_password"] = CipherManager.sync_encryption_key_to_bytes(
            config.data["sync_encryption_key"]
        )
        cipher_manager = CipherManager(config)

        encrypted = cipher_manager.encrypt("clipboard payload")
        decrypted = cipher_manager.decrypt(
            encrypted["nonce"], encrypted["ciphertext"], encrypted["tag"]
        )

        self.assertEqual(decrypted, "clipboard payload")

    def test_rejects_malformed_sync_encryption_key(self):
        with self.assertRaises(ValueError):
            CipherManager.sync_encryption_key_to_bytes("ccsk_short")


if __name__ == "__main__":
    unittest.main()
