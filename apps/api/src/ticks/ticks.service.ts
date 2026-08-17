import { Injectable } from "@nestjs/common";


@Injectable()
export class TicksService {

    async *stream(n: number): AsyncGenerator<{ type: 'tick', i: number, n: number }> {
        for (let i = 1; i <= n; i++) {
            await new Promise(resolve => setTimeout(resolve, 300));
            yield { type: 'tick', i: i, n: n };
        } 
    }
    
}