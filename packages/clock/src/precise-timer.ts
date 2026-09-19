import {now} from "./now.js"

const SPIN_MS = 3

export function scheduleAt(targetMs: number, cb: ()=> void): void{
    const fire = ()=> {
        while(now() < targetMs) { /* spin */ }
        cb()
    }

    const delay = targetMs - now() - SPIN_MS;
    if(delay <= 0) fire()
    else setTimeout(fire, delay)
}