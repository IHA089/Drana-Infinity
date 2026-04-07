import asyncio
import time
import socketio
import mitmproxy.http
import mitmproxy.tcp
from mitmproxy import ctx
from mitmproxy.options import Options
from mitmproxy.tools.dump import DumpMaster
from mitmproxy.connection import Client, Server


MAIN_SERVER = "http://127.0.0.1:80"
sio = socketio.Client()


class DranaInterceptorAddon:
    def __init__(self, loop):
        self.loop = loop
        self._silent_replay = {}

        while True:
            try:
                sio.connect(MAIN_SERVER)
                print("[Proxy] Connected to Main Server")
                break
            except Exception:
                print("[Proxy] Waiting for Main Server...")
                time.sleep(2)

        sio.on("trigger_replay_in_engine", self.handle_replay)
        sio.on("silent_replay_request_engine", self.handle_silent_replay)


    def extract_project_uuid(self, request):
        project_uuid = None

        if not request:
            return "uncategorized"

        ua = request.headers.get("User-Agent", "")
        if "DranaProject/" in ua:
            try:
                parts = ua.split("DranaProject/")
                if len(parts) > 1:
                    project_uuid = parts[1].split(" ")[0].strip()
            except:
                pass

        if not project_uuid:
            project_uuid = request.headers.get("X-Drana-Project")

        return project_uuid or "uncategorized"

    def handle_replay(self, data):
        asyncio.run_coroutine_threadsafe(
            self.safe_replay(data),
            self.loop
        )


    async def safe_replay(self, data):
        try:
            await asyncio.wait_for(
                self.replay_from_raw(
                    raw_text=data.get("new_request", ""),
                    flow_type=data.get("type", "http"),
                    flow_id=data.get("flow_id")
                ),
                timeout=10
            )
        except Exception as e:
            sio.emit("resend_response_update", {
                "flow_id": data.get("flow_id"),
                "error": True,
                "message": str(e),
                "done": True
            })


    async def replay_from_raw(self, raw_text, flow_type, flow_id):
        if not raw_text.strip():
            return

        if flow_type.lower() == "tcp":
            sio.emit("resend_response_update", {
                "status": "TCP",
                "headers": "TCP replay not supported statelessly",
                "content": raw_text
            })
            return

        self.replay_http_https(raw_text, flow_id)

    def replay_http_https(self, raw_text, flow_id):
        lines = raw_text.splitlines()
        method, path, _ = lines[0].split(" ", 2)

        headers = {}
        body = b""
        in_body = False

        for line in lines[1:]:
            if line.strip() == "":
                in_body = True
                continue
            if in_body:
                body += line.encode() + b"\n"
            else:
                if ":" in line:
                    k, v = line.split(":", 1)
                    headers[k.strip()] = v.strip()

        host = headers.get("Host")
        if not host:
            raise Exception("Replay failed: Host header missing")

        scheme = "https" if headers.get(":scheme") == "https" else "http"
        port = 443 if scheme == "https" else 80

        if ":" in host:
            host, port = host.split(":", 1)
            port = int(port)

        req = mitmproxy.http.Request.make(
            method=method,
            url=f"{scheme}://{host}{path}",
            headers=headers,
            content=body,
        )

        client = Client(peername=("127.0.0.1", 0), sockname=("127.0.0.1", 0))
        server = Server(address=(host, port))

        flow = mitmproxy.http.HTTPFlow(client, server)


        flow.request = req
        flow.metadata["drana_replay_ui_id"] = flow_id

        ctx.master.commands.call("replay.client", [flow])
        print(f"[Proxy] Replayed {method} {host}{path}")

    def _build_replay_flow(self, raw_text):
        lines = raw_text.splitlines()
        method, path, _ = lines[0].split(" ", 2)

        headers = {}
        body = b""
        in_body = False

        for line in lines[1:]:
            if line.strip() == "" and not in_body:
                in_body = True
                continue
            if in_body:
                body += line.encode() + b"\n"
            elif ":" in line:
                k, v = line.split(":", 1)
                headers[k.strip()] = v.strip()

        host = headers.get("Host")
        if not host:
            raise Exception("Host header missing")

        scheme = "https" if headers.get(":scheme") == "https" else "http"
        port = 443 if scheme == "https" else 80

        if ":" in host:
            host, port = host.split(":", 1)
            port = int(port)

        req = mitmproxy.http.Request.make(
            method=method,
            url=f"{scheme}://{host}{path}",
            headers=headers,
            content=body,
        )

        client = mitmproxy.connection.Client(
            peername=("127.0.0.1", 0),
            sockname=("127.0.0.1", 0)
        )
        server = mitmproxy.connection.Server(address=(host, port))

        flow = mitmproxy.http.HTTPFlow(client, server)
        flow.request = req
        return flow


    def process_flow(self, flow, type_label, override_id=None):
        request = flow.request if hasattr(flow, "request") else None
        response = flow.response if hasattr(flow, "response") else None

        project_uuid = self.extract_project_uuid(request)

        if request and "Drana-Katana-Crawler" in request.headers.get("User-Agent", ""):
            fetch_dest = request.headers.get("Sec-Fetch-Dest")
            if fetch_dest and fetch_dest != "document":
                return

        summary = {
            "time": time.strftime("%H:%M:%S"),
            "scheme": type_label,
            "method": request.method if request else type_label,
            "host": request.host if request else "Unknown",
            "path": request.path if request else "",
            "status": response.status_code if response else 0,
            "content_type": response.headers.get("Content-Type", "").split(";")[0] if response else "-",
            "size": f"{len(response.content)}B" if response and response.content else "0B",
            "time_taken": "0ms"
        }

        req_raw = ""
        if request:
            host_header = f"Host: {request.host}\n" if "Host" not in request.headers else ""
            req_raw = (
                f"{request.method} {request.path} HTTP/{request.http_version}\n"
                f"{host_header}"
                + "\n".join(f"{k}: {v}" for k, v in request.headers.items())
                + "\n\n"
                + request.get_text(strict=False)
            )

        res_raw = ""
        if response:
            res_raw = (
                f"HTTP/{request.http_version} {response.status_code}\n"
                + "\n".join(f"{k}: {v}" for k, v in response.headers.items())
                + "\n\n"
                + response.get_text(strict=False)
            )

        final_id = override_id if override_id else flow.id
        event_type = "update_request_data" if override_id else "new_request_data"

        sio.emit(event_type, {
            "id": final_id,
            "project_id": project_uuid,
            "type": type_label.lower(),
            "summary": summary,
            "full_data": {
                "request_raw_text": req_raw,
                "response_raw_text": res_raw
            }
        })

    def response(self, flow: mitmproxy.http.HTTPFlow):
        if flow.metadata.get("__silent_replay__"):
            fut = self._silent_replay.get(flow.id)
            if fut and not fut.done():

                raw_response = (
                    f"HTTP/{flow.response.http_version} {flow.response.status_code}\n"
                    + "\n".join(f"{k}: {v}" for k, v in flow.response.headers.items())
                    + "\n\n"
                    + flow.response.get_text(strict=False)
                )

                fut.set_result({
                    "status": flow.response.status_code,
                    "body": raw_response
                })
            return
        elif flow.metadata.get("drana_replay_ui_id"):
            self.process_flow(
                flow,
                "HTTPS" if flow.request.scheme == "https" else "HTTP",
                override_id=flow.metadata["drana_replay_ui_id"]
            )

            sio.emit("resend_response_update", {
                "flow_id": flow.metadata["drana_replay_ui_id"],
                "status": flow.response.status_code,
                "headers": "\n".join(f"{k}: {v}" for k, v in flow.response.headers.items()),
                "content": flow.response.get_text(strict=False),
                "done": True
            })
            return

        self.process_flow(
            flow,
            "HTTPS" if flow.request.scheme == "https" else "HTTP"
        )

    def tcp_message(self, flow: mitmproxy.tcp.TCPFlow):
        sio.emit("new_request_data", {
            "id": flow.id,
            "project_id": "uncategorized",
            "type": "tcp",
            "summary": {
                "time": time.strftime("%H:%M:%S"),
                "scheme": "TCP",
                "method": "TCP",
                "host": "Unknown",
                "path": "",
                "status": "-",
                "content_type": "-",
                "size": "0B",
                "time_taken": "0ms"
            },
            "full_data": {
                "request_raw_text": flow.messages[-1].content.decode("utf-8", "replace"),
                "response_raw_text": ""
            }
        })

    def handle_silent_replay(self, data):
        asyncio.run_coroutine_threadsafe(
            self._handle_silent_replay(data),
            self.loop
        )

    async def _handle_silent_replay(self, data):
        request_id = data.get("id")
        raw_request = data.get("raw_request")

        if not raw_request:
            sio.emit("silent_replay_response_engine", {
                "id": request_id,
                "error": "Empty raw_request"
            })
            return

        try:
            result = await self.silent_replay(raw_request)
            sio.emit("silent_replay_response_engine", {
                "id": request_id,
                "result": result
            })
        except Exception as e:
            sio.emit("silent_replay_response_engine", {
                "id": request_id,
                "error": str(e)
            })


    async def silent_replay(self, raw_request: str, timeout=10):
        flow = self._build_replay_flow(raw_request)
        flow.metadata["__silent_replay__"] = True

        fut = self.loop.create_future()
        self._silent_replay[flow.id] = fut

        ctx.master.commands.call("replay.client", [flow])

        try:
            return await asyncio.wait_for(fut, timeout)
        finally:
            self._silent_replay.pop(flow.id, None)


if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    opts = Options(
        listen_host="127.0.0.1",
        listen_port=8080,
        http2=True,
        ssl_insecure=True
    )

    master = DumpMaster(opts, loop=loop, with_termlog=False)
    master.options.flow_detail = 0
    master.addons.add(DranaInterceptorAddon(loop))

    print("[Proxy] Drana Interceptor running on 127.0.0.1:8080 (HTTP / HTTPS / HTTP2)")
    try:
        loop.run_until_complete(master.run())
    except KeyboardInterrupt:
        master.shutdown()
