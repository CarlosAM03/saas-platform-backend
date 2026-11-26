"""Expose the versioned offline Service fixture over a synthetic TLS endpoint."""

import uvicorn
from scripts import proxy_fixture


run = uvicorn.run


def run_tls(app, **options):
    return run(
        app,
        **options,
        ssl_certfile="/fixture/tls/cert.pem",
        ssl_keyfile="/fixture/tls/key.pem",
    )


uvicorn.run = run_tls
proxy_fixture.main()
