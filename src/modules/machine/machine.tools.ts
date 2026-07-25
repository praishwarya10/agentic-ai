import { ControllerDecorator as Controller, ExecutionContext, ToolDecorator as Tool, z } from '@nitrostack/core';
import { DatabaseService, SensorReading } from '../../services/database.service.js';
import { MachineAgent } from './machine.agent.js';

const readingSchema = z.object({
  machineId: z.string().describe('Factory machine ID, for example M002'),
  timestamp: z.string().optional().describe('ISO timestamp for the reading'),
  airTemperature: z.number().default(0),
  processTemperature: z.number().default(0),
  rpm: z.number().default(0),
  torque: z.number().default(0),
  vibration: z.number().default(0),
  pressure: z.number().default(0),
  humidity: z.number().default(0),
  voltage: z.number().default(0),
  current: z.number().default(0),
  powerConsumption: z.number().default(0),
  toolWear: z.number().default(0),
  operatingHours: z.number().default(0),
});

@Controller('machine')
export class MachineTools {
  constructor(
    private readonly machineAgent: MachineAgent,
    private readonly database: DatabaseService,
  ) {}

  @Tool({
    name: 'predict_failure',
    description: 'Analyze a live machine sensor reading against registry risk and rolling baseline, emitting a maintenance alert on sustained anomalies.',
    inputSchema: readingSchema,
  })
  async predictFailure(input: z.infer<typeof readingSchema>, ctx: ExecutionContext) {
    const result = await this.machineAgent.analyzeReading({
      ...input,
      timestamp: input.timestamp ?? new Date().toISOString(),
    } satisfies SensorReading);
    ctx.logger.info(`Machine analysis complete for ${result.machineId}: ${result.failureProbability}`);
    return result;
  }

  @Tool({
    name: 'get_machine',
    description: 'Read the machine registry record loaded from data/machines_v2_FIXED.csv.',
    inputSchema: z.object({
      machineId: z.string().describe('Factory machine ID, for example M002'),
    }),
  })
  async getMachine(input: { machineId: string }) {
    const machine = this.database.findMachine(input.machineId);
    if (!machine) {
      throw new Error(`Unknown machine: ${input.machineId}`);
    }
    return machine;
  }

  @Tool({
    name: 'list_alerts',
    description: 'List machine-agent alerts generated during this server run.',
    inputSchema: z.object({
      machineId: z.string().optional(),
    }),
  })
  async listAlerts(input: { machineId?: string }) {
    return this.database.listAlerts(input.machineId);
  }
}
