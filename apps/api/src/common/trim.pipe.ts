import { PipeTransform, Injectable, ArgumentMetadata, Logger } from "@nestjs/common";

@Injectable()
export class TrimPipe<T> implements PipeTransform {
    transform(value: T, metadata: ArgumentMetadata): T {
        if ( typeof value === "string" ) {
            return value.trim() as unknown as T;
        }
        if ( value && typeof value === "object" && !Array.isArray(value) ) {
            for (const key in value) {
                if ((value).hasOwnProperty(key) && typeof value[key] === "string" ) {
                    ( value[key] as string ) = ((value)[key] as string).trim();
                }
            }
        }
        
        return value as unknown as T;
    }
}