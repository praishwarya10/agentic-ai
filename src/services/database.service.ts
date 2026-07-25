import { Injectable, OnModuleInit } from '@nitrostack/core';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export interface MachineRecord {
  machineId: string;
  machineName: string;
  machineType: string;
  productionLine: string;
  location: string;
  installDate: string;
  operatingHours: number;
  healthScore: number;
  status: string;
  currentState: string;
  simulationMode: string;
  riskLevel: RiskLevel;
  sensorProfile: string;
  failureProfile: string;
  primaryPart: string;
  alternateMachine: string;
  currentJob: string;
  operatorId: string;
  maintenanceTeam: string;
  lastMaintenance: string;
  nextMaintenance: string;
  criticality: RiskLevel;
  factory: string;
}

export interface SensorReading {
  machineId: string;
  timestamp: string;
  airTemperature: number;
  processTemperature: number;
  rpm: number;
  torque: number;
  vibration: number;
  pressure: number;
  humidity: number;
  voltage: number;
  current: number;
  powerConsumption: number;
  toolWear: number;
  operatingHours: number;
  maintenanceRequired?: boolean;
}

export interface MachineAlert {
  alertId: string;
  machineId: string;
  failureProbability: number;
  urgency: RiskLevel;
  likelyCause: string;
  primaryPart: string;
  timestamp: string;
  message: string;
}

export interface MaintenanceLog {
  maintenanceId: string;
  machineId: string;
  telemetryId: string;
  maintenanceDate: string;
  issueDetected: string;
  issueSeverity: RiskLevel;
  maintenanceType: string;
  maintenanceStatus: string;
  assignedTeam: string;
  assignedTechnician: string;
  requiredPart: string;
  inventoryStatus: string;
  estimatedRepairHours: number;
  maintenanceCostGbp: number;
  productionImpact: string;
  rootCause: string;
  nextMaintenanceDate: string;
  remarks: string;
  createdBy: string;
}

export interface TechnicianAssignment {
  technicianId: string;
  team: string;
  availability: 'Available' | 'Busy';
}

export interface MaintenanceTicket {
  ticketId: string;
  machineId: string;
  machineName: string;
  likelyCause: string;
  requiredPart: string;
  estimatedRepairHours: number;
  assignedTeam: string;
  assignedTechnician: string;
  urgency: RiskLevel;
  status: 'Created' | 'Assigned' | 'In Progress' | 'Completed';
  createdAt: string;
  sourceAlertId: string;
  historyMatches: number;
  notes: string[];
}

export interface SparePartRequest {
  requestId: string;
  ticketId: string;
  machineId: string;
  partId: string;
  partName: string;
  urgency: RiskLevel;
  quantity: number;
  requestedBy: string;
  requestedAt: string;
}

