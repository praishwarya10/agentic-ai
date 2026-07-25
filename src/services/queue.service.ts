import { Injectable, emitEvent } from '@nitrostack/core';

export interface AgentEvent<TPayload = unknown> {
  from: string;
  to: string;
  type: string;
  payload: TPayload;
  timestamp: string;
}

@Injectable()
export class QueueService {
  async publish<TPayload>(event: Omit<AgentEvent<TPayload>, 'timestamp'>): Promise<AgentEvent<TPayload>> {
    const queuedEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    emitEvent(`agent.${event.to}.${event.type}`, queuedEvent);
    return queuedEvent;
  }
}
