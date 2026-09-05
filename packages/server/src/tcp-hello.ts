import net from "node:net"
import { DEFAULT_TCP_PORT, PROTOCOL_VERSION} from "@isochron/protocol"

const server = net.createServer((socket)=>{
    const who = `${socket.remoteAddress} : ${socket.remotePort}`;
    console.log(`[server] client connected: ${who}`)

    socket.on("data", (chunk)=>{
        const text = chunk.toString("utf-8")
        console.log(`[server] recv from ${who} : ${text.trimEnd()}`)
        socket.write(`echo: ${text}`)
    })

    socket.on("close", ()=>console.log(`[server] client disconnected: ${who}`))
    socket.on("error", (err)=>console.log(`[server] socket error: ${err.message}`))
})

server.listen(DEFAULT_TCP_PORT, ()=>{
    console.log(`[server] isochron TCP hello (protocol v${PROTOCOL_VERSION}) listening on port ${DEFAULT_TCP_PORT}`)
})