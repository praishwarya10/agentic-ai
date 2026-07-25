import { ControllerDecorator as Controller, ExecutionContext, ToolDecorator as Tool, z } from '@nitrostack/core';
import { DatabaseService, MachineAlert } from '../../services/database.service.js';
import { MaintenanceAgent } from './maintenance.agent.js';

const alertSchema = z.object({
  alertId: z.string().describe('Machine Agent alert ID'),
  machineId: z.string().describe('Machine ID from the registry'),
  failureProbability: z.number().min(0).max(1),
  urgency: z.enum(['Low', 'Medium', 'High', 'Critical']),
  likelyCause: z.string().describe('Failure cause diagnosed by the Machine Agent'),
  primaryPart: z.string().describe('Part suggested by the Machine Agent'),
  timestamp: z.string(),
  message: z.string().default(''),
});

@Controller('maintenance')
export class MaintenanceTools {
  constructor(
    private readonly maintenanceAgent: MaintenanceAgent,
    private readonly database: DatabaseService,
  ) {}

  @Tool({
    name: 'create_maintenance_ticket',
    description: 'Create a maintenance ticket from a Machine Agent alert using maintenance history, machine registry part/team, and technician availability. Does not diagnose failures.',
    inputSchema: alertSchema,
  })
  async createMaintenanceTicket(input: z.infer<typeof alertSchema>, ctx: ExecutionContext) {
    const plan = await this.maintenanceAgent.createMaintenanceTicket(input satisfies MachineAlert);
    ctx.logger.info(`Maintenance ticket ${plan.ticket.ticketId} created for ${plan.ticket.machineId}`);
    return plan;
  }

  @Tool({
    name: 'get_history',
    description: 'Look up historical maintenance records for a machine, optional part, and optional issue.',
    inputSchema: z.object({
      machineId: z.string(),
      requiredPart: z.string().optional(),
      issueDetected: z.string().optional(),
    }),
  })
  async getHistory(input: { machineId: string; requiredPart?: string; issueDetected?: string }) {
    return this.database.getMaintenanceHistory(input.machineId, input.requiredPart, input.issueDetected);
  }

  @Tool({
    name: 'list_tickets',
    description: 'List maintenance tickets created during this server run.',
    inputSchema: z.object({
      machineId: z.string().optional(),
    }),
  })
  async listTickets(input: { machineId?: string }) {
    return this.database.listMaintenanceTickets(input.machineId);
  }

}
