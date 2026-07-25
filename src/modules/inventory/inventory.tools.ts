import { ControllerDecorator as Controller, ExecutionContext, ToolDecorator as Tool, z } from '@nitrostack/core';
import { InventoryAgent } from './inventory.agent.js';
import { InventoryCsvService } from './inventory-csv.service.js';

const inventoryRequestSchema = z.object({
  partId: z.string().optional().describe('Inventory part ID, for example P001'),
  partName: z.string().optional().describe('Human part name, for example Bearing X45'),
  quantity: z.number().int().positive().default(1),
  ticketId: z.string().describe('Maintenance ticket ID requesting this part'),
  machineId: z.string().describe('Machine requiring this part'),
  urgency: z.enum(['Low', 'Medium', 'High', 'Critical']).default('Medium'),
  requestedBy: z.string().optional(),
});

@Controller('inventory')
export class InventoryTools {
  constructor(
    private readonly inventoryAgent: InventoryAgent,
    private readonly inventoryCsv: InventoryCsvService,
  ) {}

  @Tool({
    name: 'check_inventory',
    description: 'Check and reserve spare-part inventory for a maintenance ticket. In-stock requests go to Production; low/out-of-stock requests go to Purchase.',
    inputSchema: inventoryRequestSchema,
  })
  async checkInventory(input: z.infer<typeof inventoryRequestSchema>, ctx: ExecutionContext) {
    const result = await this.inventoryAgent.checkInventory(input);
    ctx.logger.info(`Inventory check for ${input.partId ?? input.partName}: ${result.decision}`);
    return result;
  }

  @Tool({
    name: 'list_items',
    description: 'List inventory items loaded from data/inventory_FIXED.csv.',
    inputSchema: z.object({}),
  })
  async listItems() {
    return this.inventoryCsv.listItems();
  }

  @Tool({
    name: 'list_reservations',
    description: 'List inventory reservations created during this server run.',
    inputSchema: z.object({
      ticketId: z.string().optional(),
    }),
  })
  async listReservations(input: { ticketId?: string }) {
    return this.inventoryCsv.listReservations(input.ticketId);
  }
}
