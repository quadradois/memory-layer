import { Injectable } from "@nestjs/common";

export interface JwtPayload {
  id: string;
  email?: string;
}

@Injectable()
export class JwtService {
  sign(payload: JwtPayload): string {
    return "signed-token";
  }

  verify(token: string): JwtPayload {
    return { id: "123" };
  }
}
