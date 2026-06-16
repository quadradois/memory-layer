import { BairroService } from '../services/bairro.service';

export class BairroController {
  constructor(private service: BairroService) {}

  async calcularTaxa(req: any, res: any) {
    const { bairroId, distanciaKm } = req.body;
    const result = await this.service.calcularTaxaEntrega(bairroId, distanciaKm);
    res.json(result);
  }
}
