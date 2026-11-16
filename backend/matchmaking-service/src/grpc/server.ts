import fs from 'fs';
import path from 'path';
import { loadPackageDefinition, Server, ServerCredentials } from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import { createProducer, Topics } from '../lib';

const resolveProtoPath = (fileName: string) => {
  const candidates = [
    process.env.PROTO_ROOT,
    path.resolve(__dirname, '../../protos'),
    path.resolve(__dirname, '../../../protos'),
    path.resolve(__dirname, '../../../../protos'),
    path.resolve(process.cwd(), 'protos'),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const fullPath = path.join(candidate, fileName);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  throw new Error(`Unable to locate proto file "${fileName}". Set PROTO_ROOT or add a protos directory.`);
};

const PROTO_PATH = resolveProtoPath('matchmaking.proto');

const packageDefinition = loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const protoDescriptor = loadPackageDefinition(packageDefinition) as any;
const matchmakingPackage = protoDescriptor.transcendence.matchmaking;

type GrpcCall<Request> = {
  request: Request;
};

type GrpcCallback<Response> = (error: Error | null, response?: Response) => void;

interface UserContext {
  user_id: number;
  username: string;
}

const ensureUserContext = (context: UserContext | undefined) => {
  if (!context || !context.user_id) {
    throw new Error('Missing user context');
  }
  return context;
};

const handlers = {
  async QueueForMatch(
    call: GrpcCall<{ context?: UserContext; mode?: string }>,
    callback: GrpcCallback<any>,
  ) {
    try {
      const context = ensureUserContext(call.request.context);
      const mode = call.request.mode || 'default';

      const producer = await createProducer();
      await producer.send({
        topic: Topics.MatchmakingRequests,
        messages: [
          {
            value: JSON.stringify({
              userId: context.user_id,
              username: context.username,
              mode,
              requestedAt: new Date().toISOString(),
            }),
          },
        ],
      });

      callback(null, { accepted: true, message: 'Queued for matchmaking' });
    } catch (error) {
      callback(error as Error);
    }
  },

  async CancelQueue(call: GrpcCall<{ context?: UserContext }>, callback: GrpcCallback<any>) {
    try {
      const context = ensureUserContext(call.request.context);
      const producer = await createProducer();
      await producer.send({
        topic: Topics.MatchmakingCancelled,
        messages: [
          {
            value: JSON.stringify({
              userId: context.user_id,
              username: context.username,
              cancelledAt: new Date().toISOString(),
            }),
          },
        ],
      });

      callback(null, { accepted: true, message: 'Matchmaking cancelled' });
    } catch (error) {
      callback(error as Error);
    }
  },
};

export const startGrpcServer = async () => {
  const server = new Server();
  server.addService(matchmakingPackage.MatchmakingService.service, handlers);

  const host = process.env.MATCHMAKING_GRPC_HOST || '0.0.0.0';
  const port = Number(process.env.MATCHMAKING_GRPC_PORT || 50055);

  await new Promise<void>((resolve, reject) => {
    server.bindAsync(`${host}:${port}`, ServerCredentials.createInsecure(), (error) => {
      if (error) {
        reject(error);
        return;
      }
      server.start();
      console.log(`Matchmaking gRPC server listening on ${host}:${port}`);
      resolve();
    });
  });

  return server;
};

