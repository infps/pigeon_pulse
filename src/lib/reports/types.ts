/**
 * Report pack — shared types.
 *
 * HayLoft shipped eleven FastReport templates in C:\Hayloft\reports. Each one
 * is reproduced here as a definition that resolves to a titled table, so a
 * single renderer can emit it as CSV, XLSX, PDF or HTML.
 */

export interface ReportParams {
  seasonId?: number;
  raceId?: number;
  breederId?: number;
  feeSchemeId?: number;
  prizeSchemeId?: number;
  bettingSchemeId?: number;
}

export interface ReportData {
  title: string;
  /** Context line under the title — event, season, race, generation date. */
  subtitle?: string;
  columns: string[];
  rows: string[][];
  /** Optional trailing totals row, rendered emphasised. */
  totals?: string[];
  /** Columns that hold figures, so the renderer can right-align them. */
  numericColumns?: number[];
}

export type ReportScope = "race" | "season" | "scheme" | "global";

export interface ReportDefinition {
  key: string;
  title: string;
  description: string;
  /** The HayLoft template this replaces, for traceability. */
  legacyTemplate: string;
  scope: ReportScope;
  /** Which parameter the report requires to run. */
  requires: keyof ReportParams | null;
  /** Renders as mailing labels rather than a table. */
  isLabelSheet?: boolean;
  build: (params: ReportParams) => Promise<ReportData>;
}
