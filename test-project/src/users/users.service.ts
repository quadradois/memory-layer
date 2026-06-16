import { Injectable } from "@nestjs/common";
import { UserRepository } from "./user.repository";

@Injectable()
export class UsersService {
  constructor(private repo: UserRepository) {}

  async findByEmail(email: string) {
    return this.repo.findOne({ email });
  }

  async create(data: { name: string; email: string; password: string }) {
    return this.repo.save(data);
  }
}
