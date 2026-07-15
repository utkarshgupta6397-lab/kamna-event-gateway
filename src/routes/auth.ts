import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export const authRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post('/login', async (request, reply) => {
    const { username, password } = request.body as Record<string, string>;

    const expectedUsername = env.GATEWAY_BASIC_USERNAME;
    const expectedPassword = env.GATEWAY_BASIC_PASSWORD;

    // Deny if credentials are not configured in environment
    if (!expectedUsername || !expectedPassword) {
      return reply.status(401).send({
        success: false,
        message: 'Invalid username or password.'
      });
    }

    if (username === expectedUsername && password === expectedPassword) {
      const token = jwt.sign(
        { user: username },
        env.GATEWAY_JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      return reply.send({ token });
    }

    return reply.status(401).send({
      success: false,
      message: 'Invalid username or password.'
    });
  });
};
