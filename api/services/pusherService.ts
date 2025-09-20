import 'dotenv/config';
import Pusher from 'pusher';

const {
  PUSHER_APP_ID,
  PUSHER_KEY,
  PUSHER_SECRET,
  PUSHER_CLUSTER,
} = process.env;

if (!PUSHER_APP_ID || !PUSHER_KEY || !PUSHER_SECRET || !PUSHER_CLUSTER) {
  console.warn(
    'Pusher environment variables not set. Real-time features will be disabled.'
  );
}

class PusherService {
  private pusher: Pusher | null = null;

  constructor() {
    if (PUSHER_APP_ID && PUSHER_KEY && PUSHER_SECRET && PUSHER_CLUSTER) {
      this.pusher = new Pusher({
        appId: PUSHER_APP_ID,
        key: PUSHER_KEY,
        secret: PUSHER_SECRET,
        cluster: PUSHER_CLUSTER,
        useTLS: true,
      });
    }
  }

  async trigger(channel: string, event: string, data: any) {
    if (!this.pusher) {
      // Silently fail if Pusher is not configured
      return;
    }
    try {
      await this.pusher.trigger(channel, event, data);
    } catch (error) {
      console.error('Pusher trigger error:', error);
    }
  }
}

export const pusherService = new PusherService();
