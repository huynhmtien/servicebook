import { normName } from "./util.ts";

export interface DefaultPart { name: string; category: string; km: number | null; months: number | null; kw: string[] }

/** Nhóm không theo dõi hạn (chỉ để phân loại chi phí). */
export const COST_ONLY = "Chi phí khác";

/**
 * Danh mục linh kiện chuẩn + chu kỳ MẶC ĐỊNH CHUNG cho ô tô phổ thông.
 * Đây chỉ là mức tham khảo, chưa xác thực theo từng dòng xe — chu kỳ đúng phải theo sổ hướng dẫn
 * của xe (app có chức năng tra cứu/quét sổ để thay thế). `kw`: từ khóa (không dấu) để tự nhận dạng tên hạng mục trên phiếu.
 */
export const DEFAULT_PARTS: DefaultPart[] = [
  { name: "Bảo dưỡng định kỳ theo hãng", category: "Định kỳ", km: 10000, months: 6, kw: ["bao duong dinh ky", "goi bao duong", "bao duong cap", "periodic maintenance", "bao duong 5000", "bao duong 10000", "bao duong 20000", "bao duong 40000"] },
  { name: "Dầu động cơ", category: "Động cơ", km: 5000, months: 6, kw: ["dau may", "dau dong co", "dau nhot", "nhot", "engine oil", "0w20", "0w 20", "0w30", "0w 30", "5w30", "5w 30", "5w40", "5w 40", "10w40", "10w 40", "15w40"] },
  { name: "Lọc dầu động cơ", category: "Động cơ", km: 5000, months: 6, kw: ["loc dau", "loc nhot", "oil filter", "loc dau may", "loc dau dong co"] },
  { name: "Lọc gió động cơ", category: "Động cơ", km: 15000, months: 12, kw: ["loc gio", "loc gio dong co", "loc gio may", "loc khong khi", "air filter"] },
  { name: "Lọc nhiên liệu", category: "Động cơ", km: 40000, months: 24, kw: ["loc nhien lieu", "loc xang", "loc dau diesel", "loc diesel", "fuel filter", "loc dau do", "loc tach nuoc"] },
  { name: "Bugi", category: "Động cơ", km: 40000, months: 36, kw: ["bugi", "buji", "bu gi", "spark plug"] },
  { name: "Dây curoa", category: "Động cơ", km: 80000, months: 60, kw: ["day curoa", "curoa", "day dai", "drive belt", "day cu roa"] },
  { name: "Nước làm mát", category: "Làm mát", km: 40000, months: 24, kw: ["nuoc lam mat", "nuoc giai nhiet", "coolant", "dung dich lam mat", "nuoc mat"] },
  { name: "Lọc gió điều hòa", category: "Điều hòa", km: 15000, months: 12, kw: ["loc gio dieu hoa", "loc gio cabin", "loc cabin", "loc dieu hoa", "cabin filter", "loc phan hoa", "loc gio may lanh"] },
  { name: "Dầu hộp số tự động", category: "Truyền động", km: 40000, months: 36, kw: ["dau hop so tu dong", "dau hop so", "atf", "dau cvt", "cvt", "dau so tu dong", "dau hop so cvt", "thay dau hop so"] },
  { name: "Dầu hộp số sàn / vi sai", category: "Truyền động", km: 60000, months: 48, kw: ["dau vi sai", "dau cau", "dau hop so san", "mtf", "dau truyen dong", "dau cau sau", "dau cau truoc", "dau hop so so san", "dau gear", "dau hop so phu", "dau cau chu dong"] },
  { name: "Dầu phanh", category: "Phanh", km: 40000, months: 24, kw: ["dau phanh", "dau thang", "brake fluid"] },
  { name: "Má phanh trước", category: "Phanh", km: 40000, months: null, kw: ["ma phanh truoc", "bo thang truoc", "ma thang truoc", "front brake pad", "bố thắng trước"] },
  { name: "Má phanh sau", category: "Phanh", km: 60000, months: null, kw: ["ma phanh sau", "bo thang sau", "ma thang sau", "rear brake pad"] },
  { name: "Đĩa phanh", category: "Phanh", km: 80000, months: null, kw: ["dia phanh", "dia thang", "brake disc", "brake rotor", "tang trong"] },
  { name: "Lốp xe", category: "Gầm / lốp", km: 50000, months: 60, kw: ["lop", "lop xe", "vo xe", "tire", "tyre", "thay lop", "vo lop"] },
  { name: "Đảo lốp", category: "Gầm / lốp", km: 10000, months: 6, kw: ["dao lop", "can bang dong", "can bang lop", "dao banh", "dao lop can bang"] },
  { name: "Cân chỉnh góc đặt bánh", category: "Gầm / lốp", km: 20000, months: 12, kw: ["can chinh goc", "goc dat banh", "chinh goc", "thuoc lai", "wheel alignment", "do chum", "can chinh do chum", "can chinh thuoc lai"] },
  { name: "Giảm xóc", category: "Gầm / lốp", km: 80000, months: null, kw: ["giam xoc", "phuoc", "phuoc nhun", "shock absorber"] },
  { name: "Ắc quy", category: "Điện", km: null, months: 24, kw: ["ac quy", "binh ac quy", "battery", "binh dien", "thay ac quy"] },
  { name: "Gạt mưa", category: "Điện", km: null, months: 12, kw: ["gat mua", "gat nuoc", "cao su gat", "wiper", "choi gat", "choi quet kinh", "gat kinh"] },
  { name: "Đăng kiểm", category: "Giấy tờ", km: null, months: 12, kw: ["dang kiem", "kiem dinh", "phi duong bo", "phi kiem dinh", "phi dang kiem"] },
  { name: "Bảo hiểm TNDS / thân vỏ", category: "Giấy tờ", km: null, months: 12, kw: ["bao hiem", "tnds", "bao hiem vat chat", "bao hiem than vo", "bh than vo"] },
  // --- thêm: theo dõi nhưng chưa có chu kỳ chuẩn chung (người dùng/AI/sổ hướng dẫn sẽ đặt) ---
  { name: "Vệ sinh kim phun / buồng đốt", category: "Động cơ", km: null, months: null, kw: ["kim phun", "buong dot", "hong ga", "hong gio", "ve sinh kim phun", "ve sinh buong dot", "ve sinh dong co", "ve sinh bom xang"] },
  { name: "Gas điều hòa", category: "Điều hòa", km: null, months: null, kw: ["gas lanh", "nap gas", "gas dieu hoa", "gas may lanh", "r134a", "r1234yf", "bom gas", "ve sinh dan lanh"] },
  { name: "Bóng đèn / đèn xe", category: "Điện", km: null, months: null, kw: ["bong den", "den pha", "den hau", "den xi nhan", "led", "bulb", "den sau", "den cos", "den phanh", "den sương mù"] },
  { name: "Rotuyn / cao su gầm", category: "Gầm / lốp", km: null, months: null, kw: ["rotuyn", "rotul", "cao su can bang", "cao su chong rung", "bac lot", "cao su cang a", "cao su chan may", "chan may", "cao su gam", "cang a", "bi tren", "bi lap", "rotuyn lai", "co rotuyn"] },
  // --- chi phí không theo dõi hạn ---
  { name: "Nhân công / công thợ chung", category: COST_ONLY, km: null, months: null, kw: ["cong kiem tra", "cong tho", "nhan cong", "tien cong", "cong lap", "cong thay", "cong ve sinh", "cong"] },
  { name: "Rửa xe / vệ sinh xe", category: COST_ONLY, km: null, months: null, kw: ["rua xe", "ve sinh noi that", "ve sinh xe", "hut bui", "ve sinh khoang may", "car wash", "danh bong", "phu ceramic", "phu nano", "thoa ceramic", "xit gam", "rua gam"] },
  { name: "Nước rửa kính / phụ gia", category: COST_ONLY, km: null, months: null, kw: ["nuoc rua kinh", "phu gia", "dung dich", "nuoc rua"] },
  { name: "Phụ phí / vật tư phụ khác", category: COST_ONLY, km: null, months: null, kw: ["phu phi", "phi van chuyen", "phi ve sinh", "vat tu phu", "dau mo", "mo bo", "keo", "bang dinh", "oc vit"] },
  { name: "Khác (chưa phân loại)", category: COST_ONLY, km: null, months: null, kw: [] },
];

const KW_BY_NAME = new Map(DEFAULT_PARTS.map((p) => [p.name, p.kw.map(normName)]));
export const keywordsFor = (name: string): string[] => KW_BY_NAME.get(name) ?? [];

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
