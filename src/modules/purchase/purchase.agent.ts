import { Injectable, OnEvent } from '@nitrostack/core';
import { InventoryRequest, InventoryResponse } from '../inventory/inventory.types.js';
import { QueueService } from '../../services/queue.service.js';
import { PurchaseAgentRequest, PurchaseRecommendation } from './purchase.types.js';
import { PurchaseRequestService } from './purchase-request.service.js';
import { ScoringService } from './scoring.service.js';
import { SupplierService } from './supplier.service.js';

@Injectable({ deps: [SupplierService, ScoringService, PurchaseRequestService, QueueService] })
export class PurchaseAgent {
  constructor(
    private readonly supplierService: SupplierService,
    private readonly scoringService: ScoringService,
    private readonly purchaseRequests: PurchaseRequestService,
    private readonly queue: QueueService,
  ) {}

  @OnEvent('agent.purchase.part_request')
  async handleInventoryPartRequest(event: { payload: { request: InventoryRequest; inventory: InventoryResponse; ticket?: unknown } }): Promise<void> {
    const { request, inventory, ticket } = event.payload;
    await this.recommendPurchase({
      partId: inventory.item?.partId ?? request.partId,
      partName: inventory.item?.partName ?? request.partName ?? request.partId ?? 'Unknown Part',
      inventoryId: inventory.item?.inventoryId,
      requestedQuantity: Math.max(request.quantity, inventory.item?.reorderLevel ?? request.quantity),
      urgency: request.urgency,
      requestReason: inventory.decision === 'out_of_stock' ? 'Out of Stock' : 'Low Stock - Below Reorder Level',
      unitCostGbp: inventory.item?.unitCostGbp,
      ticketId: request.ticketId,
      machineId: request.machineId,
    }, ticket);
  }

  async recommendPurchase(request: PurchaseAgentRequest, ticket?: unknown): Promise<PurchaseRecommendation> {
    const suppliers = this.supplierService.findSuppliersForPart(request.partName);
    if (suppliers.length === 0) {
      throw new Error(`No active suppliers found for ${request.partName}`);
    }

    const rankedSuppliers = this.scoringService.rankSuppliers({
      suppliers,
      urgency: request.urgency,
      requestedQuantity: request.requestedQuantity,
      unitCostGbp: request.unitCostGbp,
    });
    const selectedSupplier = rankedSuppliers[0];
    const purchaseRequest = this.purchaseRequests.createRequest({
      requestDate: new Date().toISOString(),
      inventoryId: request.inventoryId ?? '',
      partId: request.partId ?? '',
      partName: request.partName,
      supplierId: selectedSupplier.supplier.supplierId,
      supplierName: selectedSupplier.supplier.supplierName,
      requestedQuantity: selectedSupplier.recommendedQuantity,
      unitCostGbp: selectedSupplier.estimatedUnitCostGbp,
      totalCostGbp: selectedSupplier.estimatedTotalCostGbp,
      urgencyLevel: request.urgency,
      requestReason: request.requestReason,
      expectedDeliveryDate: selectedSupplier.expectedDeliveryDate,
      approvalStatus: 'Pending',
      purchaseStatus: 'Requested',
      requestedBy: 'Purchase Agent',
      approvedBy: 'Manager',
    });

    const recommendation: PurchaseRecommendation = {
      purchaseRequest,
      rankedSuppliers,
      selectedSupplier,
      message: `Recommended ${selectedSupplier.supplier.supplierName} for ${request.partName}: ${selectedSupplier.rationale}`,
    };

    await this.queue.publish({
      from: 'purchase',
      to: 'production',
      type: 'purchase_delay_estimate',
      payload: {
        recommendation,
        ticket,
        expectedDelayDays: selectedSupplier.supplier.averageLeadTimeDays,
      },
    });
    await this.queue.publish({
      from: 'purchase',
      to: 'manager',
      type: 'purchase_recommendation',
      payload: {
        recommendation,
        ticket,
      },
    });

    return recommendation;
  }
}
