import { startGrpcServer } from './grpc/server';

const start = async () => {
  try {
    await startGrpcServer();
    console.log('Matchmaking service started');
  } catch (error) {
    console.error('Failed to start matchmaking service', error);
    process.exit(1);
  }
};

start();

