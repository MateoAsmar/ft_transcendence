import { startGrpcServer } from './grpc/server';

const start = async () => {
  try {
    await startGrpcServer();
    console.log('Friends service started');
  } catch (error) {
    console.error('Failed to start friends service', error);
    process.exit(1);
  }
};

start();

