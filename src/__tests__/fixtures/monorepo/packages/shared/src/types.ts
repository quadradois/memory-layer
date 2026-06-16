export interface ClienteDTO {
  id: string;
  nome: string;
  telefone: string;
}
export interface PedidoDTO {
  id: string;
  clienteId: string;
  total: number;
  status: string;
}
