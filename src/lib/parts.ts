import { normName } from "./util.ts";

/** Nhóm linh kiện (khóa ổn định, lưu trong DB; tên hiển thị ở i18n: `cat.<khóa>`). */
export const CATEGORIES = ["periodic", "engine", "cooling", "ac", "drivetrain", "brakes", "chassis", "electrical", "documents", "other_costs"] as const;
export type Category = (typeof CATEGORIES)[number];

/** Nhóm không theo dõi hạn (chỉ để phân loại chi phí). */
export const COST_ONLY: Category = "other_costs";
/** Khóa hai mục đặc biệt: công thợ chung và "chưa phân loại". */
export const LABOR_KEY = "labor";
export const GENERIC_KEY = "other";

export type Lang = "en" | "vi";
export interface DefaultPart {
  key: string; category: Category; km: number | null; months: number | null;
  /** Tên hiển thị theo ngôn ngữ. `en` cũng là tên lưu trong DB (cột name). */
  names: Record<Lang, string>;
  /** Từ khóa (không dấu) để tự nhận dạng tên hạng mục trên phiếu, theo ngôn ngữ. */
  kw: Record<Lang, string[]>;
}

/**
 * Danh mục linh kiện chuẩn + chu kỳ MẶC ĐỊNH CHUNG cho ô tô phổ thông (km tính theo km; đổi sang dặm khi tạo xe nếu chọn dặm).
 * Đây chỉ là mức tham khảo, chưa xác thực theo từng dòng xe — chu kỳ đúng phải theo sổ hướng dẫn của xe
 * (app có chức năng tra cứu/quét sổ để thay thế).
 */
