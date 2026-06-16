import { EvolutionService } from './evolution.service';

export class ConversacaoService {
  constructor(private evolution: EvolutionService) {}

  async enviarOptOut(telefone: string) {
    await this.evolution.enviarMensagem(telefone, 'Você não receberá mais mensagens.');
  }

  async processarMensagem(telefone: string, texto: string) {
    if (texto.toLowerCase().includes('sair') || texto.toLowerCase().includes('opt-out')) {
      await this.enviarOptOut(telefone);
    }
  }
}
