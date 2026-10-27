"""Test-only host: actual FastAPI/JobService/CallbackClient, controlled EnginePort.
No Google Maps, production flags, invented Service endpoints or implementation patches.
"""
import asyncio
import json
import os
import socket
import sys
import threading
import time

import uvicorn
from prospector_engine import CancellationRequested, CancellationToken
from prospector_service.config import Settings
from prospector_service.errors import EngineCancelled, EngineExecutionError
from prospector_service.main import create_app
from prospector_service.schemas import BusinessResult


class ControlledEngine:
    def probe(self):
        return True

    def new_token(self):
        return CancellationToken()

    def execute(self, query, token):
        if query.keyword == "slow":
            for _ in range(40):
                time.sleep(0.025)
                try:
                    token.raise_if_cancelled()
                except CancellationRequested:
                    raise EngineCancelled() from None
        if query.keyword == "fail":
            raise EngineExecutionError("ENGINE_EXTRACTION_FAILED")
        if query.keyword == "empty":
            return ()
        count = query.limit + 1 if query.keyword == "too-many" else 1
        return tuple(BusinessResult(name="Controlled Cafe", source="google_maps", phone="00123", metadata=None, sourceIdentifier=None) for _ in range(count))


settings = Settings(
    app_env="test", internal_api_key=os.environ["MVP_SERVICE_KEY"],
    callback_api_key=os.environ["MVP_CALLBACK_KEY"],
    platform_callback_origin=os.environ["MVP_BACKEND_ORIGIN"], allow_local_callbacks=True,
    callback_max_attempts=1, callback_timeout=1, callback_backoff=0, shutdown_grace_seconds=0.2,
)
app = create_app(settings, engine=ControlledEngine())


@app.middleware("http")
async def fault_injection(request, call_next):
    # Delays only the HTTP acknowledgement; all actual Service lifecycle/callback code runs.
    response = await call_next(request)
    if request.method == "POST" and request.url.path == "/api/v1/prospecting/jobs":
        if os.environ.get("MVP_DELAY_ACCEPTANCE") == "true":
            await asyncio.sleep(0.35)
        elif os.environ.get("MVP_CALLBACK_BEFORE_ACCEPTANCE") == "true":
            await request.app.state.jobs.queue.join()
    return response


sock = socket.socket()
sock.bind(("127.0.0.1", 0))
server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=0, log_level="warning", access_log=False))


def stop_from_stdin():
    for line in sys.stdin:
        if line.strip() == "stop":
            server.should_exit = True
            return


threading.Thread(target=stop_from_stdin, daemon=True).start()
print(json.dumps({"port": sock.getsockname()[1]}), flush=True)
server.run(sockets=[sock])
