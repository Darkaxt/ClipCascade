import contextlib
import io
import json
import sys
import unittest
from unittest.mock import Mock, patch
from urllib.error import HTTPError

import audit_client_health


class AuditClientHealthTests(unittest.TestCase):
    def test_probe_then_read_filters_private_fields(self):
        opener = Mock()
        opener.open.side_effect = [io.StringIO('{}'), io.StringIO(json.dumps({
            'mode': 'P2S', 'supported': True, 'connections': [{
                'status': 'acknowledged', 'clipboardType': 'text', 'payload': 'never print',
            }],
        }))]
        output = io.StringIO()
        with patch.object(sys, 'argv', ['audit', '--server-url', 'https://server.test', '--key-file', 'private.key', '--probe']), \
                patch.object(audit_client_health.Path, 'read_text', return_value='cck_private'), \
                patch.object(audit_client_health, 'build_opener', return_value=opener), contextlib.redirect_stdout(output):
            self.assertEqual(audit_client_health.main(), 0)
        self.assertEqual([call.args[0].method for call in opener.open.call_args_list], ['POST', 'GET'])
        self.assertEqual(json.loads(output.getvalue())['connections'][0]['status'], 'acknowledged')
        self.assertNotIn('never print', output.getvalue())
        self.assertNotIn('cck_private', output.getvalue())

    def test_refused_key_is_reported_without_response_body_or_secret(self):
        opener = Mock()
        opener.open.side_effect = HTTPError('https://server.test', 403, 'secret response', {}, None)
        output = io.StringIO()
        with patch.object(sys, 'argv', ['audit', '--server-url', 'https://server.test', '--key-file', 'private.key']), \
                patch.object(audit_client_health.Path, 'read_text', return_value='cck_private'), \
                patch.object(audit_client_health, 'build_opener', return_value=opener), contextlib.redirect_stderr(output):
            self.assertEqual(audit_client_health.main(), 1)
        self.assertEqual(json.loads(output.getvalue())['httpStatus'], 403)
        self.assertNotIn('secret response', output.getvalue())
        self.assertNotIn('cck_private', output.getvalue())

    def test_redirect_is_never_followed_with_management_credentials(self):
        self.assertIsNone(audit_client_health.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://other.test'))


if __name__ == '__main__':
    unittest.main()
