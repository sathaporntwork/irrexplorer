import type { IrrApiResponse, ApiPrefixItem, PrefixRecord, StatsSummary } from './types';

/**
 * Clean and normalize ASN input (e.g. "as65000" -> "65000", " 65000 " -> "65000")
 */
export function normalizeAsn(input: string): string {
  return input.trim().toUpperCase().replace(/^AS/, '').trim();
}

/**
 * Fetch and process IRR & RPKI prefix data for a given ASN
 */
export async function fetchPrefixData(rawAsn: string): Promise<{
  records: PrefixRecord[];
  stats: StatsSummary;
  asn: string;
}> {
  const asn = normalizeAsn(rawAsn);
  if (!asn || !/^\d+$/.test(asn)) {
    throw new Error('กรุณาระบุหมายเลข Autonomous System Number (ASN) ที่ถูกต้อง (ตัวเลขเท่านั้น)');
  }

  const endpoint = `https://irrexplorer.nlnog.net/api/prefixes/asn/AS${asn}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`การเชื่อมต่อไปยัง NLNOG API สำหรับ AS${asn} หมดเวลา (Timeout) เนื่องจากข้อมูลมีขนาดใหญ่มาก`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`ไม่พบข้อมูลสำหรับ AS${asn} บน NLNOG IRR Explorer`);
    }
    throw new Error(`เกิดข้อผิดพลาดในการดึงข้อมูลจาก API (${response.status}: ${response.statusText})`);
  }

  const data: IrrApiResponse = await response.json();
  const rawItems: ApiPrefixItem[] = [
    ...(data.directOrigin || []),
    ...(data.overlaps || [])
  ];

  // Map to deduplicate by prefix (matches pandas drop_duplicates(subset=["PREFIX"]))
  const recordMap = new Map<string, PrefixRecord>();

  for (const item of rawItems) {
    const prefix = item.prefix;
    if (!prefix || recordMap.has(prefix)) {
      continue;
    }

    const typeIp: 'v4' | 'v6' = prefix.includes(':') ? 'v6' : 'v4';

    // ตรวจสอบ APNIC และ RPKI status (ตาม Logic ใน irr.py)
    const irrRoutes = item.irrRoutes?.APNIC || [];
    const matchedRoute = irrRoutes.find(r => String(r.asn) === asn);

    const apnic: 'VALID' | 'NOT_FOUND' = matchedRoute ? 'VALID' : 'NOT_FOUND';
    const rpki = (matchedRoute?.rpkiStatus as string) || 'NOT_FOUND';
    const originAsn = matchedRoute ? `AS${asn}` : '-';

    const allIrrSources = item.irrRoutes ? Object.keys(item.irrRoutes) : [];

    recordMap.set(prefix, {
      prefix,
      typeIp,
      apnic,
      rpki,
      asn: originAsn,
      rir: item.rir,
      matchedRoute,
      allIrrSources,
      rawItem: item
    });
  }

  // แปลงเป็น Array แล้วเรียงลำดับ: IPv4 มาก่อน IPv6 แล้วตามด้วย Prefix
  // (ตรงกับ pandas: df["sort_key"] = df["TYPEIP"].apply(lambda x: 0 if x == "v4" else 1)
  // df.sort_values(by=["sort_key", "PREFIX"]))
  const records = Array.from(recordMap.values()).sort((a, b) => {
    const sortKeyA = a.typeIp === 'v4' ? 0 : 1;
    const sortKeyB = b.typeIp === 'v4' ? 0 : 1;
    if (sortKeyA !== sortKeyB) {
      return sortKeyA - sortKeyB;
    }
    return a.prefix.localeCompare(b.prefix, undefined, { numeric: true });
  });

  // คำนวณสรุปสถิติ (Statistics)
  const totalPrefixes = records.length;
  const totalV4 = records.filter(r => r.typeIp === 'v4').length;
  const totalV6 = records.filter(r => r.typeIp === 'v6').length;

  const rpkiValid = records.filter(r => r.rpki === 'VALID').length;
  const rpkiNotFound = records.filter(r => r.rpki === 'NOT_FOUND').length;
  const rpkiInvalid = records.filter(r => r.rpki === 'INVALID').length;

  const apnicValid = records.filter(r => r.apnic === 'VALID').length;
  const apnicNotFound = records.filter(r => r.apnic === 'NOT_FOUND').length;

  const stats: StatsSummary = {
    totalPrefixes,
    totalV4,
    totalV6,
    rpkiValid,
    rpkiNotFound,
    rpkiInvalid,
    apnicValid,
    apnicNotFound
  };

  return { records, stats, asn };
}