const SENSOR_KEYS = [
  'airTemperature',
  'processTemperature',
  'rpm',
  'torque',
  'vibration',
  'pressure',
  'humidity',
  'voltage',
  'current',
  'powerConsumption',
  'toolWear',
  'operatingHours',
] as const;

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly machines = new Map<string, MachineRecord>();
  private readonly sensorData: SensorReading[] = [];
  private readonly alerts: MachineAlert[] = [];
  private readonly maintenanceLogs: MaintenanceLog[] = [];
  private readonly maintenanceTickets: MaintenanceTicket[] = [];
  private readonly sparePartRequests: SparePartRequest[] = [];
  private readonly dataDir = resolve(process.env.FACTORYBRAIN_DATA_DIR ?? join(process.cwd(), 'data'));

  async onModuleInit(): Promise<void> {
    this.loadMachines();
    this.loadMaintenanceLogs();
    this.loadSensorData();
  }

  findMachine(machineId: string): MachineRecord | undefined {
    return this.machines.get(machineId);
  }

  listMachines(): MachineRecord[] {
    return [...this.machines.values()];
  }

  getRecentReadings(machineId: string, limit = 20): SensorReading[] {
    return this.sensorData
      .filter((reading) => reading.machineId === machineId)
      .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp))
      .slice(-limit);
  }

  saveSensorReading(reading: SensorReading): SensorReading {
    this.sensorData.push(reading);
    return reading;
  }

  saveAlert(alert: MachineAlert): MachineAlert {
    this.alerts.push(alert);
    return alert;
  }

  listAlerts(machineId?: string): MachineAlert[] {
    return machineId ? this.alerts.filter((alert) => alert.machineId === machineId) : [...this.alerts];
  }

  getMaintenanceHistory(machineId: string, requiredPart?: string, issueDetected?: string): MaintenanceLog[] {
    return this.maintenanceLogs
      .filter((log) => log.machineId === machineId || log.requiredPart === requiredPart || log.issueDetected === issueDetected)
      .sort((left, right) => Date.parse(right.maintenanceDate) - Date.parse(left.maintenanceDate));
  }

  listMaintenanceLogs(): MaintenanceLog[] {
    return [...this.maintenanceLogs];
  }

  listTechnicians(team: string): TechnicianAssignment[] {
    const activeStatuses = new Set(['Assigned', 'In Progress']);
    const technicianIds = new Set(
      this.maintenanceLogs
        .filter((log) => log.assignedTeam === team)
        .map((log) => log.assignedTechnician)
        .filter(Boolean),
    );

    if (technicianIds.size === 0) {
      technicianIds.add(`${team.replace(/\W+/g, '').toUpperCase()}-TECH-01`);
    }

    return [...technicianIds].map((technicianId) => ({
      technicianId,
      team,
      availability: this.isTechnicianBusy(technicianId, activeStatuses) ? 'Busy' : 'Available',
    }));
  }

  saveMaintenanceTicket(ticket: MaintenanceTicket): MaintenanceTicket {
    this.maintenanceTickets.push(ticket);
    return ticket;
  }

  listMaintenanceTickets(machineId?: string): MaintenanceTicket[] {
    return machineId
      ? this.maintenanceTickets.filter((ticket) => ticket.machineId === machineId)
      : [...this.maintenanceTickets];
  }

  saveSparePartRequest(request: SparePartRequest): SparePartRequest {
    this.sparePartRequests.push(request);
    return request;
  }

  listSparePartRequests(ticketId?: string): SparePartRequest[] {
    return ticketId
      ? this.sparePartRequests.filter((request) => request.ticketId === ticketId)
      : [...this.sparePartRequests];
  }

  getHealthyBaseline(machineId: string): Record<(typeof SENSOR_KEYS)[number], { mean: number; stdDev: number }> | undefined {
    const healthyRows = this.sensorData
      .filter((reading) => reading.machineId === machineId && !reading.maintenanceRequired)
      .slice(0, 200);

    if (healthyRows.length < 5) {
      return undefined;
    }

    return Object.fromEntries(
      SENSOR_KEYS.map((key) => {
        const values = healthyRows.map((row) => row[key]).filter(Number.isFinite);
        const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
        const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
        return [key, { mean, stdDev: Math.max(Math.sqrt(variance), 0.0001) }];
      }),
    ) as Record<(typeof SENSOR_KEYS)[number], { mean: number; stdDev: number }>;
  }

  private loadMachines(): void {
    const filePath = join(this.dataDir, 'machines_v2_FIXED.csv');
    if (!existsSync(filePath)) {
      throw new Error(`Machine registry not found at ${filePath}`);
    }

    for (const row of parseCsv(readFileSync(filePath, 'utf8'))) {
      const machine = toMachineRecord(row);
      this.machines.set(machine.machineId, machine);
    }
  }

  private loadSensorData(): void {
    const candidates = ['sensor_data_realistic_FIXED.csv', 'sensor_data_realistic.csv'];
    const filePath = candidates.map((name) => join(this.dataDir, name)).find(existsSync);
    if (!filePath || looksLikeZip(filePath)) {
      return;
    }

    for (const row of parseCsv(readFileSync(filePath, 'utf8'))) {
      const reading = toSensorReading(row);
      if (reading.machineId) {
        this.sensorData.push(reading);
      }
    }
  }

  private loadMaintenanceLogs(): void {
    const filePath = join(this.dataDir, 'maintenance_logs_FIXED.csv');
    if (!existsSync(filePath)) {
      return;
    }

    for (const row of parseCsv(readFileSync(filePath, 'utf8'))) {
      const log = toMaintenanceLog(row);
      if (log.maintenanceId) {
        this.maintenanceLogs.push(log);
      }
    }
  }

  private isTechnicianBusy(technicianId: string, activeStatuses: Set<string>): boolean {
    return this.maintenanceLogs.some(
      (log) => log.assignedTechnician === technicianId && activeStatuses.has(log.maintenanceStatus),
    );
  }
}

