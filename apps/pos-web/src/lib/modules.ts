export type BusinessType =
  | 'grocery'
  | 'cafe'
  | 'pharmacy'
  | 'auto_parts'
  | 'retail';

export interface ModuleConfig {
  scale: boolean;
  barcode: boolean;
  bulk_weight: boolean;
  waste_tracking: boolean;
  tables: boolean;
  kds: boolean;
  modifiers: boolean;
  batch_tracking: boolean;
  expiry_dates: boolean;
  prescription: boolean;
  oem_search: boolean;
  vehicle_compat: boolean;
  multi_warehouse: boolean;
}

const DEFAULTS: Record<BusinessType, Partial<ModuleConfig>> = {
  grocery: {
    scale: true,
    barcode: true,
    bulk_weight: true,
    waste_tracking: true,
  },
  cafe: {
    tables: true,
    kds: true,
    modifiers: true,
    waste_tracking: true,
  },
  pharmacy: {
    barcode: true,
    batch_tracking: true,
    expiry_dates: true,
    prescription: true,
  },
  auto_parts: {
    oem_search: true,
    vehicle_compat: true,
    multi_warehouse: true,
    barcode: true,
  },
  retail: {
    barcode: true,
    waste_tracking: true,
  },
};

const BASE: ModuleConfig = {
  scale: false,
  barcode: false,
  bulk_weight: false,
  waste_tracking: false,
  tables: false,
  kds: false,
  modifiers: false,
  batch_tracking: false,
  expiry_dates: false,
  prescription: false,
  oem_search: false,
  vehicle_compat: false,
  multi_warehouse: false,
};

export function getModules(
  businessType: BusinessType,
  featureFlags: Partial<ModuleConfig> = {},
): ModuleConfig {
  return {
    ...BASE,
    ...DEFAULTS[businessType],
    ...featureFlags,
  };
}
