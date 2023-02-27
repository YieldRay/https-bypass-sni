import tryFetch from "./src/fetch";
import { resolve } from "./src/resolve";
import { writeFileSync } from "node:fs";

tryFetch(
    {
        timeout: 10000,
        resolver: (domain) => resolve(domain, "https://d-o-h.v6.rocks/dns-query"),
    },
    "https://i.pximg.net/img-original/img/2023/01/25/00/03/22/104786411_p0.jpg",
    {
        headers: {
            Referer: "https://www.pixiv.net/",
            "User-Agent": "PixivIOSApp/6.7.1 (iOS 10.3.1; iPhone8,1)",
        },
    }
)
    .then((res) => res.arrayBuffer())
    .then(Buffer.from)
    .then((buf) => writeFileSync("./104786411_p0.jpg", buf));
