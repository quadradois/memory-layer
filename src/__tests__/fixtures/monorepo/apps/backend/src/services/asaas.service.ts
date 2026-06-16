import { Injectable } from '@nestjs/common';
import { SharedUtil } from '@rancho-delivery/shared';

@Injectable()
export class AsaasService {
  async cobrar(clienteId: string, valor: number) { }
  async estornar(pagamentoId: string) { }
  async consultarBoleto(codigo: string) { }
}
