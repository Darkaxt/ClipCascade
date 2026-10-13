"""Read server-side P2S health without touching any client's clipboard."""

import argparse
import json
from pathlib import Path
import ssl
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import build_opener, HTTPSHandler, HTTPRedirectHandler, Request


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--server-url', required=True)
    parser.add_argument('--key-file', required=True)
    parser.add_argument('--probe', action='store_true', help='Issue silent probes before reading status')
    args = parser.parse_args()
    url = args.server_url.rstrip('/')
    parsed = urlsplit(url)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path:
        parser.error('server-url must be an HTTPS origin without credentials or a path')
    try:
        key = Path(args.key_file).read_text(encoding='utf-8-sig').strip()
        if not key.startswith('cck_') or any(char.isspace() for char in key):
            raise ValueError('invalid key file')
        opener = build_opener(HTTPSHandler(context=ssl.create_default_context()), NoRedirect())

        def request(path, method='GET'):
            req = Request(url + path, data=b'' if method == 'POST' else None,
                          headers={'X-ClipCascade-Api-Key': key}, method=method)
            # Diagnostic HTTP boundary only; expiry never restarts a client.
            with opener.open(req, timeout=10) as response:
                return json.load(response)

        if args.probe:
            request('/api/client-health/probes', 'POST')
        status = request('/api/client-health')
        fields = ('sessionId', 'clientId', 'clientName', 'platform', 'version',
                  'status', 'probeId', 'probedAt', 'acknowledgedAt',
                  'clipboardDetectedAt', 'clipboardType')
        print(json.dumps({'mode': status.get('mode'), 'supported': status.get('supported'),
                          'connections': [{field: row.get(field) for field in fields}
                                          for row in status.get('connections', [])]}, indent=2))
        return 0
    except HTTPError as error:
        print(json.dumps({'error': 'health API request rejected', 'httpStatus': error.code}), file=sys.stderr)
    except (OSError, URLError, ValueError, TypeError):
        print(json.dumps({'error': 'health audit unavailable; verify key file, network and server'}), file=sys.stderr)
    return 1


if __name__ == '__main__':
    sys.exit(main())
