import { Kafka, KafkaConfig, Producer, logLevel } from 'kafkajs';

let kafkaInstance: Kafka | null = null;
let sharedProducer: Producer | null = null;

const createKafkaConfig = (): KafkaConfig => {
  const brokers = process.env.KAFKA_BROKERS?.split(',')
    .map((b) => b.trim())
    .filter(Boolean);

  if (!brokers || brokers.length === 0) {
    throw new Error('KAFKA_BROKERS env variable must be provided for Kafka messaging');
  }

  return {
    clientId: process.env.KAFKA_CLIENT_ID || 'transcendence-api-gateway',
    brokers,
    logLevel: logLevel.NOTHING,
  };
};

const getKafka = (): Kafka => {
  if (!kafkaInstance) {
    kafkaInstance = new Kafka(createKafkaConfig());
  }
  return kafkaInstance;
};

export const getKafkaProducer = async (): Promise<Producer> => {
  if (sharedProducer) {
    return sharedProducer;
  }

  const kafka = getKafka();
  sharedProducer = kafka.producer();
  await sharedProducer.connect();
  return sharedProducer;
};

export const shutdownKafka = async () => {
  if (sharedProducer) {
    await sharedProducer.disconnect();
    sharedProducer = null;
  }
  if (kafkaInstance) {
    await kafkaInstance?.producer().disconnect().catch(() => {});
    kafkaInstance = null;
  }
};
