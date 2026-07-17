/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyRequest, FastifyReply } from 'fastify';
import { EventBus } from './eventBus';
import { randomUUID } from 'crypto';

interface SSEClient {
  id: string;
  reply: FastifyReply;
}

class SSEService {
  private clients: Map<string, SSEClient> = new Map();
  private lastBroadcastTime: Date | null = null;
  private totalEventsSent = 0;

  constructor() {
    // Broadcast all events to all connected clients
    EventBus.subscribe('*', (payload: unknown) => {
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
    this.lastBroadcastTime = new Date();
    this.totalEventsSent++;
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients.values()) {
      client.reply.raw.write(payload);
    }
  }

  public getDiagnostics() {
    return {
      connected: this.clients.size > 0,
      connectedClients: this.clients.size,
      lastBroadcastTime: this.lastBroadcastTime,
      totalEventsSent: this.totalEventsSent,
      heartbeat: 'Not Implemented',
      currentQueueSize: 0,
    };
  }

  private sendToClient(reply: FastifyReply, data: any) {
    reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

export const sseService = new SSEService();
