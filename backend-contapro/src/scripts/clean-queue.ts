import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config.js';

const QUEUE_NAME = 'email-scanner';

async function main() {
  if (!config.redisUrl) {
      console.error('No REDIS_URL found');
      process.exit(1);
  }
  
  // Create a dedicated connection for the script
  const connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

  console.log(`Cleaning queue ${QUEUE_NAME}...`);
  const queue = new Queue(QUEUE_NAME, { connection });
  
  // Clean old jobs
  await queue.clean(0, 0, 'completed');
  await queue.clean(0, 0, 'failed');
  await queue.clean(0, 0, 'delayed');
  
  // Remove repeatable jobs
  const repeatableJobs = await queue.getRepeatableJobs();
  console.log(`Found ${repeatableJobs.length} repeatable jobs.`);
  
  for (const job of repeatableJobs) {
      console.log(`Removing repeatable job: ${job.key}`);
      await queue.removeRepeatableByKey(job.key);
  }
  
  console.log('Queue cleaned. Restart the server to re-register the 5-second job.');
  
  await queue.close();
  await connection.quit();
}

main().catch(console.error);