// Reboni assembly price list — rate paid per unit assembled, keyed by stock code.
// Update rates here when Reboni revises the price list.

// The 6 billable assembly categories from the client's reference billing sheet
// ("Week 26" tab); 'other' covers non-billable items (chairs, R0 entries) that
// don't map to any of those 6 category columns.
export type AssemblyCategory =
  | 'tables'
  | 'combo'
  | 'gradeR'
  | 'readingTables'
  | 'teacherOfficeDesk'
  | 'stationaryFiling'
  | 'other';

export interface AssemblyRateEntry {
  description: string;
  rate: number; // Rand per unit assembled
  category: AssemblyCategory;
}

export interface AssemblyCategoryMeta {
  label: string;         // per-row category column header in the client invoice export
  rate: number;           // per-unit rate for this category
  summaryLabel: string;   // bottom summary-block row wording, matching the reference sheet
}

export const ASSEMBLY_CATEGORY_META: Record<Exclude<AssemblyCategory, 'other'>, AssemblyCategoryMeta> = {
  tables:            { label: 'TABLES',             rate: 2.5, summaryLabel: 'TOTAL AMOUNT FOR TABLES ASSEMBLED @ R2.50 PER TABLE' },
  combo:             { label: 'COMBO',              rate: 10,  summaryLabel: 'TOTAL AMOUNT FOR DOUBLE PRIMARY COMBINATION ASSEMBLED @ R10.00 PER COMBO' },
  gradeR:            { label: 'GR. R',               rate: 2.5, summaryLabel: 'TOTAL AMOUNT FOR GRADE R TABLES ASSEMBLED @ R2.50 PER TABLE' },
  readingTables:     { label: 'READING TABLES',     rate: 3.8, summaryLabel: 'TOTAL AMOUNT FOR READING TABLES ASSEMBLED @ R3.80 PER TABLE' },
  teacherOfficeDesk: { label: 'TEACHER / OFFICE DESK', rate: 46, summaryLabel: 'TOTAL AMOUNT FOR TEACHER / OFFICE DESK UNITS FITTED @ R46.00 PER UNIT' },
  stationaryFiling:  { label: 'STATIONARY / FILING', rate: 46, summaryLabel: 'TOTAL AMOUNT FOR STATIONARY / FILING UNITS FITTED @ R46.00 PER UNIT' },
};

export const ASSEMBLY_RATES: Record<string, AssemblyRateEntry> = {
  // Desks & General
  '3-21-0180': { description: 'Office Desk 1500×850×750 Saligna Top', rate: 46.0, category: 'teacherOfficeDesk' },
  // Bookshelf: not an exact match for either R46 category — treated as storage furniture (stationaryFiling); revisit if Reboni clarifies.
  '3-21-1502': { description: 'Bookshelf 900×300×1500 Single 4 Tier Saligna', rate: 46.0, category: 'stationaryFiling' },
  '3-21-250': { description: "Teacher's Desk 1500×850×750 w 2 Drawers", rate: 46.0, category: 'teacherOfficeDesk' },
  '3-21-2501': { description: 'Office Desk 1500×850×750 2 Drawers Saligna', rate: 46.0, category: 'teacherOfficeDesk' },

  // Chairs — R0 in Reboni's current list; confirm with Reboni before relying on these
  '3-22-01': { description: 'Secondary Chair 450mm - Orange', rate: 0, category: 'other' },
  '3-22-011': { description: 'Secondary Chair 450mm - Blue', rate: 0, category: 'other' },
  '3-22-0130': { description: 'Secondary Chair Polypropylene', rate: 0, category: 'other' },
  '3-22-03': { description: 'Grade R Chair 325mm - Blue', rate: 0, category: 'other' },
  '3-22-031': { description: 'Nursery Chair 325mm Charcoal', rate: 0, category: 'other' },
  '3-22-04': { description: 'Lower Primary Chair 350mm - Blue', rate: 0, category: 'other' },
  '3-22-05': { description: 'Higher Primary Chair 400mm - Red', rate: 0, category: 'other' },
  '3-22-0501': { description: 'Higher Primary Chair Polypropy', rate: 0, category: 'other' },
  '3-23-06': { description: 'Lab Stool 460mm 3 Legged', rate: 0, category: 'other' },
  '3-23-07': { description: 'Lab Stool 690mm 3 Legged', rate: 0, category: 'other' },
  '3-23-1197': { description: 'Atlantis Fully Moulded Chair 430mm', rate: 0, category: 'other' },

  // Tables
  '3-24-04': { description: 'Lower Primary Table 1000×450×575 Saligna', rate: 2.5, category: 'tables' },
  '3-24-05': { description: 'Higher Primary Table 1000×450×650 Saligna', rate: 2.5, category: 'tables' },
  '3-25-07': { description: 'Secondary Table 550×450×750 Saligna', rate: 2.5, category: 'tables' },
  '3-25-075': { description: 'Single Sec Table MDF 550×450×750', rate: 2.5, category: 'tables' },
  '3-26-046': { description: 'Secondary Table 750×450×750 Saligna', rate: 2.5, category: 'tables' },
  '3-27-076': { description: 'Table 1200×450×750 MDF', rate: 2.5, category: 'tables' },
  '3-29-51': { description: 'Smart Sec Trap. Table 1200×600/600×750', rate: 2.5, category: 'tables' },
  '3-29-55': { description: 'Smart Sec Rect. Table 1200×600×750', rate: 2.5, category: 'tables' },
  '3-30-080': { description: 'Grade R Table 1000×1000×500', rate: 2.5, category: 'gradeR' },
  '3-32-0120': { description: 'S/Table w/o Drawers 1200×700×750', rate: 2.5, category: 'tables' },
  '3-34-050': { description: 'Trap. Table Prim. Sch 1200×600×600', rate: 2.5, category: 'tables' },
  // Lab Table: rate-tier match for "Reading Tables" (R3.80), not a description match.
  '3-36-0110': { description: 'Lab Table 1150×1100×840', rate: 3.8, category: 'readingTables' },

  // Combo Desks (KD/CKD)
  '3-40-07': { description: 'L/Primary Combo Desk 1000×400×575 CKD', rate: 10.0, category: 'combo' },
  '3-40-503': { description: 'H/Primary Combo Desk 1000×400×650 CKD', rate: 10.0, category: 'combo' },
  '3-42-516': { description: 'Secondary Combo Desk 600×400×750 CKD', rate: 10.0, category: 'combo' },
  '3-42-553': { description: 'Secondary Combo Desk 1200×400×750 CKD', rate: 10.0, category: 'combo' },

  // Storage & Cupboards
  '3-46-00': { description: 'Stationery Cupboard 900×450×1800 Steel', rate: 46.0, category: 'stationaryFiling' },
  '3-46-52': { description: 'Filing Cabinet 465×625×1300 4 Drawers Steel', rate: 46.0, category: 'stationaryFiling' },

  // Teacher / Office Chairs — R0 in Reboni's current list; confirm before relying on these
  '3-94-02': { description: "Teacher's Chair w/o Arms Upholstered", rate: 0, category: 'other' },
  '3-94-145': { description: 'H/Back S&T Chair w Arms Upholstered', rate: 0, category: 'other' },
  'NSI/1887/AS': { description: 'Sunny Storage Stool & Lid Polypropy', rate: 0, category: 'other' },
};

export function getAssemblyRate(stockCode: string): number {
  return ASSEMBLY_RATES[stockCode]?.rate ?? 0;
}

export function getAssemblyCategory(stockCode: string): AssemblyCategory {
  return ASSEMBLY_RATES[stockCode]?.category ?? 'other';
}
