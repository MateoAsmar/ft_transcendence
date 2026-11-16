import { Kafka, KafkaConfig, Producer, Consumer, logLevel } from 'kafkajs';

let kafkaInstance: Kafka | null = null;
let producerInstance: Producer | null = null;

const createKafkaConfig = (): KafkaConfig => {
  const brokers = process.env.KAFKA_BROKERS?.split(',')
    .map((b) => b.trim())
    .filter(Boolean);

  if (!brokers || brokers.length === 0) {
    throw new Error('KAFKA_BROKERS env variable must be provided for Kafka messaging');
  }

  return {
    clientId: process.env.KAFKA_CLIENT_ID || 'transcendence-game-session-service',
    brokers,
    logLevel: logLevel.NOTHING,
  };
};

export const getKafka = (): Kafka => {
  if (!kafkaInstance) {
    kafkaInstance = new Kafka(createKafkaConfig());
  }
  return kafkaInstance;
};

export const createProducer = async (): Promise<Producer> => {
  if (producerInstance) {
    return producerInstance;
  }

  const kafka = getKafka();
  producerInstance = kafka.producer();
  await producerInstance.connect();
  return producerInstance;
};

export const createConsumer = async (groupId: string): Promise<Consumer> => {
  const kafka = getKafka();
  const consumer = kafka.consumer({ 
    groupId,
    retry: {
      retries: 10,
      initialRetryTime: 300,
      multiplier: 2,
    }
  });
  await consumer.connect();
  return consumer;
};

