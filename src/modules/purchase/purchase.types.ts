export type PurchaseUrgency = 'Low' | 'Medium' | 'High' | 'Critical';

export type SupplierStatus = 'Preferred' | 'Active' | 'Inactive';

export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected';

export type PurchaseStatus = 'Requested' | 'Ordered' | 'Cancelled';

export interface Supplier {
  supplierId: string;
  supplierName: string;
  supplierCategory: string;
  contactPerson: string;
  email: string;
  phoneNumber: string;
  city: string;
  country: string;
  suppliedParts: string[];
  averageLeadTimeDays: number;
  minimumOrderQuantity: number;
  supplierRating: number;
  onTimeDeliveryRate: number;
  paymentTerms: string;
  supplierStatus: SupplierStatus;
  lastOrderDate: string;
}

export interface SupplierScore {
  supplier: Supplier;
  rank: number;
  score: number;
  priceScore: number;
  deliveryScore: number;
  reliabilityScore: number;
  statusScore: number;
  estimatedUnitCostGbp: number;
  recommendedQuantity: number;
  estimatedTotalCostGbp: number;
  expectedDeliveryDate: string;
  rationale: string;
}

export interface PurchaseAgentRequest {
  partId?: string;
  partName: string;
  inventoryId?: string;
  requestedQuantity: number;
  urgency: PurchaseUrgency;
  requestReason: string;
  unitCostGbp?: number;
  ticketId?: string;
  machineId?: string;
}

export interface PurchaseRequestRecord {
  purchaseRequestId: string;
  requestDate: string;
  inventoryId: string;
  partId: string;
  partName: string;
  supplierId: string;
  supplierName: string;
  requestedQuantity: number;
  unitCostGbp: number;
  totalCostGbp: number;
  urgencyLevel: PurchaseUrgency;
  requestReason: string;
  expectedDeliveryDate: string;
  approvalStatus: ApprovalStatus;
  purchaseStatus: PurchaseStatus;
  requestedBy: string;
  approvedBy: string;
}

export interface PurchaseRecommendation {
  purchaseRequest: PurchaseRequestRecord;
  rankedSuppliers: SupplierScore[];
  selectedSupplier: SupplierScore;
  message: string;
}
