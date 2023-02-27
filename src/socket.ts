import tls, { ConnectionOptions, TLSSocket } from "node:tls";

export default function createBypassSNISocket(
    options: { host: string; port?: number; servername?: string; fakeServername?: string },
    tlsOptions: ConnectionOptions = {}
): TLSSocket {
    const host = options.host;
    const port = options.port || 443;
    const servername = options.servername || host;
    const fakeServername = options.fakeServername || "www.apple.com.cn";

    const socket = tls.connect(
        {
            host,
            port,
            servername: fakeServername,
            checkServerIdentity: () => undefined,
            ...tlsOptions,
        },
        () => {
            // after socket is established, change servername to correct one
            (socket as TLSSocket & { servername: string }).servername = servername;
        }
    );
    // socket.setDefaultEncoding("utf-8");
    // const logFilePath = "./log/ssl-keys.log";
    // const logFile = fs.createWriteStream(logFilePath, { flags: "a" });
    // socket.on("keylog", (line) => logFile.write(line));
    return socket;
}
