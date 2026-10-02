export interface IrrRoute {
  asn: number | string;
  rpslText?: string;
  rpslPk?: string;
  rpkiStatus?: 'VALID' | 'INVALID' | 'NOT_FOUND' | string;
  rpkiMaxLength?: number | null;
  source?: string;
  descr?: string;
  [key: string]: unknown;
}

export interface RpkiRoute {
  asn: number | string;
  rpslText?: string;
  rpslPk?: string;
  rpkiStatus?: 'VALID' | 'INVALID' | 'NOT_FOUND' | string;
  rpkiMaxLength?: number;
  origin?: string;
  source?: string;
  [key: string]: unknown;
}

export interface ApiPrefixItem {
  prefix: string;
  rir?: string;
  rpkiRoutes?: RpkiRoute[];
  bgpOrigins?: unknown[];
  irrRoutes?: Record<string, IrrRoute[]>;
  messages?: Array<{ category: string; text: string }>;
  [key: string]: unknown;
}

export interface IrrApiResponse {
  directOrigin?: ApiPrefixItem[];
  overlaps?: ApiPrefixItem[];
  [key: string]: unknown;
}

export interface PrefixRecord {
  prefix: string;
  typeIp: 'v4' | 'v6';
  apnic: 'VALID' | 'NOT_FOUND';
  rpki: 'VALID' | 'NOT_FOUND' | 'INVALID' | string;
  asn: string;
  rir?: string;
  matchedRoute?: IrrRoute;
  allIrrSources?: string[];
  rawItem?: ApiPrefixItem;
}

export interface StatsSummary {
  totalPrefixes: number;
  totalV4: number;
  totalV6: number;
  rpkiValid: number;
  rpkiNotFound: number;
  rpkiInvalid: number;
  apnicValid: number;
  apnicNotFound: number;
}

export type FilterStatus = 'ALL' | 'V4' | 'V6' | 'RPKI_VALID' | 'RPKI_NOT_FOUND' | 'RPKI_INVALID' | 'APNIC_VALID' | 'APNIC_NOT_FOUND';

export type SortField = 'prefix' | 'typeIp' | 'apnic' | 'rpki' | 'asn';
export type SortOrder = 'asc' | 'desc';
