export interface SyncSample {
    rtt: number;
    offset: number;
}

// t1 - client clocktime(send)
// t2 - server clocktime(recieve)

// t3 - server clocktime(send)
// t4 - client clocktime(recieve)

//offset = how far the server clock leads the client clock
// serverTime = clientTime + offset and
// clientTime = serverTime - offset

export function computeSync(t1: number, t2: number, t3: number, t4: number): SyncSample {
    const rtt = (t4 - t1) - (t3 - t2);
    const offset = ((t2 - t1) + (t3 - t4)) / 2;
    return { rtt, offset}
}