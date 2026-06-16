export class UserRepository {
  private store: any[] = [];

  async findOne(filter: Record<string, any>) {
    return this.store.find(item =>
      Object.entries(filter).every(([k, v]) => item[k] === v)
    );
  }

  async save(data: any) {
    this.store.push(data);
    return data;
  }
}