function toMachineRecord(row: Record<string, string>): MachineRecord {
  return {
    machineId: row.machineId,
    machineName: row.machineName,
    machineType: row.machineType,
    productionLine: row.productionLine,
    location: row.location,
    installDate: row.installDate,
    operatingHours: toNumber(row.operatingHours),
    healthScore: toNumber(row.healthScore),
    status: row.status,
    currentState: row.currentState,
    simulationMode: row.simulationMode,
    riskLevel: normalizeRisk(row.riskLevel),
    sensorProfile: row.sensorProfile,
    failureProfile: row.failureProfile,
    primaryPart: row.primaryPart,
    alternateMachine: row.alternateMachine,
    currentJob: row.currentJob,
    operatorId: row.operatorId,
    maintenanceTeam: row.maintenanceTeam,
    lastMaintenance: row.lastMaintenance,
    nextMaintenance: row.nextMaintenance,
    criticality: normalizeRisk(row.criticality),
    factory: row.factory,
  };
}

function toSensorReading(row: Record<string, string>): SensorReading {
  return {
    machineId: row.machineId ?? row.machine_id ?? row.id ?? '',
    timestamp: row.timestamp ?? row.time ?? new Date().toISOString(),
    airTemperature: toNumber(row.airTemperature ?? row.air_temperature ?? row.airTemp),
    processTemperature: toNumber(row.processTemperature ?? row.process_temperature ?? row.processTemp),
    rpm: toNumber(row.rpm ?? row.rotationalSpeed),
    torque: toNumber(row.torque),
    vibration: toNumber(row.vibration),
    pressure: toNumber(row.pressure),
    humidity: toNumber(row.humidity),
    voltage: toNumber(row.voltage),
    current: toNumber(row.current),
    powerConsumption: toNumber(row.powerConsumption ?? row.power_consumption),
    toolWear: toNumber(row.toolWear ?? row.tool_wear),
    operatingHours: toNumber(row.operatingHours ?? row.operating_hours),
    maintenanceRequired: parseBoolean(row.maintenanceRequired ?? row.maintenance_required),
  };
}

function toMaintenanceLog(row: Record<string, string>): MaintenanceLog {
  return {
    maintenanceId: row.maintenanceId,
    machineId: row.machineId,
    telemetryId: row.telemetryId,
    maintenanceDate: row.maintenanceDate,
    issueDetected: row.issueDetected,
    issueSeverity: normalizeRisk(row.issueSeverity),
    maintenanceType: row.maintenanceType,
    maintenanceStatus: row.maintenanceStatus,
    assignedTeam: row.assignedTeam,
    assignedTechnician: row.assignedTechnician,
    requiredPart: row.requiredPart,
    inventoryStatus: row.inventoryStatus,
    estimatedRepairHours: toNumber(row.estimatedRepairHours),
    maintenanceCostGbp: toNumber(row.maintenanceCost_GBP),
    productionImpact: row.productionImpact,
    rootCause: row.rootCause,
    nextMaintenanceDate: row.nextMaintenanceDate,
    remarks: row.remarks,
    createdBy: row.createdBy,
  };
}

function parseCsv(source: string): Record<string, string>[] {
  const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim().length > 0);
  const [headerLine, ...dataLines] = lines;
  if (!headerLine) {
    return [];
  }

  const headers = splitCsvLine(headerLine);
  return dataLines.map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells;
}

function normalizeRisk(value: string | undefined): RiskLevel {
  if (value === 'Critical' || value === 'High' || value === 'Medium' || value === 'Low') {
    return value;
  }
  return 'Medium';
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined;
  }
  return ['true', '1', 'yes', 'y'].includes(value.toLowerCase());
}

function toNumber(value: string | number | undefined): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function looksLikeZip(filePath: string): boolean {
  const signature = readFileSync(filePath).subarray(0, 2).toString('utf8');
  return signature === 'PK';
}

export function getProjectRootFromSource(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../..');
}
