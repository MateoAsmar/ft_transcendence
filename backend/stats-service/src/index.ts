import { startGrpcServer } from './grpc/server';

const start = async () => {
  try {
    await startGrpcServer();
    console.log('Stats service started');
  } catch (error) {
    console.error('Failed to start stats service', error);
    process.exit(1);
  }
};

start();

