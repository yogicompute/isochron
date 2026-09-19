import type {SyncSample} from "./timesync.ts"

const round = (n: number) => Math.round(n * 1000) / 1000

export class ClockEstimator {
    private minRtt = Infinity
    private offsetEwma = 0
    private rttEwma = 0
    private jitterEwma = 0
    private inited = false

    constructor(private readonly alpha = 0.2) {}

    add({rtt, offset}: SyncSample): void{
        if(rtt < this.minRtt) this.minRtt = rtt
        if(!this.inited){
            this.offsetEwma = offset
            this.rttEwma = rtt
            this.inited = true
            return
        }

        const prevRtt = this.rttEwma;
        this.offsetEwma = this.alpha * offset + (1 - this.alpha) * this.offsetEwma
        this.rttEwma = this.alpha * rtt + (1 - this.alpha) * this.rttEwma
        this.jitterEwma = this.alpha * Math.abs(rtt - prevRtt) + (1 - this.alpha) * this.jitterEwma
    }

    get offset(): number { return this.offsetEwma}
    get ready(): boolean { return this.inited}
    // on way delay
    get owd(): number { return this.minRtt === Infinity ? 0 : this.minRtt / 2}

    snapshot() {
        return {
            minRtt: this.minRtt === Infinity ? null : round(this.minRtt),
            rtt: round(this.rttEwma),
            offset: round(this.offsetEwma),
            owd: round(this.owd),
            jitter: round(this.jitterEwma)
        }
    }
}