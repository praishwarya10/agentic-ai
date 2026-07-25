import { Injectable } from '@nitrostack/core';

export type PromptName =
  | 'failure_analysis'
  | 'maintenance_planning'
  | 'purchase_recommendation'
  | 'production_optimization'
  | 'manager_summary';

@Injectable()
export class AiService {
  private readonly prompts: Record<PromptName, string> = {
    failure_analysis:
      'Analyze sustained machine sensor anomalies against the machine registry prior. Return likely cause, confidence, urgency, and the evidence.',
    maintenance_planning:
      'Given a failure alert and maintenance history, recommend the required part, repair time, and assigned team.',
    purchase_recommendation:
      'Rank suppliers by delivery time, price, and reliability. Weight delivery more heavily for high urgency.',
    production_optimization:
      'Replan production around degraded or down machines while minimizing priority order delays.',
    manager_summary:
      'Summarize failure, recovery plan, purchase decision, production impact, and next actions for a factory manager.',
  };

  getPrompt(name: PromptName): string {
    return this.prompts[name];
  }
}
