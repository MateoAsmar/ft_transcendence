import fs from 'fs';
import path from 'path';
import { credentials, loadPackageDefinition } from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';

const loaderOptions = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};

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

  throw new Error(
    `Unable to locate proto file "${fileName}". Set PROTO_ROOT or ensure a protos directory is available.`,
  );
};

export const insecureCredentials = credentials.createInsecure();

export const loadProto = (fileName: string) => {
  const protoPath = resolveProtoPath(fileName);
  const packageDefinition = loadSync(protoPath, loaderOptions);
  return loadPackageDefinition(packageDefinition);
};
