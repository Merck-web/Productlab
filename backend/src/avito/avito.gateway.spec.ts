import { Test, TestingModule } from '@nestjs/testing';
import { AvitoGateway } from './avito.gateway';
import { EventEmitterModule } from '@nestjs/event-emitter';

describe('AvitoGateway', () => {
  let gateway: AvitoGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [AvitoGateway],
    }).compile();

    gateway = module.get<AvitoGateway>(AvitoGateway);
    // Mock the WebSocket server
    gateway.server = {
      emit: jest.fn(),
    } as any;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleNewMessage', () => {
    it('should broadcast message to all clients', () => {
      const message = {
        id: 'msg-1',
        text: 'Привет!',
        author: 'Анжела',
        time: '12:00',
        isOwn: false,
      };

      gateway.handleNewMessage(message);

      expect(gateway.server.emit).toHaveBeenCalledWith('newMessage', message);
    });
  });

  describe('handleStatus', () => {
    it('should broadcast status to all clients', () => {
      const payload = { status: 'connected' };

      gateway.handleStatus(payload);

      expect(gateway.server.emit).toHaveBeenCalledWith('status', payload);
    });
  });

  describe('handleConnection', () => {
    it('should log client connection', () => {
      const mockClient = { id: 'test-client-id' } as any;
      expect(() => gateway.handleConnection(mockClient)).not.toThrow();
    });
  });

  describe('handleDisconnect', () => {
    it('should log client disconnection', () => {
      const mockClient = { id: 'test-client-id' } as any;
      expect(() => gateway.handleDisconnect(mockClient)).not.toThrow();
    });
  });
});
