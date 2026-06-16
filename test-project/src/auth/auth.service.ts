import { Injectable } from "@nestjs/common";
import { JwtService } from "./jwt.strategy";
import { UsersService } from "../users/users.service";

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private usersService: UsersService
  ) {}

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    return this.jwtService.sign({ id: user.id });
  }

  async validate(token: string) {
    return this.jwtService.verify(token);
  }
}
