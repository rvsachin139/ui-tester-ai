import {
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
})
export class EventsGateway {
  @WebSocketServer()
  server: Server;

  emitToClient(clientId: string, event: string, data: unknown) {
    this.server.to(clientId).emit(event, data);
  }

  emitToAll(event: string, data: unknown) {
    this.server.emit(event, data);
  }

  emitToAllExcept(clientId: string, event: string, data: unknown) {
    this.server.except(clientId).emit(event, data);
  }
}
