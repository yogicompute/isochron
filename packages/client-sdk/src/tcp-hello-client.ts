import net from "node:net"
import { DEFAULT_TCP_PORT} from "@isochron/protocol"

const socket = net.createConnection(
    {port: DEFAULT_TCP_PORT, host: "127.0.0.1"}, 
    ()=>{
        console.log(`[client] connected, sending hello`)
        socket.write("hello")
    }
)

socket.on("data", (chunk)=>{
    console.log(`[client] recv: ${chunk.toString("utf-8").trimEnd()}`)
    socket.end()
})

socket.on("close", ()=>console.log(`[client] client connection closed`))

socket.on("error", (err)=>console.log(`[client] error: ${err.message}`))