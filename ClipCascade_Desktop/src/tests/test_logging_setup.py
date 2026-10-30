import logging
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from core.application import Application


class LoggingSetupTests(unittest.TestCase):
    def test_existing_root_handler_does_not_disable_persistent_diagnostics(self):
        root = logging.getLogger()
        previous_handlers, previous_level = root.handlers[:], root.level
        with TemporaryDirectory() as directory:
            path = Path(directory) / 'clipcascade_log.log'
            path.write_text('previous diagnostic\n', encoding='utf-8')
            application = Application.__new__(Application)
            application.log_file_path = str(path)
            try:
                root.handlers = [logging.NullHandler()]
                application.setup_logging()
                logging.warning('clipboard acquisition pending')
                for handler in root.handlers:
                    handler.flush()
                contents = path.read_text(encoding='utf-8')
                self.assertIn('previous diagnostic', contents)
                self.assertIn('clipboard acquisition pending', contents)
                self.assertEqual(root.handlers[0].maxBytes, 512 * 1024)
                self.assertEqual(root.handlers[0].backupCount, 2)
            finally:
                for handler in root.handlers:
                    handler.close()
                root.handlers = previous_handlers
                root.setLevel(previous_level)
