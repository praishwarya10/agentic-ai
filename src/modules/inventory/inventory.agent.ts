import { Injectable, OnEvent } from '@nitrostack/core';
import { QueueService } from '../../services/queue.service.js';
import { InventoryCsvService } from './inventory-csv.service.js';
import { InventoryRequest, InventoryResponse } from './inventory.types.js';

@Injectable({ deps: [InventoryCsvService, QueueService] })
export class InventoryAgent {
  constructor(
    private readonly inventoryCsv: InventoryCsvService,
    private readonly queue: QueueService,
  ) {}

  @OnEvent('agent.inventory.spare_part_request')
  async handleSparePartRequest(event: { payload: { sparePartRequest: any; ticket: any } }): Promise<void> {
    const { sparePartRequest, ticket } = event.payload;
    await this.checkInventory({
      partId: sparePartRequest.partId,
      partName: sparePartRequest.partName,
      quantity: sparePartRequest.quantity,
      ticketId: sparePartRequest.ticketId,
      machineId: sparePartRequest.machineId,
      urgency: sparePartRequest.urgency,
      requestedBy: sparePartRequest.requestedBy,
    }, ticket);
  }

  async checkInventory(request: InventoryRequest, ticket?: unknown): Promise<InventoryResponse> {
    const lookup = request.partId ?? request.partName;
    if (!lookup) {
      throw new Error('Inventory request must include partId or partName');
    }
    if (request.quantity <= 0) {
      throw new Error('Inventory request quantity must be greater than zero');
    }

    const item = this.inventoryCsv.findItem(lookup);
    if (!item) {
      const response: InventoryResponse = {
        decision: 'out_of_stock',
        requestedQuantity: request.quantity,
        quantityOnHand: 0,
        availableQuantity: 0,
        reorderRequired: true,
        message: `No inventory record found for ${lookup}. Forwarding to Purchase Agent.`,
      };
      await this.forwardToPurchase(request, response, ticket);
      return response;
    }

    if (item.availableQuantity >= request.quantity) {
      const reservation = this.inventoryCsv.reserve(item.partId, {
        reservationId: `RSV-${request.ticketId}-${Date.now()}`,
        quantity: request.quantity,
        ticketId: request.ticketId,
        machineId: request.machineId,
      });
      const updatedItem = this.inventoryCsv.findItem(item.partId) ?? item;
      const reorderRequired = updatedItem.availableQuantity <= updatedItem.reorderLevel;
      const response: InventoryResponse = {
        decision: reorderRequired ? 'low_stock' : 'in_stock',
        item: updatedItem,
        requestedQuantity: request.quantity,
        quantityOnHand: updatedItem.quantityAvailable,
        availableQuantity: updatedItem.availableQuantity,
        warehouseLocation: updatedItem.warehouseLocation,
        reservation,
        reorderRequired,
        message: reorderRequired
          ? `${updatedItem.partName} reserved, but stock is at or below reorder level. Forwarding replenishment to Purchase Agent.`
          : `${updatedItem.partName} reserved from ${updatedItem.warehouseLocation}. Forwarding recovery plan to Production Planning Agent.`,
      };

      if (reorderRequired) {
        await this.forwardToPurchase(request, response, ticket);
      } else {
        await this.forwardToProduction(request, response, ticket);
      }
      return response;
    }

    const pending = this.inventoryCsv.markPendingPurchase(item.partId, {
      reservationId: `PENDING-${request.ticketId}-${Date.now()}`,
      quantity: request.quantity,
      ticketId: request.ticketId,
      machineId: request.machineId,
    });
    const response: InventoryResponse = {
      decision: item.availableQuantity === 0 ? 'out_of_stock' : 'low_stock',
      item: this.inventoryCsv.findItem(item.partId) ?? item,
      requestedQuantity: request.quantity,
      quantityOnHand: item.quantityAvailable,
      availableQuantity: item.availableQuantity,
      warehouseLocation: item.warehouseLocation,
      reservation: pending,
      reorderRequired: true,
      message: `${item.partName} has insufficient stock (${item.availableQuantity} available, ${request.quantity} requested). Forwarding to Purchase Agent.`,
    };
    await this.forwardToPurchase(request, response, ticket);
    return response;
  }

  private async forwardToPurchase(request: InventoryRequest, response: InventoryResponse, ticket?: unknown): Promise<void> {
    await this.queue.publish({
      from: 'inventory',
      to: 'purchase',
      type: 'part_request',
      payload: {
        request,
        inventory: response,
        ticket,
      },
    });
  }

  private async forwardToProduction(request: InventoryRequest, response: InventoryResponse, ticket?: unknown): Promise<void> {
    await this.queue.publish({
      from: 'inventory',
      to: 'production',
      type: 'part_reserved',
      payload: {
        request,
        inventory: response,
        ticket,
      },
    });
  }
}
