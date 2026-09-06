import type { WebSocket} from "ws"

export class ConnectionManager {
    private clients = new Set<WebSocket>();

    add(ws: WebSocket): void{
        this.clients.add(ws)
    }

    remove(ws: WebSocket): void{
        this.clients.delete(ws)
    }

    get size(): number{
        return this.clients.size
    }

    forEach(fn: (ws: WebSocket)=> void): void{
        this.clients.forEach(fn)
    }
}