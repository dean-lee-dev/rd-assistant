import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export type JwtUser = {
    userId: number;
    username: string;
}
export const CurrentUser = createParamDecorator(
    (data: keyof JwtUser | undefined, ctx: ExecutionContext): JwtUser[keyof JwtUser] | JwtUser => {
        const request = ctx.switchToHttp().getRequest();
        const user = request.user;
        return data ? user?.[data] : user;
    }
)