export const DEFAULT_PARTS: DefaultPart[] = [
  { key: "periodic_service", category: "periodic", km: 10000, months: 6,
    names: { en: "Scheduled service (manufacturer)", vi: "Bảo dưỡng định kỳ theo hãng" },
    kw: { en: ["scheduled service", "periodic service", "periodic maintenance", "service package", "major service", "minor service", "10000 km service", "5000 km service"], vi: ["bao duong dinh ky", "goi bao duong", "bao duong cap", "periodic maintenance", "bao duong 5000", "bao duong 10000", "bao duong 20000", "bao duong 40000"] } },
  { key: "engine_oil", category: "engine", km: 5000, months: 6,
    names: { en: "Engine oil", vi: "Dầu động cơ" },
    kw: { en: ["engine oil", "motor oil", "oil change", "synthetic oil", "oil"], vi: ["dau may", "dau dong co", "dau nhot", "nhot", "engine oil", "0w20", "0w 20", "0w30", "0w 30", "5w30", "5w 30", "5w40", "5w 40", "10w40", "10w 40", "15w40"] } },
  { key: "oil_filter", category: "engine", km: 5000, months: 6,
    names: { en: "Engine oil filter", vi: "Lọc dầu động cơ" },
    kw: { en: ["oil filter", "filter oil"], vi: ["loc dau", "loc nhot", "oil filter", "loc dau may", "loc dau dong co"] } },
  { key: "air_filter", category: "engine", km: 15000, months: 12,
    names: { en: "Engine air filter", vi: "Lọc gió động cơ" },
    kw: { en: ["air filter", "engine air filter", "air cleaner"], vi: ["loc gio", "loc gio dong co", "loc gio may", "loc khong khi", "air filter"] } },
  { key: "fuel_filter", category: "engine", km: 40000, months: 24,
    names: { en: "Fuel filter", vi: "Lọc nhiên liệu" },
    kw: { en: ["fuel filter", "diesel filter", "water separator", "fuel water separator"], vi: ["loc nhien lieu", "loc xang", "loc dau diesel", "loc diesel", "fuel filter", "loc dau do", "loc tach nuoc"] } },
  { key: "spark_plugs", category: "engine", km: 40000, months: 36,
    names: { en: "Spark plugs", vi: "Bugi" },
    kw: { en: ["spark plug", "spark plugs", "plugs", "ignition plug"], vi: ["bugi", "buji", "bu gi", "spark plug"] } },
  { key: "drive_belt", category: "engine", km: 80000, months: 60,
    names: { en: "Drive belt", vi: "Dây curoa" },
    kw: { en: ["drive belt", "serpentine belt", "fan belt", "timing belt", "belt"], vi: ["day curoa", "curoa", "day dai", "drive belt", "day cu roa"] } },
  { key: "coolant", category: "cooling", km: 40000, months: 24,
    names: { en: "Coolant", vi: "Nước làm mát" },
    kw: { en: ["coolant", "antifreeze", "radiator fluid", "radiator coolant"], vi: ["nuoc lam mat", "nuoc giai nhiet", "coolant", "dung dich lam mat", "nuoc mat"] } },
  { key: "cabin_filter", category: "ac", km: 15000, months: 12,
    names: { en: "Cabin air filter", vi: "Lọc gió điều hòa" },
    kw: { en: ["cabin filter", "cabin air filter", "pollen filter", "ac filter", "a c filter", "air conditioning filter"], vi: ["loc gio dieu hoa", "loc gio cabin", "loc cabin", "loc dieu hoa", "cabin filter", "loc phan hoa", "loc gio may lanh"] } },
  { key: "atf", category: "drivetrain", km: 40000, months: 36,
    names: { en: "Automatic transmission fluid", vi: "Dầu hộp số tự động" },
    kw: { en: ["atf", "transmission fluid", "automatic transmission fluid", "cvt fluid", "gearbox oil", "transmission oil"], vi: ["dau hop so tu dong", "dau hop so", "atf", "dau cvt", "cvt", "dau so tu dong", "dau hop so cvt", "thay dau hop so"] } },
  { key: "gear_oil", category: "drivetrain", km: 60000, months: 48,
    names: { en: "Manual gearbox / differential oil", vi: "Dầu hộp số sàn / vi sai" },
    kw: { en: ["differential oil", "diff oil", "gear oil", "manual gearbox oil", "transfer case oil", "axle oil", "mtf"], vi: ["dau vi sai", "dau cau", "dau hop so san", "mtf", "dau truyen dong", "dau cau sau", "dau cau truoc", "dau hop so so san", "dau gear", "dau hop so phu", "dau cau chu dong"] } },
  { key: "brake_fluid", category: "brakes", km: 40000, months: 24,
    names: { en: "Brake fluid", vi: "Dầu phanh" },
    kw: { en: ["brake fluid", "dot 4", "dot4", "dot 3"], vi: ["dau phanh", "dau thang", "brake fluid"] } },
  { key: "brake_pads_front", category: "brakes", km: 40000, months: null,
    names: { en: "Front brake pads", vi: "Má phanh trước" },
    kw: { en: ["front brake pads", "front brake pad", "front pads"], vi: ["ma phanh truoc", "bo thang truoc", "ma thang truoc", "front brake pad", "bố thắng trước"] } },
  { key: "brake_pads_rear", category: "brakes", km: 60000, months: null,
    names: { en: "Rear brake pads", vi: "Má phanh sau" },
    kw: { en: ["rear brake pads", "rear brake pad", "rear pads"], vi: ["ma phanh sau", "bo thang sau", "ma thang sau", "rear brake pad"] } },
  { key: "brake_discs", category: "brakes", km: 80000, months: null,
    names: { en: "Brake discs", vi: "Đĩa phanh" },
    kw: { en: ["brake disc", "brake discs", "brake rotor", "brake rotors", "rotors", "brake drum"], vi: ["dia phanh", "dia thang", "brake disc", "brake rotor", "tang trong"] } },
  { key: "tires", category: "chassis", km: 50000, months: 60,
    names: { en: "Tires", vi: "Lốp xe" },
    kw: { en: ["tire", "tires", "tyre", "tyres", "new tires", "tire replacement"], vi: ["lop", "lop xe", "vo xe", "tire", "tyre", "thay lop", "vo lop"] } },
  { key: "tire_rotation", category: "chassis", km: 10000, months: 6,
    names: { en: "Tire rotation", vi: "Đảo lốp" },
    kw: { en: ["tire rotation", "tyre rotation", "wheel balancing", "wheel balance", "rotate tires"], vi: ["dao lop", "can bang dong", "can bang lop", "dao banh", "dao lop can bang"] } },
  { key: "alignment", category: "chassis", km: 20000, months: 12,
    names: { en: "Wheel alignment", vi: "Cân chỉnh góc đặt bánh" },
    kw: { en: ["wheel alignment", "alignment", "toe adjustment", "steering alignment"], vi: ["can chinh goc", "goc dat banh", "chinh goc", "thuoc lai", "wheel alignment", "do chum", "can chinh do chum", "can chinh thuoc lai"] } },
  { key: "shocks", category: "chassis", km: 80000, months: null,
    names: { en: "Shock absorbers", vi: "Giảm xóc" },
    kw: { en: ["shock absorber", "shock absorbers", "shocks", "struts", "strut", "damper", "dampers"], vi: ["giam xoc", "phuoc", "phuoc nhun", "shock absorber"] } },
  { key: "battery", category: "electrical", km: null, months: 24,
    names: { en: "Battery", vi: "Ắc quy" },
    kw: { en: ["battery", "car battery", "battery replacement"], vi: ["ac quy", "binh ac quy", "battery", "binh dien", "thay ac quy"] } },
  { key: "wipers", category: "electrical", km: null, months: 12,
    names: { en: "Wiper blades", vi: "Gạt mưa" },
    kw: { en: ["wiper", "wipers", "wiper blade", "wiper blades"], vi: ["gat mua", "gat nuoc", "cao su gat", "wiper", "choi gat", "choi quet kinh", "gat kinh"] } },
  { key: "inspection", category: "documents", km: null, months: 12,
    names: { en: "Roadworthiness inspection", vi: "Đăng kiểm" },
    kw: { en: ["inspection", "roadworthiness", "mot", "smog check", "emissions test", "vehicle inspection", "registration fee"], vi: ["dang kiem", "kiem dinh", "phi duong bo", "phi kiem dinh", "phi dang kiem"] } },
  { key: "insurance", category: "documents", km: null, months: 12,
    names: { en: "Insurance", vi: "Bảo hiểm TNDS / thân vỏ" },
    kw: { en: ["insurance", "liability insurance", "car insurance", "comprehensive insurance"], vi: ["bao hiem", "tnds", "bao hiem vat chat", "bao hiem than vo", "bh than vo"] } },
  { key: "injector_cleaning", category: "engine", km: null, months: null,
    names: { en: "Injector / combustion cleaning", vi: "Vệ sinh kim phun / buồng đốt" },
    kw: { en: ["injector cleaning", "injector", "fuel system cleaning", "carbon cleaning", "throttle body cleaning", "combustion chamber"], vi: ["kim phun", "buong dot", "hong ga", "hong gio", "ve sinh kim phun", "ve sinh buong dot", "ve sinh dong co", "ve sinh bom xang"] } },
  { key: "ac_gas", category: "ac", km: null, months: null,
    names: { en: "A/C refrigerant", vi: "Gas điều hòa" },
    kw: { en: ["refrigerant", "ac gas", "a c gas", "ac recharge", "a c recharge", "r134a", "r1234yf", "air conditioning gas"], vi: ["gas lanh", "nap gas", "gas dieu hoa", "gas may lanh", "r134a", "r1234yf", "bom gas", "ve sinh dan lanh"] } },
  { key: "bulbs", category: "electrical", km: null, months: null,
    names: { en: "Bulbs / lights", vi: "Bóng đèn / đèn xe" },
    kw: { en: ["bulb", "bulbs", "headlight", "headlights", "tail light", "tail lights", "led", "indicator bulb", "fog light"], vi: ["bong den", "den pha", "den hau", "den xi nhan", "led", "bulb", "den sau", "den cos", "den phanh", "den sương mù"] } },
  { key: "suspension_bushings", category: "chassis", km: null, months: null,
    names: { en: "Ball joints / suspension bushings", vi: "Rotuyn / cao su gầm" },
    kw: { en: ["ball joint", "ball joints", "bushing", "bushings", "control arm", "tie rod", "tie rod end", "stabilizer link", "engine mount", "suspension arm"], vi: ["rotuyn", "rotul", "cao su can bang", "cao su chong rung", "bac lot", "cao su cang a", "cao su chan may", "chan may", "cao su gam", "cang a", "bi tren", "bi lap", "rotuyn lai", "co rotuyn"] } },
  { key: "labor", category: COST_ONLY, km: null, months: null,
    names: { en: "General labor", vi: "Nhân công / công thợ chung" },
    kw: { en: ["labor", "labour", "labor charge", "workmanship", "service charge", "inspection labor", "labour charge"], vi: ["cong kiem tra", "cong tho", "nhan cong", "tien cong", "cong lap", "cong thay", "cong ve sinh", "cong"] } },
  { key: "car_wash", category: COST_ONLY, km: null, months: null,
    names: { en: "Car wash / detailing", vi: "Rửa xe / vệ sinh xe" },
    kw: { en: ["car wash", "wash", "detailing", "interior cleaning", "vacuum", "ceramic coating", "polish", "waxing"], vi: ["rua xe", "ve sinh noi that", "ve sinh xe", "hut bui", "ve sinh khoang may", "car wash", "danh bong", "phu ceramic", "phu nano", "thoa ceramic", "xit gam", "rua gam"] } },
  { key: "washer_fluid", category: COST_ONLY, km: null, months: null,
    names: { en: "Washer fluid / additives", vi: "Nước rửa kính / phụ gia" },
    kw: { en: ["washer fluid", "windshield washer", "additive", "additives", "fuel additive"], vi: ["nuoc rua kinh", "phu gia", "dung dich", "nuoc rua"] } },
  { key: "misc", category: COST_ONLY, km: null, months: null,
    names: { en: "Misc. supplies / fees", vi: "Phụ phí / vật tư phụ khác" },
    kw: { en: ["misc", "miscellaneous", "supplies", "shop supplies", "environmental fee", "disposal fee", "grease", "bolts", "tape", "sundry"], vi: ["phu phi", "phi van chuyen", "phi ve sinh", "vat tu phu", "dau mo", "mo bo", "keo", "bang dinh", "oc vit"] } },
  { key: "other", category: COST_ONLY, km: null, months: null,
    names: { en: "Other (uncategorized)", vi: "Khác (chưa phân loại)" },
    kw: { en: [], vi: [] } },
];

