import { ControllerDecorator as Controller, ExecutionContext, ToolDecorator as Tool, z } from '@nitrostack/core';
import { PurchaseAgent } from './purchase.agent.js';
import { PurchaseRequestService } from './purchase-request.service.js';
import { SupplierService } from './supplier.service.js';

const purchaseRequestSchema = z.object({
  partId: z.string().optional(),
  partName: z.string().describe('Part name to purchase, for example Bearing X45'),
  inventoryId: z.string().optional(),
  requestedQuantity: z.number().int().positive().default(1),
  urgency: z.enum(['Low', 'Medium', 'High', 'Critical']).default('Medium'),
  requestReason: z.string().default('Low Stock - Below Reorder Level'),
  unitCostGbp: z.number().positive().optional(),
  ticketId: z.string().optional(),
  machineId: z.string().optional(),
});

@Controller('purchase')
export class PurchaseTools {
  constructor(
    private readonly purchaseAgent: PurchaseAgent,
    private readonly supplierService: SupplierService,
    private readonly purchaseRequests: PurchaseRequestService,
  ) {}

  @Tool({
    name: 'find_suppliers',
    description: 'Find active suppliers that can provide a requested spare part.',
    inputSchema: z.object({
      partName: z.string(),
    }),
  })
  async findSuppliers(input: { partName: string }) {
    return this.supplierService.findSuppliersForPart(input.partName);
  }

  @Tool({
    name: 'recommend_purchase',
    description: 'Rank suppliers using urgency-aware scoring, create a purchase request, and hand off delivery estimate to Production plus recommendation to Manager.',
    inputSchema: purchaseRequestSchema,
  })
  async recommendPurchase(input: z.infer<typeof purchaseRequestSchema>, ctx: ExecutionContext) {
    const recommendation = await this.purchaseAgent.recommendPurchase(input);
    ctx.logger.info(`Purchase recommendation ${recommendation.purchaseRequest.purchaseRequestId} created for ${input.partName}`);
    return recommendation;
  }

  @Tool({
    name: 'list_purchase_requests',
    description: 'List purchase requests loaded from CSV and created during this server run.',
    inputSchema: z.object({}),
  })
  async listPurchaseRequests() {
    return this.purchaseRequests.listRequests();
  }
}
