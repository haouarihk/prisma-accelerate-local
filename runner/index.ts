import { createServer } from "../src"

// sometimes bun takes a while to exit
process.on("SIGINT", () => {
    process.exit(0);
});

const server = createServer({
    datasourceUrl: process.env.DATABASE_URL,
    secret: process.env.DATA_PROXY_URL?.split("?api_key=")?.[1] || process.env.SECRET,
    https: process.env.CERT && process.env.KEY ? {
        cert: process.env.CERT,
        key: process.env.KEY,
    } : undefined,
})

const k = await server.listen({
    port: Number(process.env.PORT) || undefined,
    host: process.env.HOST || "0.0.0.0",
    // path: process.env.LISTEN_PATH || "/",
})


console.log(`Server is running on ${k}`)