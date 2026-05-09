import { EventEmitter } from 'events';
import { getRedis } from './redis.js';

const localEmitter = new EventEmitter();
// Aumentar límite de listeners si hay muchos usuarios simultáneos en fallback
localEmitter.setMaxListeners(1000);

export async function publishEvent(userId: string, eventData: any) {
  const channel = `user:${userId}:events`;
  const message = JSON.stringify(eventData);
  
  const redis = getRedis();
  if (redis) {
    try {
      await redis.publish(channel, message);
    } catch (e) {
      console.error('Failed to publish to Redis:', e);
      localEmitter.emit(channel, message); // Fallback if redis fails
    }
  } else {
    localEmitter.emit(channel, message);
  }
}

export function subscribeToUserEvents(userId: string, callback: (msg: string) => void) {
  const channel = `user:${userId}:events`;
  const redis = getRedis();
  
  if (redis) {
    const subscriber = redis.duplicate();
    subscriber.subscribe(channel).catch(console.error);
    
    subscriber.on('message', (ch, msg) => {
      if (ch === channel) callback(msg);
    });
    
    return () => {
      subscriber.unsubscribe().catch(() => {});
      subscriber.quit().catch(() => {});
    };
  } else {
    const listener = (msg: string) => callback(msg);
    localEmitter.on(channel, listener);
    
    return () => {
      localEmitter.off(channel, listener);
    };
  }
}