const BY_KEY = new Map(DEFAULT_PARTS.map((p) => [p.key, p]));
const KW_BY_NAME = new Map(DEFAULT_PARTS.map((p) => [p.names.en, [...p.kw.en, ...p.kw.vi].map(normName)]));
/** Từ khóa (cả hai ngôn ngữ) của một linh kiện, theo tên lưu trong DB. */
export const keywordsFor = (dbName: string): string[] => KW_BY_NAME.get(dbName) ?? [];
/** Tên hiển thị của linh kiện theo ngôn ngữ (linh kiện tự thêm thì dùng tên đã lưu). */
export const partLabel = (p: { key?: string | null; name: string }, lang: string): string =>
  (p.key && BY_KEY.get(p.key)?.names[lang as Lang]) || p.name;
/** Thứ tự nhóm để hiển thị. */
export const categoryRank = (c: string): number => { const i = (CATEGORIES as readonly string[]).indexOf(c); return i < 0 ? 99 : i; };

/** Đoán linh kiện từ tên hạng mục (khớp từ khóa dài nhất). Trả về id hoặc null. */
export function guessPart(raw: string, parts: { id: number; kw: string[] }[]): number | null {
  const n = ` ${normName(raw)} `;
  let best: { id: number; len: number } | null = null;
  for (const p of parts)
    for (const k of p.kw) {
      if (k && n.includes(` ${k} `) && (!best || k.length > best.len)) best = { id: p.id, len: k.length };
    }
  return best?.id ?? null;
}
