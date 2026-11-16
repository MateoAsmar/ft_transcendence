import { startGrpcServer } from './grpc/server';

const start = async () => {
  try {
    await startGrpcServer();
    console.log('Profile service started');
  } catch (error) {
    console.error('Failed to start profile service', error);
    process.exit(1);
  }
};

start();

