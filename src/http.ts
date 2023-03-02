import { METHODS as HTTP_METHODS } from "node:http";
import { ConnectionOptions } from "node:tls";
import createBypassSNISocket from "./socket";

type CanBeBuffer = Parameters<typeof Buffer.from>[0] | Buffer;

export default function httpRequest(
    options: {
        host: string;
        servername?: string;
        port?: number;
        path: string;
        method?: string;
        body?: CanBeBuffer | null;
        headers?: Record<string, string>;
        signal?: AbortSignal | null;
    },
    tlsOptions?: ConnectionOptions
): Promise<{ statusCode: string; statusMessage: string; headers: Record<string, string>; body: Buffer }> {
    const host = options.host;
    const port = options.port;
    const servername = options.servername || host;
    const path = options.path || "/";
    const method = (options.method || "GET").toUpperCase();
    if (!HTTP_METHODS.includes(method)) console.warn(`unknown http method: ${method}`);
    const headers = options.headers || {};
    const body = options.body || "";
    const bodyData = body instanceof Buffer ? body : Buffer.from(body);
    const signal = options.signal;

    const socket = createBypassSNISocket({ host, port, servername }, tlsOptions);
    socket.setKeepAlive(false);

    return new Promise((resolve, reject) => {
        if (signal && signal instanceof AbortSignal) {
            signal.addEventListener("abort", reject, { once: true });
        }

        socket.write(
            Buffer.concat([
                Buffer.from(
                    `${method} ${path} HTTP/1.0` +
                        "\r\n" +
                        Object.entries({
                            Accept: "*/*",
                            ...formatHeaders(headers),
                            Host: servername,
                            Connection: "close",
                            "Accept-Encoding": "identity",
                            "Content-Length": bodyData.length,
                        }).reduce((acc, cur) => (acc += `${cur[0]}: ${cur[1]}\r\n`), "") +
                        "\r\n"
                ),
                bodyData,
            ])
        );
        const chunks: Buffer[] = [];
        socket.on("data", (data) => chunks.push(data));
        socket.on("error", (err) => {
            socket.destroy();
            reject(err);
        });
        socket.on("end", () => {
            const response = fixChunks(chunks);
            socket.destroy();
            resolve(response);
        });
    });
}

function formatHeaders(obj: Record<string, string>) {
    return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [
            k
                .split("-")
                .map((str) => str[0].toUpperCase() + str.slice(1))
                .join("-"),
            v,
        ])
    );
}

function parseHead(headString: string) {
    const headers: Record<string, string> = {};
    const rows = headString.split("\r\n");
    const [httpVersion, statusCode, ...statusMsg] = rows[0].split(" ");
    rows.slice(1).forEach((row) => {
        const [k, ...vs] = row.split(":");
        const v = vs.join(":");
        Reflect.set(headers, k.trim(), v.trim());
    });
    return { headers, httpVersion, statusCode, statusMessage: statusMsg.join(" ") };
}

function fixChunks(chunks: Buffer[]) {
    if (chunks.length === 0) throw new Error("no chunk is read from http response buffer");
    const firstChunk = chunks[0];
    const p = find_0d_0a_0d_0a(firstChunk);
    const headBuffer = firstChunk.subarray(0, p);
    const info = parseHead(headBuffer.toString("utf8"));
    chunks[0] = firstChunk.subarray(p + 4); // remove head part of first chunk
    const body = Buffer.concat(chunks);
    return { ...info, body };
}

function find_0d_0a_0d_0a(buf: Buffer) {
    let i = 0;
    while (i < buf.length) {
        if (buf.subarray(i, i + 4).equals(Buffer.from("\r\n\r\n"))) return i;
        i++;
    }
    return -1;
}
