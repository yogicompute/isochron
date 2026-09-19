import { WebSocket} from "ws"
import type { ClockReport } from "@isochron/protocol"

export interface Client{
    id: string;
    ws: WebSocket;
    report: Omit<ClockReport, "type"> | null;
    isEdge?: boolean;
    region?: string;
}

export class ConnectionManager{
    private clients = new Map<WebSocket, Client>();
    private seq = 0

    add(ws: WebSocket): Client{
        const client: Client = {id : `c${++this.seq}`, ws, report: null}
        
        this.clients.set(ws, client)
        return client
    }

    remove(ws: WebSocket): void{ this.clients.delete(ws) }
    
    get(ws: WebSocket): Client | undefined{ return this.clients.get(ws) }

    get size(): number{ return this.clients.size }

    forEach(fn: (c:Client) => void): void{ this.clients.forEach(fn) }

    list(): Client[]{ return [...this.clients.values()] }
}