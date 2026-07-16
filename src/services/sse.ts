import { FastifyRequest, FastifyReply } from 'fastify';
import { EventBus } from './eventBus';
import { randomUUID } from 'crypto';

interface SSEClient {
  id: string;
  reply: FastifyReply;
}

class SSEService {
  private clients: Map<string, SSEClient> = new Map();

  constructor() {
    // Broadcast all events to all connected clients
    EventBus.subscribe('*', (payload: any) => {
      this.broadcast(payload);
    });
  }

  public handleConnection(request: FastifyRequest, reply: FastifyReply) {
    const clientId = randomUUID();

    // Set headers for SSE
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    this.clients.set(clientId, { id: clientId, reply });
    
    // Send initial connection event
    this.sendToClient(reply, { type: 'CONNECTED', clientId });

    // Handle client disconnect
    request.raw.on('close', () => {
      this.clients.delete(clientId);
    });
  }

  private broadcast(data: any) {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients.values()) {
      client.reply.raw.write(payload);
    }
  }

  private sendToClient(reply: FastifyReply, data: any) {
    reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

export const sseService = new SSEService();
