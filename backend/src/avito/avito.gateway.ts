import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import type { AvitoMessage } from './avito.service.js';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class AvitoGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(AvitoGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @OnEvent('avito.newMessage')
  handleNewMessage(message: AvitoMessage) {
    this.logger.log(`Broadcasting message: "${message.text.substring(0, 50)}..."`);
    this.server.emit('newMessage', message);
  }

  @OnEvent('avito.status')
  handleStatus(payload: { status: string }) {
    this.logger.log(`Status change: ${payload.status}`);
    this.server.emit('status', payload);
  }
}
