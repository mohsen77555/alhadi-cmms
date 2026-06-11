import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

/* ───────────────────────── ثوابت ───────────────────────── */
const C = { ink:"#16191B", paper:"#F2F3F1", card:"#FFFFFF", orange:"#E8590C", steel:"#7A858C",
  line:"#D8DCDA", green:"#2F9E44", red:"#D9480F", amber:"#E67700", blue:"#1971C2", purple:"#7048E8" };
const KEY = "cmms-data-v1";
const API = (import.meta as any).env?.VITE_API_URL || (typeof window !== "undefined" && (window as any).__CMMS_API_URL__) || "http://localhost:4000/api";
const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().slice(0, 10);
const now = () => new Date().toLocaleString("ar", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const fmt = (d) => (d ? new Date(d + "T00:00:00").toLocaleDateString("ar", { month: "short", day: "numeric" }) : "—");
const daysUntil = (d) => (d ? Math.round((new Date(d + "T00:00:00") - new Date(today() + "T00:00:00")) / 86400000) : null);
const money = (n) => (Math.round(Number(n || 0) * 100) / 100).toLocaleString("ar") + " ر.س";

/* دورة الحالات الكاملة (وثيقة التنفيذ) */
const WO_FLOW = ["مسودة", "مُصدر", "جاهز", "قيد التنفيذ", "بانتظار المراجعة", "مغلق"];
const WO_EXTRA = ["معلق", "بانتظار مواد", "مُعاد للتصحيح", "ملغي"];
const WO_COLORS = { "مسودة": C.steel, "مُصدر": C.blue, "جاهز": C.purple, "قيد التنفيذ": C.amber,
  "بانتظار المراجعة": C.blue, "مغلق": C.ink, "معلق": C.steel, "بانتظار مواد": C.amber,
  "مُعاد للتصحيح": C.red, "ملغي": C.red };
const ACTIVE_STATES = ["مسودة", "مُصدر", "جاهز", "قيد التنفيذ", "بانتظار المراجعة", "معلق", "بانتظار مواد", "مُعاد للتصحيح"];
const REQ_FLOW = { "مفتوح": ["قبول", "رفض"], "مقبول": ["تحويل لأمر عمل", "رفض"] };
const ROLES = ["مدير", "مشرف", "فني", "مخزن", "طالب خدمة"];
const SAFETY_DEFAULTS = ["عزل مصدر الطاقة (LOTO)", "تأمين منطقة العمل", "ارتداء معدات الوقاية الشخصية"];
const FAILURE_MODES = ["انحشار", "اهتزاز", "تسريب", "كسر", "حرارة زائدة", "خلل كهربائي", "أخرى"];
const DOC_TYPES = ["دليل تشغيل", "كتالوج قطع غيار", "مخطط كهربائي", "مخطط ميكانيكي", "مرجع PLC/IO", "نموذج فحص", "مستند ضمان", "مستند مورد"];

/* مجموعات أصول المطاحن القياسية (وثيقة الأصول) */
const STANDARD_GROUPS = [
  ["ELV", "مصاعد القواديس (Bucket Elevators)"], ["CCV", "النواقل السلسلية (Chain Conveyors)"],
  ["SCV", "النواقل الحلزونية (Screw Conveyors)"], ["SFN", "مراوح الصوامع (Silo Fans)"],
  ["SGT", "بوابات الصوامع (Silo Gates)"], ["SNS", "الحساسات (Sensors)"],
  ["RML", "الطواحين الدلفينية (Rollermills)"], ["PLS", "المناخل المستوية (Plansifters)"],
  ["PRF", "المنقيات (Purifiers)"], ["CMP", "الضواغط (Compressors)"],
  ["PCK", "ماكينات التعبئة (Packing Machines)"], ["SCL", "الموازين (Scales)"],
];

const EMPTY = { workAreas:[], workCenters:[], resources:[], technicians:[], assets:[], assetGroups:[],
  meterTemplates:[], assetMeters:[], readings:[], warranties:[],
  stdOps:[], workDefs:[], workRequests:[], programs:[], workOrders:[],
  items:[], warehouses:[], stockTx:[],
  warrantyProviders:[], laborRates:[], repairTimes:[], coverages:[], contracts:[], entitlements:[], claims:[],
  assetGroupRules:[], logicalHierarchies:[],
  settings:{ role:"مدير", myTechId:"" } };

/* ثوابت قواعد مجموعات الأصول (ف4) */
const GROUP_ATTRS = [["location", "الموقع"], ["type", "النوع"], ["workCenterId", "مركز العمل"]];
const RULE_USAGES = ["عام (صيانة وبرامج)", "حالة الأصل (قاعدة تحقق)"];
const END_REASONS = ["إلغاء يدوي", "تغير بيانات الأصل", "إنهاء الأصل"];

/* ثوابت ضمان المورد (ف6) */
const COV_STATUS = ["مسودة", "جاهز"];
const COV_TYPES = ["شراء جديد", "ضمان ممتد", "ضمان OEM"];
const DUR_UOM = { "يوم": 1, "شهر": 30, "سنة": 365 };
const CLAIM_STATUS = ["قيد المراجعة", "مُقدمة", "محلولة", "مرفوضة"];
const ENT_TYPES = ["صرف مادة", "إرجاع مادة", "تحميل مورد", "تحميل معدات", "إصلاح قياسي", "أخرى"];

/* ثوابت العمليات القياسية (ف7) */
const OP_BASIS = ["ثابت", "متغير"];
const OP_CHARGE = ["يدوي", "تلقائي"];
const OP_ACTIVITY = ["تجهيز", "تنفيذ", "إنهاء"];
const REPAIR_REASONS = ["عطل", "صيانة وقائية", "ضمان", "فحص دوري", "تحسين"];
const WORK_DONE = ["تنظيف", "إصلاح", "استبدال", "ضبط", "تشحيم", "فحص"];
const ATTACH_TYPES = ["رابط", "نص"];

/* أنواع حركات المخزون (وثيقة المخزون §Stock Transactions) */
const TX_TYPES = ["استلام", "صرف لأمر عمل", "إرجاع من أمر عمل", "تحويل", "تسوية", "إتلاف"];
const ITEM_CATS = ["محامل", "سيور", "قواديس", "زيوت وشحوم", "فلاتر", "كهرباء", "حساسات", "أخرى"];

/* ترحيل حالات النسخة السابقة */
const MIGRATE_STATUS = { "غير مُصدر": "مسودة", "مُصدر": "جاهز", "قيد التنفيذ": "قيد التنفيذ", "مكتمل": "مغلق", "مغلق": "مغلق", "ملغي": "ملغي" };

/* ضغط الصور قبل الحفظ (حد التخزين 5MB) */
const resizeImage = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 480, scale = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = img.width * scale; cv.height = img.height * scale;
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      resolve(cv.toDataURL("image/jpeg", 0.5));
    };
    img.onerror = reject;
    img.src = reader.result;
  };
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

/* ───────────────────────── ربط البيانات بالـ Backend ───────────────────────── */
const normalizeDb = (raw = {}) => {
  const d = { ...(raw || {}) };

  d.workOrders = (d.workOrders || []).map((w) => ({
    checklist: [], materials: [], photos: [], execLog: [], failure: null,
    ...w, status: MIGRATE_STATUS[w.status] || w.status,
  }));
  d.assets = (d.assets || []).map((a) => ({ parts: [], docs: [], photos: [], specs: "",
    allowWO: true, allowPrograms: true, enableIoT: false, endDate: "", quantity: 1,
    ownership: "مؤسسة", customer: "", contact: "", defaultWOType: "", notes: [], history: [], ...a }));
  d.stdOps = (d.stdOps || []).map((o) => ({ type: "داخلية", countPoint: true, autoTransact: false,
    resources: [], attachments: [], inactiveOn: "", repairReason: "", repairTx: "", workDone: "", ...o }));
  d.meterTemplates = (d.meterTemplates || []).map((t) => ({ code: t.code || (t.name || "MTR"), description: "",
    startDate: "", endDate: "", initial: t.initial ?? "", recordAtWO: "لا يسمح", resetAllowed: true, resetValue: 0,
    rolloverAllowed: false, rolloverMax: "", rolloverMin: 0, allowSchedule: true, estDailyRate: "", readingsForRate: "", ...t }));
  d.assetMeters = (d.assetMeters || []).map((m) => ({ recordAtWO: "", endDate: "", estDailyRate: "", readingsForRate: "", ...m }));
  d.readings = (d.readings || []).map((r) => ({ status: r.isReset ? "تصفير" : "مسجلة", comments: "", rollover: false, ...r }));

  /* ف4: ترقية المجموعات القديمة إلى قاعدة قياسية + تعيينات بتواريخ */
  d.assetGroupRules = d.assetGroupRules || [];
  if ((d.assetGroups || []).some((g) => !g.ruleId)) {
    let std = d.assetGroupRules.find((r) => r.code === "STD");
    if (!std) { std = { id: uid(), name: "التصنيف القياسي", code: "STD", description: "قاعدة افتراضية للمجموعات السابقة", attributes: [], usages: ["عام (صيانة وبرامج)"], enforceUnique: false, inactiveOn: "" }; d.assetGroupRules.push(std); }
    d.assetGroups = (d.assetGroups || []).map((g, i) => g.ruleId ? g : ({
      number: "AG-" + String(100 + i + 1), description: "", attrValues: {}, excludeFromRequests: false, excludeFromWO: false, inactiveOn: "",
      assignments: (g.assetIds || []).map((aid) => ({ id: uid(), assetId: aid, start: today(), end: "", endReason: "", by: "ترحيل" })),
      ...g, ruleId: std.id }));
  }

  return { ...EMPTY, ...d, settings: { ...EMPTY.settings, ...(d.settings || {}) } };
};

const loadLocalBackup = () => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const value = window.localStorage.getItem(KEY);
    return value ? JSON.parse(value) : null;
  } catch (e) {
    console.error("فشل قراءة النسخة المحلية", e);
    return null;
  }
};

const saveLocalBackup = (data) => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    window.localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error("فشل حفظ النسخة المحلية", e);
    return false;
  }
};

/* ───────────────────────── التطبيق ───────────────────────── */
export default function CMMS() {
  const [db, setDb] = useState(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState("جارٍ التحميل…");
  const [tab, setTab] = useState("home");
  const [woDetail, setWoDetail] = useState(null);
  const [assetDetail, setAssetDetail] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setSyncStatus("جارٍ الاتصال بالخادم…");
        const res = await fetch(`${API}/state`, { cache: "no-store" });
        if (!res.ok) throw new Error("فشل تحميل البيانات من الخادم");
        const d = await res.json();
        if (d) setDb(normalizeDb(d));
        setSyncStatus("متصل بالخادم");
      } catch (e) {
        console.error("فشل تحميل بيانات الخادم", e);
        const local = loadLocalBackup();
        if (local) {
          setDb(normalizeDb(local));
          setSyncStatus("وضع محلي مؤقت — الخادم غير متاح");
        } else {
          setSyncStatus("بيانات محلية فارغة — شغّل الخادم للحفظ المركزي");
        }
      }
      setLoaded(true);
    })();
  }, []);

  const save = async (next) => {
    setDb(next);
    try {
      const res = await fetch(`${API}/state`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error(await res.text().catch(() => "فشل الحفظ في الخادم"));
      saveLocalBackup(next);
      setSyncStatus("تم الحفظ في الخادم");
    } catch (e) {
      console.error("فشل الحفظ في الخادم", e);
      if (saveLocalBackup(next)) {
        setSyncStatus("حفظ محلي مؤقت — الخادم غير متاح");
      } else {
        setSyncStatus("فشل الحفظ — تحقق من الخادم وحجم الصور");
        alert("فشل الحفظ في الخادم ولم تنجح النسخة المحلية — قد تكون مساحة التخزين امتلأت بسبب الصور.");
      }
    }
  };
  const put = (entity, rows) => save({ ...db, [entity]: rows });
  const add = (entity, row) => { const r = { id: uid(), ...row }; put(entity, [...db[entity], r]); return r; };
  const update = (entity, id, patch) => put(entity, db[entity].map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (entity, id) => put(entity, db[entity].filter((r) => r.id !== id));
  const setSetting = (k, v) => save({ ...db, settings: { ...db.settings, [k]: v } });
  const nameOf = (entity, id, key = "name") => db[entity].find((r) => r.id === id)?.[key] || "—";

  /* الأدوار (وثيقة التنفيذ §الأدوار) */
  const role = db.settings.role;
  const can = {
    manage: role === "مدير" || role === "مشرف",
    execute: role === "فني" || role === "مدير" || role === "مشرف",
    review: role === "مدير" || role === "مشرف",
    warehouse: role === "مخزن" || role === "مدير" || role === "مشرف",
    requestOnly: role === "طالب خدمة",
    admin: role === "مدير",
  };

  /* ───── محرك العدادات (ف5): Net Change / Displayed / Life-to-Date ───── */
  const meterReadings = (amId) => db.readings.filter((r) => r.assetMeterId === amId).sort((a, b) => (a.at < b.at ? -1 : 1));
  const activeReadings = (amId) => meterReadings(amId).filter((r) => !["معطلة", "ملغاة"].includes(r.status));
  const lastReading = (amId) => activeReadings(amId).slice(-1)[0] || null;
  /* حساب الصفوف: لكل قراءة فعالة net/displayed/ltd حسب نوع العداد والاتجاه مع التصفير والتدوير */
  const meterRows = (am) => {
    const tpl = db.meterTemplates.find((t) => t.id === am.templateId) || {};
    let prevDisp = Number(am.initial || 0), ltdv = 0, started = false;
    const out = [];
    for (const r of activeReadings(am.id)) {
      const v = Number(r.value);
      let net = 0, disp = v;
      if (tpl.meterType === "مقياس") { net = started ? v - prevDisp : 0; disp = v; ltdv = v; }
      else if (tpl.readingType === "تغير") {
        net = v; disp = prevDisp + (tpl.direction === "تنازلي" ? -v : v);
        ltdv += (tpl.direction === "تنازلي" ? -v : v);
      } else { /* مستمر مطلق */
        if (r.status === "تصفير" || r.isReset) { net = 0; disp = v; }
        else if (r.rollover) { net = (Number(tpl.rolloverMax || 0) - prevDisp) + (v - Number(tpl.rolloverMin || 0)); disp = v; }
        else { net = started ? v - prevDisp : (r.status === "أولية" ? 0 : v - prevDisp); disp = v; }
        if (tpl.direction === "تنازلي") ltdv = disp; /* التنازلي: العمر ≈ المعروض */
        else ltdv += Math.max(0, net);
      }
      out.push({ ...r, net, displayed: disp, ltd: ltdv });
      prevDisp = disp; started = true;
    }
    return out;
  };
  const ltd = (am) => { const rows = meterRows(am); return rows.length ? rows[rows.length - 1].ltd : 0; };
  const currentValue = (am) => { const rows = meterRows(am); return rows.length ? rows[rows.length - 1].displayed : Number(am.initial || 0); };
  /* معدل الاستخدام المحسوب من آخر N قراءات: (نهاية − بداية) ÷ الأيام (ف5 §15.1) */
  const calcUtilRate = (am) => {
    const tpl = db.meterTemplates.find((t) => t.id === am.templateId) || {};
    if (tpl.meterType === "مقياس") return null;
    const n = Number(am.readingsForRate || tpl.readingsForRate || 0);
    const rows = meterRows(am);
    if (n < 2 || rows.length < n) return null;
    const seg = rows.slice(-n);
    const days = Math.max(1, Math.round((new Date(seg[seg.length - 1].at + "T00:00:00") - new Date(seg[0].at + "T00:00:00")) / 86400000));
    return (seg[seg.length - 1].ltd - seg[0].ltd) / days;
  };
  /* الأولوية: المعدل المحسوب ← المقدّر على مستوى الأصل ← المقدّر بالقالب ← متوسط التاريخ كله */
  const utilRate = (am) => {
    const tpl = db.meterTemplates.find((t) => t.id === am.templateId) || {};
    const calc = calcUtilRate(am);
    if (calc != null && calc > 0) return calc;
    if (Number(am.estDailyRate)) return Number(am.estDailyRate);
    if (Number(tpl.estDailyRate)) return Number(tpl.estDailyRate);
    const rows = meterRows(am);
    if (!rows.length) return 0;
    const span = Math.max(1, Math.round((new Date(today() + "T00:00:00") - new Date(rows[0].at + "T00:00:00")) / 86400000));
    return rows[rows.length - 1].ltd / span;
  };
  const addReading = (am, value, at, opts = {}) => {
    const tpl = db.meterTemplates.find((t) => t.id === am.templateId);
    const v = Number(value);
    const rows = activeReadings(am.id);
    const last = rows.slice(-1)[0] || null;
    if (am.endDate && at > am.endDate) return "العداد معطل (نهاية " + am.endDate + ") — لا قراءات بعد هذا التاريخ";
    if (rows.some((r) => r.at === at)) return "توجد قراءة فعالة بنفس التاريخ";
    if (!opts.historical && last && at < last.at) return "تاريخ القراءة يجب أن يكون بعد آخر قراءة (" + last.at + ") — أو فعّل «قراءة تاريخية»";
    if ((opts.historical || opts.source === "REST" || opts.source === "استيراد") && opts.source && opts.source !== "يدوي" && opts.historical)
      return "القراءة التاريخية من شاشة الإدخال فقط (قاعدة ف5)";
    /* الجار السابق حسب التاريخ (للتاريخية) */
    const prevRow = meterRows(am).filter((r) => r.at < at).slice(-1)[0] || null;
    const prevDisp = prevRow ? prevRow.displayed : Number(am.initial || 0);
    if (opts.rollover) {
      if (!(tpl.rolloverAllowed && tpl.meterType === "مستمر" && tpl.readingType === "مطلق" && tpl.direction === "تصاعدي"))
        return "التدوير متاح فقط للمستمر المطلق التصاعدي مع تفعيله بالقالب";
      if (tpl.rolloverMin !== "" && v < Number(tpl.rolloverMin)) return "بعد التدوير: القيمة ≥ " + tpl.rolloverMin;
      if (v >= prevDisp) return "التدوير يعني قيمة أقل من السابقة (" + prevDisp + ")";
    } else if (opts.isReset) {
      if (tpl.resetAllowed === false) return "التصفير غير مفعّل في هذا القالب";
    } else if (tpl.readingType === "مطلق" && tpl.meterType === "مستمر") {
      if (tpl.direction === "تصاعدي" && v < prevDisp) return "عداد تصاعدي: القيمة يجب أن تكون ≥ " + prevDisp + " (أو استخدم تدوير/تصفير)";
      if (tpl.direction === "تنازلي" && v > prevDisp) return "عداد تنازلي: القيمة يجب أن تكون ≤ " + prevDisp;
    }
    if (tpl.readingType === "تغير" || tpl.meterType === "مقياس") {
      if (tpl.readingType === "تغير" && tpl.direction !== "تنازلي" && v < 0) return "قراءة التغير يجب أن تكون ≥ 0";
      if (tpl.min !== "" && tpl.min != null && v < Number(tpl.min)) return "أقل من الحد الأدنى (" + tpl.min + ")";
      if (tpl.max !== "" && tpl.max != null && v > Number(tpl.max)) return "أعلى من الحد الأقصى (" + tpl.max + ")";
    }
    add("readings", { assetMeterId: am.id, value: v, at,
      source: opts.source || "يدوي", isReset: !!opts.isReset, rollover: !!opts.rollover,
      status: opts.isReset ? "تصفير" : opts.rollover ? "تدوير" : opts.status || "مسجلة",
      comments: opts.comments || "", workOrderId: opts.workOrderId || "" });
    return null;
  };
  /* تعطيل قراءة: تُستبعد من الحسابات (إعادة الحساب تلقائية لأن القيم تُشتق ديناميكيًا) */
  const disableReading = (am, r) => {
    const rows = activeReadings(am.id);
    const isLatest = rows.length && rows[rows.length - 1].id === r.id;
    if (r.status === "أولية") return "لا تُعطّل القراءة الأولية";
    if ((r.status === "تصفير" || r.status === "تدوير") && !isLatest) return "التصفير/التدوير يُعطّل فقط إذا كان آخر قراءة فعالة";
    update("readings", r.id, { status: "معطلة" });
    return null;
  };

  /* فحص PM بعد القراءة (وثيقة الأصول): تنبيهات الاستحقاق والاقتراب */
  const pmCheckAfterReading = (am, newValue) => {
    const alerts = [];
    db.programs.filter((p) => p.method === "فاصل عداد" && p.assetMeterId === am.id).forEach((p) => {
      const tpl = db.meterTemplates.find((t) => t.id === am.templateId);
      const delta = tpl?.readingType === "تغير" ? Number(newValue) : Math.abs(Number(newValue) - currentValue(am));
      const since = ltd(am) + delta - Number(p.lastMeterValue || 0);
      const remaining = Number(p.interval) - since;
      if (remaining <= 0) alerts.push({ program: p, msg: "🔴 «" + p.name + "» مستحق الآن — إنشاء أمر عمل" });
      else if (remaining <= Number(p.interval) * 0.1)
        alerts.push({ program: null, msg: "⏳ «" + p.name + "»: الصيانة مستحقة بعد " + remaining + " " + (tpl?.uom || "وحدة") });
    });
    return alerts;
  };

  /* ───── محرك ضمان المورد (ف6) ───── */
  const dailyRate = (am) => utilRate(am);
  /* تاريخ الانتهاء المتوقع من العدادات: اليوم + (نهاية العداد − العمر) ÷ معدل الاستخدام اليومي */
  const contractCalcExpiration = (c) => {
    const dates = (c.meters || []).map((cm) => {
      const am = db.assetMeters.find((m) => m.assetId === c.assetId && m.templateId === cm.templateId);
      if (!am) return null;
      const endValue = Number(cm.startValue || 0) + Number(cm.interval || 0);
      const rate = dailyRate(am);
      const remaining = endValue - ltd(am);
      if (remaining <= 0) return today();
      if (rate <= 0) return null;
      const d = new Date(today() + "T00:00:00"); d.setDate(d.getDate() + Math.floor(remaining / rate));
      return d.toISOString().slice(0, 10);
    }).filter(Boolean).sort();
    return dates[0] || null;
  };
  const contractEffectiveEnd = (c) => {
    const calc = contractCalcExpiration(c);
    if (c.endDate && calc) return c.endDate < calc ? c.endDate : calc; /* الأقرب انتهاءً */
    return c.endDate || calc || null;
  };
  const contractState = (c) => {
    if (c.status === "مسودة") return "مسودة";
    const end = contractEffectiveEnd(c);
    if (end && daysUntil(end) < 0) return "منتهٍ";
    return "جاهز";
  };
  /* العقود الفعالة للأصل وأصوله المرتبطة (الأب والمكونات التابعة) */
  const activeContracts = (assetId) => {
    const fam = new Set([assetId]);
    const a = db.assets.find((x) => x.id === assetId);
    if (a?.parentId) fam.add(a.parentId);
    db.assets.filter((x) => x.parentId === assetId).forEach((x) => fam.add(x.id));
    return db.contracts.filter((c) => fam.has(c.assetId) && contractState(c) === "جاهز")
      .sort((x, y) => String(contractEffectiveEnd(x) || "9999") < String(contractEffectiveEnd(y) || "9999") ? -1 : 1);
  };
  /* توافق قديم: لافتات الضمان تعمل من العقود أولًا ثم الضمانات البسيطة */
  const activeWarranty = (assetId) => {
    const c = activeContracts(assetId)[0];
    if (c) {
      const cov = db.coverages.find((v) => v.id === c.coverageId);
      return { supplier: nameOf("warrantyProviders", cov?.providerId) !== "—" ? nameOf("warrantyProviders", cov?.providerId) : (cov?.name || "ضمان"), end: contractEffectiveEnd(c) || "" };
    }
    return db.warranties.find((w) => w.assetId === assetId && daysUntil(w.end) >= 0 && (!w.start || daysUntil(w.start) <= 0));
  };
  /* ───── الأصول (ف3): قابلية الاستخدام، السجل، النسخ، التقسيم، وراثة الموقع ───── */
  const assetUsable = (a) => a && a.active !== false && (!a.endDate || a.endDate >= today());
  const nextAssetNumber = () => {
    let n = db.assets.length + 1, num;
    do { num = "AST-" + String(1000 + n); n++; } while (db.assets.some((a) => a.number === num));
    return num;
  };
  const logAsset = (assetId, action, extraPatch = {}) => {
    const a = db.assets.find((x) => x.id === assetId);
    if (!a) return;
    update("assets", assetId, { ...extraPatch, history: [...(a.history || []), { action, at: now(), by: role }] });
  };
  const assetSaveErrors = (d, editingId) => {
    if (!String(d.name || "").trim()) return "اسم الأصل مطلوب";
    if (d.number && db.assets.some((a) => a.number === d.number && a.id !== editingId)) return "رقم الأصل مستخدم — يجب أن يكون فريدًا";
    if (d.serial && db.assets.some((a) => a.serial && a.serial === d.serial && a.id !== editingId)) return "الرقم التسلسلي مستخدم لأصل آخر";
    if (!String(d.location || "").trim()) return "لا أصل بدون موقع (قاعدة النظام)";
    return null;
  };
  /* الهرمية المادية: الفرع يرث موقع الأب الأعلى، وتغيير موقع الأب يحدّث كل الأبناء (ف3 §12) */
  const descendants = (assetId) => {
    const out = [];
    const walk = (id) => db.assets.filter((x) => x.parentId === id).forEach((c) => { out.push(c); walk(c.id); });
    walk(assetId);
    return out;
  };
  const propagateLocation = (assetId, location) => {
    const kids = descendants(assetId);
    if (!kids.length) return 0;
    save({ ...db, assets: db.assets.map((a) => kids.some((k) => k.id === a.id) ? { ...a, location } : a) });
    return kids.length;
  };
  /* نسخ أصل موجود (مع خيار نسخ العدادات) */
  const copyAsset = (a, withMeters) => {
    const created = add("assets", { ...a, id: undefined, number: nextAssetNumber(), name: a.name + " (نسخة)",
      serial: "", parentId: a.parentId || "", notes: [], photos: [], docs: (a.docs || []).map((x) => ({ ...x, id: uid() })),
      parts: (a.parts || []).map((x) => ({ ...x, id: uid() })),
      history: [{ action: "إنشاء بالنسخ من " + a.number, at: now(), by: role }] });
    if (withMeters) db.assetMeters.filter((m) => m.assetId === a.id && (!m.endDate || m.endDate >= today()))
      .forEach((m) => add("assetMeters", { assetId: created.id, templateId: m.templateId, initial: 0, recordAtWO: m.recordAtWO, endDate: "", estDailyRate: m.estDailyRate, readingsForRate: m.readingsForRate }));
    return created;
  };
  /* تقسيم أصل غير مسلسل (ف3 §7): شروط الأهلية ثم وحدات كمية = 1 */
  const splitAsset = (a) => {
    const qty = Number(a.quantity || 1);
    if (a.serial) return "الأصل مسلسل — لا يقبل التقسيم";
    if (!(Number.isInteger(qty) && qty > 1)) return "الكمية يجب أن تكون عددًا صحيحًا أكبر من 1";
    if (a.endDate && a.endDate < today()) return "الأصل منتهٍ — لا تقسيم";
    if (db.workOrders.some((w) => w.assetId === a.id && ACTIVE_STATES.includes(w.status))) return "يوجد أمر عمل مفتوح على الأصل — أغلقه أولًا";
    const newOnes = [];
    for (let i = 2; i <= qty; i++) {
      const c = add("assets", { ...a, id: undefined, number: nextAssetNumber(), name: a.name + " /" + i, quantity: 1,
        notes: [], photos: [], docs: [], parts: (a.parts || []).map((x) => ({ ...x, id: uid() })),
        history: [{ action: "إنشاء بالتقسيم من " + a.number, at: now(), by: role }] });
      newOnes.push(c.number);
    }
    logAsset(a.id, "تقسيم إلى " + qty + " وحدات: " + newOnes.join("، "), { quantity: 1 });
    return null;
  };

  /* ───── قواعد مجموعات الأصول (ف4) ───── */
  const groupRule = (g) => db.assetGroupRules.find((r) => r.id === g.ruleId);
  const groupActive = (g) => !g.inactiveOn || g.inactiveOn >= today();
  const activeAssignments = (g) => (g.assignments || []).filter((x) => !x.end);
  /* أهلية الأصل للمجموعة: المجموعة فعالة + الأصل نشط + تطابق الخصائص + قيد الفريد ضمن القاعدة */
  const canAssignAsset = (asset, g) => {
    if (!asset || asset.active === false) return "الأصل منتهٍ/موقوف";
    if (!groupActive(g)) return "المجموعة معطلة — لا تعيينات جديدة";
    if (activeAssignments(g).some((x) => x.assetId === asset.id)) return "معين مسبقًا";
    const rule = groupRule(g);
    for (const attr of (rule?.attributes || [])) {
      const want = (g.attrValues || {})[attr];
      if (want && String(asset[attr] || "") !== String(want)) return "لا يطابق خاصية " + (GROUP_ATTRS.find(([k]) => k === attr)?.[1] || attr);
    }
    if (rule?.enforceUnique) {
      const other = db.assetGroups.find((og) => og.ruleId === rule.id && og.id !== g.id && activeAssignments(og).some((x) => x.assetId === asset.id));
      if (other) return "تعيين فريد: الأصل في «" + other.name + "» ضمن نفس القاعدة";
    }
    return null;
  };
  const syncIds = (g, assignments) => ({ assignments, assetIds: assignments.filter((x) => !x.end).map((x) => x.assetId) });
  const assignAsset = (g, assetId) => {
    const err = canAssignAsset(db.assets.find((a) => a.id === assetId), g);
    if (err) return err;
    const assignments = [...(g.assignments || []), { id: uid(), assetId, start: today(), end: "", endReason: "", by: role }];
    update("assetGroups", g.id, syncIds(g, assignments));
    return null;
  };
  const unassignAsset = (g, assignmentId, reason) => {
    const assignments = (g.assignments || []).map((x) => x.id === assignmentId ? { ...x, end: today(), endReason: reason || "إلغاء يدوي" } : x);
    update("assetGroups", g.id, syncIds(g, assignments));
  };
  /* إعادة التحقق: تغيّر الأصل ← أنهِ التعيين بسبب واضح بدل الحذف (ف4 §13) */
  const revalidateGroup = (g) => {
    const rule = groupRule(g);
    const bad = [];
    const assignments = (g.assignments || []).map((x) => {
      if (x.end) return x;
      const a = db.assets.find((z) => z.id === x.assetId);
      let reason = "";
      if (!a || a.active === false) reason = "إنهاء الأصل";
      else for (const attr of (rule?.attributes || [])) {
        const want = (g.attrValues || {})[attr];
        if (want && String(a[attr] || "") !== String(want)) { reason = "تغير بيانات الأصل"; break; }
      }
      if (reason) { bad.push((a?.name || "أصل") + " (" + reason + ")"); return { ...x, end: today(), endReason: reason }; }
      return x;
    });
    update("assetGroups", g.id, syncIds(g, assignments));
    return bad;
  };
  /* استبعادات قاعدة «حالة الأصل»: منع طلبات/أوامر العمل لأصول المجموعة */
  const assetExclusion = (assetId) => {
    for (const g of db.assetGroups) {
      if (!groupActive(g)) continue;
      if (!activeAssignments(g).some((x) => x.assetId === assetId)) continue;
      if (g.excludeFromWO || g.excludeFromRequests)
        return { wo: !!g.excludeFromWO, requests: !!g.excludeFromRequests, groupName: g.name };
    }
    return { wo: false, requests: false, groupName: "" };
  };

  /* توليد الاستحقاقات وتجميعها في مطالبة (يحاكي الـ Scheduled Process) */
  const generateEntitlements = (wo) => {
    if (!wo.warrantyRepair) { alert("مؤشر «إصلاح ضمان» غير مفعّل لهذا الأمر — لا تُنشأ استحقاقات (قاعدة ف6)"); return; }
    const cs = activeContracts(wo.assetId);
    if (!cs.length) { alert("لا عقود ضمان فعالة للأصل أو أصوله المرتبطة"); return; }
    const contract = cs[0]; /* الأقرب انتهاءً */
    const cov = db.coverages.find((v) => v.id === contract.coverageId) || {};
    const provId = cov.providerId || "";
    const codes = (cov.repairCodes || []).filter((r) => r.enabled !== false).map((r) => r.code);
    const useMatch = !!wo.matchCodes && codes.length > 0;
    const opCovered = (op) => !useMatch || codes.some((cd) => String(op.repairTx || "").startsWith(cd));
    const anyOpCovered = (wo.operations || []).some(opCovered);
    const findRate = () => {
      const r = db.laborRates.find((x) => x.providerId === provId && x.active !== false && (!x.startDate || x.startDate <= (contract.startDate || today())) && (!x.endDate || x.endDate >= (contract.startDate || today())));
      return r ? Number(r.hourlyRate || 0) : null;
    };
    const hourly = findRate();
    const ents = [];
    (wo.materials || []).forEach((m) => {
      const used = Number(m.usedQty || 0);
      if (used <= 0) return;
      const covd = anyOpCovered;
      ents.push({ id: uid(), workOrderId: wo.id, type: "صرف مادة", description: m.itemId ? nameOf("items", m.itemId) : m.name,
        qty: used, unitCost: Number(m.unitCost || 0), total: used * Number(m.unitCost || 0),
        contractId: covd ? contract.id : "", included: covd && cov.partsReimb !== false && !!cov.partsReimb, claimId: "" });
    });
    (wo.operations || []).filter((o) => o.status === "مكتملة").forEach((op) => {
      const covd = opCovered(op);
      const srt = db.repairTimes.find((t) => t.providerId === provId && t.stdOpId === op.stdOpId && t.active !== false && (!t.startDate || t.startDate <= (contract.startDate || today())));
      const tech = db.technicians.find((t) => t.id === op.assigneeId);
      const rate = hourly != null ? hourly : Number(tech?.rate || 0);
      if (srt) ents.push({ id: uid(), workOrderId: wo.id, type: "إصلاح قياسي", description: op.name + " (زمن قياسي)",
        qty: Number(srt.hours || 0), unitCost: rate, total: Number(srt.hours || 0) * rate,
        contractId: covd ? contract.id : "", included: covd && !!cov.laborReimb, claimId: "" });
      else if (Number(op.actualHours || 0) > 0) ents.push({ id: uid(), workOrderId: wo.id, type: "تحميل مورد", description: op.name,
        qty: Number(op.actualHours || 0), unitCost: rate, total: Number(op.actualHours || 0) * rate,
        contractId: covd ? contract.id : "", included: covd && !!cov.laborReimb, claimId: "" });
    });
    if (!ents.length) { alert("لا معاملات (مواد مستخدمة أو ساعات) لتوليد استحقاقات منها"); return; }
    /* أزل توليدًا سابقًا لنفس الأمر ومطالباته التلقائية */
    const oldEnts = db.entitlements.filter((e) => e.workOrderId === wo.id);
    const oldClaimIds = new Set(oldEnts.map((e) => e.claimId).filter(Boolean));
    let claims = db.claims.filter((c) => !(oldClaimIds.has(c.id) && c.auto));
    let entitlements = db.entitlements.filter((e) => e.workOrderId !== wo.id);
    const included = ents.filter((e) => e.included);
    if (included.length) {
      const claim = { id: uid(), number: "CLM-" + String(1000 + claims.length + 1), workOrderId: wo.id,
        providerId: provId, status: "قيد المراجعة", auto: true, createdAt: today(), submitBy: "", assignedTo: "", notes: "", adjustments: [], reimbursementAmount: "", claimType: "" };
      included.forEach((e) => { e.claimId = claim.id; });
      claims = [...claims, claim];
    }
    entitlements = [...entitlements, ...ents];
    save({ ...db, entitlements, claims });
    alert("✓ أُنشئ " + ents.length + " استحقاق (" + included.length + " ضمن مطالبة" + (included.length ? " " + "CLM-" + String(1000 + claims.length) : "") + ")\n" +
      (useMatch ? "تمت مطابقة أكواد الإصلاح مع التغطية." : "بدون مطابقة أكواد — اعتمد على العقد الفعال الأقرب انتهاءً."));
  };

  /* ───── المخزون: الرصيد من الحركات فقط (لا تعديل مباشر) ───── */
  const onHand = (itemId, whId) => db.stockTx.reduce((s, t) => {
    if (t.itemId !== itemId) return s;
    const q = Number(t.qty || 0);
    if (whId && t.type === "تحويل") return s + (t.toWarehouseId === whId ? q : 0) - (t.warehouseId === whId ? q : 0);
    if (whId && t.warehouseId !== whId) return s;
    if (t.type === "استلام" || t.type === "إرجاع من أمر عمل") return s + q;
    if (t.type === "صرف لأمر عمل" || t.type === "إتلاف") return s - q;
    if (t.type === "تسوية") return s + q;
    if (t.type === "تحويل") return s; /* بدون مستودع: التحويل لا يغيّر الإجمالي */
    return s;
  }, 0);
  /* المحجوز لأوامر العمل المفتوحة (لم يُصرف بعد) */
  const reservedQty = (itemId) => db.workOrders.reduce((s, w) =>
    ACTIVE_STATES.includes(w.status)
      ? s + (w.materials || []).reduce((x, m) => x + (m.itemId === itemId && m.reserved && !Number(m.issuedQty || 0) ? Number(m.qty || 0) : 0), 0)
      : s, 0);
  const availableQty = (itemId) => onHand(itemId) - reservedQty(itemId);
  const addTx = (tx) => add("stockTx", { at: today(), ...tx });
  /* فحص توفر مواد أمر العمل (قاعدة: لا إصدار بدون فحص التوفر) */
  const woShortages = (wo) => (wo.materials || []).filter((m) =>
    m.itemId && !Number(m.issuedQty || 0) && Number(m.qty || 0) > availableQty(m.itemId) + (m.reserved ? Number(m.qty || 0) : 0));

  /* أوامر العمل */
  const woNumber = () => "WO-" + String(1000 + db.workOrders.length + 1);
  const log = (wo, action) => [...(wo.execLog || []), { action, at: now(), by: role + (db.settings.myTechId ? " — " + nameOf("technicians", db.settings.myTechId) : "") }];
  const createWO = (data) => {
    const asset = db.assets.find((a) => a.id === data.assetId);
    if (asset && !assetUsable(asset)) { alert("⛔ الأصل منتهٍ/موقوف (" + (asset.endDate ? "تاريخ الإنهاء " + fmt(asset.endDate) : "موقوف") + ") — لا أوامر عمل"); return; }
    if (asset && asset.allowWO === false) { alert("⛔ هذا الأصل لا يسمح بأوامر العمل (علم الأصل)"); return; }
    if (asset && asset.defaultWOType && !data.type) data.type = asset.defaultWOType;
    const exc = assetExclusion(data.assetId);
    if (exc.wo) { alert("⛔ الأصل مستبعد من أوامر العمل بواسطة مجموعة التحقق «" + exc.groupName + "» (قاعدة حالة الأصل)"); return; }
    const def = db.workDefs.find((d) => d.id === data.workDefId);
    const operations = (def?.opIds || []).map((opId, i) => {
      const op = db.stdOps.find((o) => o.id === opId);
      /* أمر العمل يأخذ نسخة (Copy) من العملية القياسية — تعديلها لاحقًا لا يغيّر الأمر (ف7 §22) */
      return { id: uid(), seq: (i + 1) * 10, stdOpId: opId, name: op?.name || "عملية", workCenterId: op?.workCenterId || "",
        minutes: op?.minutes || "", status: "معلقة", assigneeId: "", actualHours: 0,
        opType: op?.type || "داخلية", supplier: op?.supplier || "",
        attachments: (op?.attachments || []).map((a) => ({ ...a })),
        repairReason: op?.repairReason || "", repairTx: op?.repairTx || "", workDone: op?.workDone || "",
        chargeType: (op?.resources || [])[0]?.chargeType || "يدوي" };
    });
    const checklist = data.safetyRequired ? SAFETY_DEFAULTS.map((t) => ({ id: uid(), text: t, done: false })) : [];
    const w = activeWarranty(data.assetId);
    if (w && ["تصحيحي", "طارئ"].includes(data.type))
      alert("⚠ تنبيه: هذا الأصل تحت ضمان ساري لدى «" + w.supplier + "» حتى " + fmt(w.end) + ".\nراجع الضمان قبل تحميل تكلفة إصلاح داخلي.");
    /* مؤشرات الضمان (ف6): الوقائي الناتج من برنامج لا يكون إصلاح ضمان افتراضيًا */
    const wcs = activeContracts(data.assetId);
    const wCov = wcs[0] ? db.coverages.find((v) => v.id === wcs[0].coverageId) : null;
    data.warrantyRepair = wcs.length > 0 && data.type !== "وقائي";
    data.matchCodes = !!(wCov && (wCov.repairCodes || []).some((r) => r.enabled !== false));
    add("workOrders", { number: woNumber(), status: "مسودة", operations, checklist, materials: [], photos: [],
      failure: null, exceptions: [], execLog: [{ action: "إنشاء أمر العمل", at: now(), by: role }],
      history: [{ to: "مسودة", at: today() }], underWarranty: !!w, ...data });
  };
  const setWOStatus = (wo, next, extra = {}) => {
    update("workOrders", wo.id, {
      status: next, ...extra,
      history: [...(wo.history || []), { from: wo.status, to: next, at: today() }],
      execLog: log(wo, "تغيير الحالة: " + wo.status + " ← " + next),
      ...(next === "مغلق" ? { completedAt: today() } : {}),
    });
    if (next === "مغلق" && wo.programId) update("programs", wo.programId, { lastDone: today() });
  };

  /* بوابات التحقق قبل طلب الإكمال (وثيقة التنفيذ §12) */
  const completionGaps = (wo) => {
    const gaps = [];
    if ((wo.checklist || []).some((c) => !c.done)) gaps.push("قائمة فحص السلامة غير مكتملة");
    if ((wo.operations || []).some((o) => o.status !== "مكتملة")) gaps.push("توجد عمليات غير مكتملة");
    const hours = (wo.operations || []).reduce((s, o) => s + Number(o.actualHours || 0), 0);
    if (hours <= 0) gaps.push("لم تُسجّل ساعات عمل");
    if ((wo.materials || []).some((m) => Number(m.issuedQty || 0) > 0 && (m.usedQty === "" || m.usedQty == null))) gaps.push("أكّد كميات المواد المستخدمة");
    if (["تصحيحي", "طارئ"].includes(wo.type) && !wo.failure) gaps.push("سجّل بيانات العطل (إلزامي للتصحيحي/الطارئ)");
    if ((wo.routeAssets || []).some((x) => x.status === "معلق")) gaps.push("أكمل أو تخطَّ كل أصول المسار");
    const mandMeters = db.assetMeters.filter((m) => m.assetId === wo.assetId && !(m.endDate && m.endDate < today()) &&
      ((m.recordAtWO || db.meterTemplates.find((t) => t.id === m.templateId)?.recordAtWO) === "إلزامي"));
    if (mandMeters.some((m) => !db.readings.some((r) => r.workOrderId === wo.id && r.assetMeterId === m.id && !["معطلة", "ملغاة"].includes(r.status))))
      gaps.push("سجّل قراءات العدادات الإلزامية عند الإكمال");
    if (wo.photoRequired) {
      const types = (wo.photos || []).map((p) => p.type);
      if (!types.includes("قبل")) gaps.push("صورة قبل العمل مطلوبة");
      if (!types.includes("بعد")) gaps.push("صورة بعد العمل مطلوبة");
    }
    return gaps;
  };

  /* تكلفة أمر العمل: عمالة + مواد مستخدمة فعليًا */
  const woCost = (wo) => {
    let labor = 0, material = 0;
    for (const op of wo.operations || []) {
      const tech = db.technicians.find((t) => t.id === op.assigneeId);
      labor += Number(op.actualHours || 0) * Number(tech?.rate || 0);
    }
    for (const m of wo.materials || []) material += Number(m.usedQty || 0) * Number(m.unitCost || 0);
    return { labor, material, total: labor + material };
  };

  /* ───── البرامج: على أصل واحد أو مجموعة ───── */
  const programAssets = (p) => (p.targetType === "مجموعة"
    ? (db.assetGroups.find((g) => g.id === p.assetGroupId)?.assetIds || []).map((id) => db.assets.find((a) => a.id === id)).filter(Boolean)
    : [db.assets.find((a) => a.id === p.assetId)].filter(Boolean))
    .filter((a) => assetUsable(a) && a.allowPrograms !== false);
  const programDue = (p) => {
    if (p.method === "فاصل عداد") {
      const am = db.assetMeters.find((m) => m.id === p.assetMeterId);
      if (!am) return { due: false, label: "عداد غير محدد" };
      const since = ltd(am) - Number(p.lastMeterValue || 0);
      const rem = Number(p.interval) - since;
      return { due: since >= Number(p.interval), soon: rem > 0 && rem <= Number(p.interval) * 0.1,
        label: since + " / " + p.interval + " " + nameOf("meterTemplates", am.templateId, "uom") + (rem > 0 ? " (متبقٍ " + rem + ")" : "") };
    }
    const base = p.lastDone || p.startDate || today();
    const d = new Date(base + "T00:00:00"); d.setDate(d.getDate() + Number(p.interval));
    const nd = d.toISOString().slice(0, 10);
    return { due: daysUntil(nd) <= 0, soon: daysUntil(nd) > 0 && daysUntil(nd) <= 7, label: "الاستحقاق " + fmt(nd), nextDate: nd };
  };
  const generateWO = (p) => {
    const info = programDue(p);
    const targets = programAssets(p);
    targets.forEach((a) => {
      createWO({ title: "صيانة وقائية — " + p.name + (targets.length > 1 ? " (" + a.name + ")" : ""),
        assetId: a.id, type: "وقائي", priority: "عادية",
        plannedStart: today(), plannedEnd: info.nextDate || today(), workDefId: p.workDefId, programId: p.id, safetyRequired: true });
    });
    if (targets.length > 1) alert("أُنشئ " + targets.length + " أمر عمل — واحد لكل أصل في المجموعة");
    if (p.method === "فاصل عداد") {
      const am = db.assetMeters.find((m) => m.id === p.assetMeterId);
      update("programs", p.id, { lastMeterValue: am ? ltd(am) : 0 });
    } else update("programs", p.id, { lastDone: today() });
  };

  /* طلبات العمل */
  const actRequest = (req, action) => {
    if (action === "قبول") update("workRequests", req.id, { status: "مقبول" });
    if (action === "رفض") update("workRequests", req.id, { status: "مرفوض" });
    if (action === "تحويل لأمر عمل") {
      update("workRequests", req.id, { status: "محوّل" });
      createWO({ title: req.title, assetId: req.assetId, type: req.severity === "حرجة" ? "طارئ" : "تصحيحي",
        priority: req.severity === "حرجة" ? "طارئ" : "عالية", plannedStart: today(), plannedEnd: "", safetyRequired: true });
    }
  };

  /* نسخ احتياطي */
  const exportData = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "cmms-backup-" + today() + ".json"; a.click();
  };
  /* تصدير سجل الأصول CSV (وثيقة الأصول §Export_Assets) */
  const exportAssetsCSV = () => {
    const head = "رقم الأصل,الاسم,النوع,المجموعة,الموقع,الأصل الأب,حرج,نشط";
    const rows = db.assets.map((a) => [a.number, a.name, a.type,
      db.assetGroups.find((g) => (g.assetIds || []).includes(a.id))?.name || "",
      a.location, a.parentId ? nameOf("assets", a.parentId) : "", a.critical ? "نعم" : "لا", a.active === false ? "لا" : "نعم"
    ].map((x) => '"' + String(x || "").replace(/"/g, '""') + '"').join(","));
    const blob = new Blob(["\uFEFF" + [head, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "asset-register-" + today() + ".csv"; a.click();
  };
  const importData = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { save(normalizeDb(JSON.parse(reader.result))); alert("تم الاستيراد بنجاح"); }
      catch (e) { alert("ملف غير صالح"); }
    };
    reader.readAsText(file);
  };

  if (!loaded) return <div style={{ minHeight: "100vh", background: C.paper, display: "grid", placeItems: "center" }}>جارٍ التحميل…</div>;

  const openWOs = db.workOrders.filter((w) => ACTIVE_STATES.includes(w.status));
  const ctx = { db, add, update, remove, nameOf, lastReading, ltd, addReading, meterReadings, currentValue,
    can, role, woCost, completionGaps, setWOStatus, log, createWO, myTechId: db.settings.myTechId,
    activeWarranty, pmCheckAfterReading, programAssets, generateWO, exportAssetsCSV,
    onHand, reservedQty, availableQty, addTx, woShortages,
    activeContracts, contractState, contractEffectiveEnd, contractCalcExpiration, dailyRate, generateEntitlements, save,
    meterRows, activeReadings, calcUtilRate, utilRate, disableReading,
    groupRule, groupActive, activeAssignments, canAssignAsset, assignAsset, unassignAsset, revalidateGroup, assetExclusion,
    assetUsable, nextAssetNumber, logAsset, assetSaveErrors, descendants, propagateLocation, copyAsset, splitAsset };

  const MAIN_TABS = can.requestOnly
    ? [["home", "الرئيسية"], ["requests", "طلباتي"]]
    : role === "فني"
      ? [["home", "الرئيسية"], ["mywork", "أعمالي"], ["wo", "أوامر العمل"], ["more", "المزيد"]]
      : role === "مخزن"
        ? [["home", "الرئيسية"], ["inventory", "المخزون"], ["wo", "أوامر العمل"], ["more", "المزيد"]]
        : [["home", "الرئيسية"], ["wo", "أوامر العمل"], ["super", "الإشراف"], ["assets", "الأصول"], ["more", "المزيد"]];
  const MORE = [
    ["inventory", "المخزون وقطع الغيار"], ["mywork", "قائمة الإرسال"], ["requests", "طلبات العمل"], ["programs", "البرامج الوقائية"], ["forecast", "توقعات الصيانة"],
    ["meters", "العدادات"], ["assets", "الأصول"], ["org", "منظمة الصيانة"], ["techs", "الفنيون"],
    ["groups", "مجموعات الأصول"], ["lh", "الهرميات والمسارات"], ["warranty", "الضمانات"], ["stdops", "العمليات القياسية"], ["workdefs", "تعريفات العمل"],
    ["failures", "تحليل الأعطال"], ["reports", "التقارير"], ["data", "البيانات والنسخ"],
  ];

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: C.paper, color: C.ink, fontFamily: "'Cairo', system-ui, sans-serif", paddingBottom: 76 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;800&display=swap');
        button { cursor: pointer; font-family: inherit; }
        input, select, textarea { font-size: 16px; font-family: inherit; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
      `}</style>

      <header style={{ padding: "12px 16px 8px", borderBottom: `2px solid ${C.ink}`, position: "sticky", top: 0, zIndex: 5, background: C.paper }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 21, fontWeight: 800 }}>نظام الصيانة<span style={{ color: C.orange }}>.</span></div>
            <div style={{ fontSize: 12, color: C.steel }}>{db.assets.length} أصل · {openWOs.length} أمر مفتوح</div>
            <div style={{ fontSize: 11, color: syncStatus.includes("الخادم") && !syncStatus.includes("غير") && !syncStatus.includes("فشل") ? C.green : C.amber }}>{syncStatus}</div>
          </div>
          <select value={role} onChange={(e) => setSetting("role", e.target.value)}
            style={{ border: `1.5px solid ${C.ink}`, borderRadius: 4, padding: "4px 8px", fontSize: 13, fontWeight: 700, background: "#fff" }}>
            {ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        {role === "فني" && (
          <select value={db.settings.myTechId} onChange={(e) => setSetting("myTechId", e.target.value)}
            style={{ marginTop: 6, width: "100%", border: `1.5px solid ${C.line}`, borderRadius: 4, padding: "4px 8px", fontSize: 13 }}>
            <option value="">— اختر اسمك من قائمة الفنيين —</option>
            {db.technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
      </header>

      <main style={{ padding: 14, maxWidth: 600, margin: "0 auto" }}>
        {tab === "home" && <Home db={db} nameOf={nameOf} programDue={programDue} generateWO={generateWO} setTab={setTab} openWO={setWoDetail} can={can} />}
        {tab === "wo" && <WorkOrders ctx={ctx} openWO={setWoDetail} />}
        {tab === "mywork" && <MyWork ctx={ctx} openWO={setWoDetail} />}
        {tab === "assets" && <Assets ctx={ctx} openAsset={setAssetDetail} />}
        {tab === "inventory" && <Inventory ctx={ctx} openWO={setWoDetail} />}
        {tab === "lh" && <LogicalHierarchies ctx={ctx} openAsset={setAssetDetail} />}
        {tab === "more" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {MORE.map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={{ ...card(), padding: "16px 12px", fontWeight: 700, fontSize: 14, textAlign: "right" }}>{label}</button>
            ))}
          </div>
        )}
        {tab === "org" && <Organization ctx={ctx} />}
        {tab === "techs" && <Crud ctx={ctx} entity="technicians" title="الفنيون" schema={[
          { k: "name", label: "اسم الفني" },
          { k: "specialty", label: "التخصص", type: "select", options: ["ميكانيكي", "كهربائي", "عام"] },
          { k: "workCenterId", label: "مركز العمل", type: "select", from: "workCenters", fromKey: "name" },
          { k: "rate", label: "أجر الساعة (ر.س)", type: "number" }, { k: "phone", label: "الجوال" },
        ]} render={(t) => [t.name, [t.specialty, nameOf("workCenters", t.workCenterId) !== "—" ? nameOf("workCenters", t.workCenterId) : "", t.rate ? money(t.rate) + "/ساعة" : ""].filter(Boolean).join(" · ")]} />}
        {tab === "groups" && <AssetGroups ctx={ctx} />}
        {tab === "meters" && <Meters ctx={ctx} />}
        {tab === "warranty" && <WarrantyHub ctx={ctx} openWO={setWoDetail} />}
        {tab === "stdops" && <StdOpsManager ctx={ctx} />}
        {tab === "workdefs" && <WorkDefs ctx={ctx} />}
        {tab === "requests" && <Requests ctx={ctx} actRequest={actRequest} />}
        {tab === "programs" && <Programs ctx={ctx} programDue={programDue} generateWO={generateWO} />}
        {tab === "forecast" && <Forecast ctx={ctx} programDue={programDue} generateWO={generateWO} />}
        {tab === "super" && <Supervision ctx={ctx} openWO={setWoDetail} />}
        {tab === "failures" && <FailureAnalysis ctx={ctx} openWO={setWoDetail} />}
        {tab === "reports" && <Reports db={db} woCost={woCost} nameOf={nameOf} />}
        {tab === "data" && <DataTab exportData={exportData} importData={importData} exportAssetsCSV={exportAssetsCSV} db={db} can={can} save={save} />}
      </main>

      {woDetail && <WODetail ctx={ctx} woId={woDetail} onClose={() => setWoDetail(null)}
        openAsset={(id) => { setWoDetail(null); setAssetDetail(id); }} />}
      {assetDetail && <AssetDetail ctx={ctx} assetId={assetDetail} onClose={() => setAssetDetail(null)}
        openWO={(id) => { setAssetDetail(null); setWoDetail(id); }} />}

      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", borderTop: `2px solid ${C.ink}`, background: C.card, zIndex: 6 }}>
        {MAIN_TABS.map(([id, label]) => {
          const on = tab === id || (id === "more" && !MAIN_TABS.some(([t]) => t === tab));
          return <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: "12px 0 14px", border: "none", fontWeight: 800, fontSize: 12.5, background: on ? C.ink : C.card, color: on ? "#fff" : C.ink }}>{label}</button>;
        })}
      </nav>
    </div>
  );
}

/* ───────────────────────── الرئيسية ───────────────────────── */
function Home({ db, nameOf, programDue, generateWO, setTab, openWO, can }) {
  const open = db.workOrders.filter((w) => ACTIVE_STATES.includes(w.status));
  const overdue = open.filter((w) => w.plannedEnd && daysUntil(w.plannedEnd) < 0);
  const pendingReview = db.workOrders.filter((w) => w.status === "بانتظار المراجعة");
  const emergency = open.filter((w) => w.priority === "طارئ" || w.type === "طارئ");
  const newReqs = db.workRequests.filter((r) => r.status === "مفتوح");
  const duePrograms = can.manage ? db.programs.filter((p) => programDue(p).due) : [];
  const soonPrograms = can.manage ? db.programs.filter((p) => { const i = programDue(p); return !i.due && i.soon; }) : [];
  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Stat n={emergency.length} label="طارئ" color={emergency.length ? C.red : C.steel} />
        <Stat n={overdue.length} label="متأخر" color={overdue.length ? C.red : C.steel} />
        <Stat n={pendingReview.length} label="بانتظار المراجعة" color={pendingReview.length ? C.blue : C.steel} />
        <Stat n={open.length} label="مفتوح" color={C.ink} />
      </div>

      {soonPrograms.length > 0 && (
        <Section title="⏳ تنبيه: صيانة مستحقة قريبًا">
          {soonPrograms.map((p) => (
            <div key={p.id} style={{ ...card(), borderRightColor: C.amber }}>
              <Row main={p.name} sub={nameOf("assets", p.assetId) + " · " + programDue(p).label} />
            </div>
          ))}
        </Section>
      )}
      {duePrograms.length > 0 && (
        <Section title="برامج وقائية مستحقة">
          {duePrograms.map((p) => (
            <div key={p.id} style={card()}>
              <Row main={p.name} sub={nameOf("assets", p.assetId) + " · " + programDue(p).label}
                action={<Btn bg={C.orange} onClick={() => generateWO(p)}>إنشاء أمر عمل</Btn>} />
            </div>
          ))}
        </Section>
      )}

      <Section title="يحتاج انتباهك">
        {[...emergency, ...overdue, ...pendingReview, ...newReqs].length === 0 && <Empty text="لا شيء عاجل. كل شيء تحت السيطرة." />}
        {emergency.map((w) => (
          <div key={w.id} style={{ ...card(), borderRightColor: C.red }} onClick={() => openWO(w.id)}>
            <Row main={"🚨 " + w.number + " — " + w.title} sub={nameOf("assets", w.assetId)} badge={{ text: w.status, color: WO_COLORS[w.status] }} />
          </div>
        ))}
        {overdue.filter((w) => !emergency.includes(w)).map((w) => (
          <div key={w.id} style={card()} onClick={() => openWO(w.id)}>
            <Row main={w.number + " — " + w.title} sub={"متأخر منذ " + fmt(w.plannedEnd)} badge={{ text: w.status, color: WO_COLORS[w.status] }} />
          </div>
        ))}
        {can.review && pendingReview.map((w) => (
          <div key={w.id} style={card()} onClick={() => openWO(w.id)}>
            <Row main={w.number + " — " + w.title} sub="أكمله الفني — بانتظار اعتمادك" badge={{ text: "راجِع", color: C.blue }} />
          </div>
        ))}
        {newReqs.map((r) => (
          <div key={r.id} style={card()} onClick={() => setTab("requests")}>
            <Row main={"طلب: " + r.title} sub={nameOf("assets", r.assetId) + " · خطورة " + r.severity} badge={{ text: "مفتوح", color: C.amber }} />
          </div>
        ))}
      </Section>
    </>
  );
}

/* ───────────────────────── أعمالي / قائمة الإرسال (وثيقة التنفيذ §2,§5) ───────────────────────── */
function MyWork({ ctx, openWO }) {
  const { db, nameOf, role, myTechId } = ctx;
  const [view, setView] = useState("اليوم");
  const isTech = role === "فني";
  let wos = db.workOrders.filter((w) => ACTIVE_STATES.includes(w.status) && !["مسودة", "مُصدر"].includes(w.status));
  /* الفني لا يرى غير المسند إليه (قاعدة) */
  if (isTech && myTechId) wos = wos.filter((w) => (w.operations || []).some((o) => o.assigneeId === myTechId));
  const VIEWS = {
    "اليوم": (w) => !w.plannedStart || daysUntil(w.plannedStart) <= 0,
    "متأخر": (w) => w.plannedEnd && daysUntil(w.plannedEnd) < 0,
    "طارئ": (w) => w.priority === "طارئ" || w.type === "طارئ",
    "قيد التنفيذ": (w) => w.status === "قيد التنفيذ",
    "بانتظار مواد": (w) => w.status === "بانتظار مواد",
    "مُعاد للتصحيح": (w) => w.status === "مُعاد للتصحيح",
    "بانتظار المراجعة": (w) => w.status === "بانتظار المراجعة",
  };
  const list = wos.filter(VIEWS[view]);
  return (
    <>
      {isTech && !myTechId && <Empty text="اختر اسمك من القائمة في الأعلى لعرض مهامك." />}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12 }}>
        {Object.keys(VIEWS).map((v) => {
          const n = wos.filter(VIEWS[v]).length;
          return <Chip key={v} active={view === v} onClick={() => setView(v)}>{v}{n > 0 ? " (" + n + ")" : ""}</Chip>;
        })}
      </div>
      {list.length === 0 && <Empty text={"لا مهام في «" + view + "»."} />}
      {list.map((w) => <TaskCard key={w.id} w={w} ctx={ctx} onClick={() => openWO(w.id)} />)}
    </>
  );
}

/* بطاقة المهمة (وثيقة التنفيذ §بطاقة المهمة) */
function TaskCard({ w, ctx, onClick }) {
  const { nameOf, activeWarranty } = ctx;
  const matStatus = (w.materials || []).length === 0 ? "" :
    (w.materials || []).every((m) => Number(m.issuedQty || 0) > 0) ? "المواد: متوفرة" : "المواد: ناقصة";
  return (
    <div style={{ ...card(), borderRightColor: w.priority === "طارئ" ? C.red : C.ink }} onClick={onClick}>
      <Row main={w.number + " — " + w.title} badge={{ text: w.status, color: WO_COLORS[w.status] }}
        sub={[nameOf("assets", w.assetId), w.type, "أولوية " + w.priority,
          w.plannedStart ? "البدء " + fmt(w.plannedStart) : "", matStatus,
          w.safetyRequired ? "🔒 سلامة" : "", activeWarranty(w.assetId) ? "🛡 ضمان" : ""].filter(Boolean).join(" · ")} />
      {w.status === "مُعاد للتصحيح" && w.reviewNotes && (
        <div style={{ fontSize: 12.5, color: C.red, marginTop: 4 }}>ملاحظات المشرف: {w.reviewNotes}</div>
      )}
    </div>
  );
}

/* ───────────────────────── أوامر العمل ───────────────────────── */
function WorkOrders({ ctx, openWO }) {
  const { db, nameOf, can, createWO } = ctx;
  const [form, setForm] = useState(false);
  const [filter, setFilter] = useState("الكل");
  const [q, setQ] = useState("");
  const list = db.workOrders.filter((w) =>
    (filter === "الكل" || w.status === filter) && (!q || (w.title + w.number).includes(q)));
  return (
    <>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 بحث…" style={{ ...input, marginBottom: 10 }} />
      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12 }}>
        {["الكل", ...WO_FLOW, ...WO_EXTRA].map((s) => <Chip key={s} active={filter === s} onClick={() => setFilter(s)}>{s}</Chip>)}
      </div>
      {can.manage && <Btn bg={C.orange} onClick={() => setForm(true)} style={{ width: "100%", padding: 12, marginBottom: 12 }}>+ أمر عمل جديد</Btn>}
      {list.length === 0 && <Empty text="لا توجد أوامر عمل هنا." />}
      {list.map((w) => <TaskCard key={w.id} w={w} ctx={ctx} onClick={() => openWO(w.id)} />)}
      {form && (
        <FormSheet title="أمر عمل جديد" onClose={() => setForm(false)} db={db}
          schema={[
            { k: "title", label: "وصف العمل" },
            { k: "assetId", label: "الأصل (إلزامي)", type: "select", from: "assets", fromKey: "name" },
            { k: "type", label: "النوع", type: "select", options: ["تصحيحي", "وقائي", "طارئ"] },
            { k: "priority", label: "الأولوية", type: "select", options: ["منخفضة", "عادية", "عالية", "طارئ"] },
            { k: "workDefId", label: "تعريف العمل (ينسخ عملياته)", type: "select", from: "workDefs", fromKey: "name" },
            { k: "plannedStart", label: "البدء المخطط", type: "date" }, { k: "plannedEnd", label: "الانتهاء المخطط", type: "date" },
            { k: "safetyRequired", label: "يتطلب قائمة فحص سلامة (LOTO)", type: "check" },
            { k: "photoRequired", label: "صور قبل/بعد إلزامية", type: "check" },
          ]} initial={{ type: "تصحيحي", priority: "عادية", plannedStart: today(), safetyRequired: true }}
          onSave={(d) => {
            if (!d.assetId) { alert("لا أمر عمل بدون أصل (قاعدة النظام)"); return; }
            createWO(d); setForm(false);
          }} />
      )}
    </>
  );
}

/* ───────────────────────── تفاصيل أمر العمل — قلب التنفيذ ───────────────────────── */
function WODetail({ ctx, woId, onClose, openAsset }) {
  const { db, nameOf, update, can, role, myTechId, woCost, completionGaps, setWOStatus, log, activeWarranty, availableQty, onHand, addTx, woShortages, activeContracts, contractEffectiveEnd, generateEntitlements } = ctx;
  const wo = db.workOrders.find((w) => w.id === woId);
  const [sub, setSub] = useState("عام");
  const [opForm, setOpForm] = useState(false);
  const [matForm, setMatForm] = useState(false);
  const [failForm, setFailForm] = useState(false);
  const [completing, setCompleting] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const [excText, setExcText] = useState("");
  if (!wo) return null;
  const cost = woCost(wo);
  const gaps = completionGaps(wo);
  const isTech = role === "فني";
  const mineOnly = (op) => !isTech || !myTechId || op.assigneeId === myTechId;
  const aw = activeWarranty(wo.assetId);

  const patchOps = (ops) => update("workOrders", wo.id, { operations: ops });
  const patchLog = (action, extra = {}) => update("workOrders", wo.id, { execLog: log(wo, action), ...extra });

  const TABS = ["عام", "العمليات", "المواد", "السلامة", "العطل", "الصور", "الضمان", "السجل"];

  return (
    <Sheet title={wo.number} onClose={onClose}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 17 }}>{wo.title}</div>
        <div style={{ fontSize: 13, color: C.steel }}>
          <span style={{ textDecoration: "underline" }} onClick={() => wo.assetId && openAsset(wo.assetId)}>{nameOf("assets", wo.assetId)}</span>
          {" · "}{wo.type} · أولوية {wo.priority} · {fmt(wo.plannedStart)} ← {fmt(wo.plannedEnd)}
        </div>
        {aw && ["تصحيحي", "طارئ"].includes(wo.type) && (
          <div style={{ fontSize: 13, color: C.green, fontWeight: 700, marginTop: 4 }}>
            🛡 الأصل تحت ضمان «{aw.supplier}» حتى {fmt(aw.end)} — راجع الضمان قبل تكلفة إصلاح داخلي
          </div>
        )}
        {cost.total > 0 && <div style={{ fontSize: 13, marginTop: 4 }}>التكلفة: <b>{money(cost.total)}</b> (عمالة {money(cost.labor)} + مواد {money(cost.material)})</div>}

        {/* أزرار الحالة حسب الدور والمرحلة */}
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          <Badge text={wo.status} color={WO_COLORS[wo.status]} />
          {wo.status === "مسودة" && can.manage && <Btn bg={C.blue} onClick={() => {
            const sh = woShortages(wo);
            if (sh.length && !confirm("نقص مواد:\n" + sh.map((m) => "• " + nameOf("items", m.itemId) + " (مطلوب " + m.qty + "، المتاح " + Math.max(0, availableQty(m.itemId)) + ")").join("\n") + "\n\nإصدار كـ«بانتظار مواد»؟")) return;
            setWOStatus(wo, sh.length ? "بانتظار مواد" : "مُصدر");
          }}>إصدار (فحص المواد)</Btn>}
          {wo.status === "مُصدر" && can.manage && <Btn bg={C.purple} onClick={() => setWOStatus(wo, "جاهز")}>جاهز للتنفيذ</Btn>}
          {wo.status === "جاهز" && can.execute && (
            <Btn bg={C.green} onClick={() => {
              if (wo.safetyRequired && (wo.checklist || []).some((c) => !c.done)) { alert("لا بدء قبل إكمال قائمة فحص السلامة"); setSub("السلامة"); return; }
              setWOStatus(wo, "قيد التنفيذ", { actualStart: today() });
            }}>▶ بدء العمل</Btn>
          )}
          {wo.status === "قيد التنفيذ" && can.execute && (
            <>
              <Btn bg={C.steel} onClick={() => patchLog("⏸ إيقاف مؤقت")}>⏸ إيقاف</Btn>
              <Btn bg={C.green} onClick={() => {
                if (gaps.length) { alert("لا يمكن طلب الإكمال:\n• " + gaps.join("\n• ")); return; }
                setWOStatus(wo, "بانتظار المراجعة");
              }}>✓ طلب الإكمال</Btn>
            </>
          )}
          {wo.status === "مُعاد للتصحيح" && can.execute && <Btn bg={C.amber} onClick={() => setWOStatus(wo, "قيد التنفيذ")}>استئناف التصحيح</Btn>}
          {wo.status === "بانتظار المراجعة" && can.review && <Btn bg={C.blue} onClick={() => setReviewing(true)}>مراجعة المشرف</Btn>}
          {["جاهز", "قيد التنفيذ"].includes(wo.status) && can.manage && (
            <>
              <Btn bg={C.steel} onClick={() => setWOStatus(wo, "معلق")}>تعليق</Btn>
              <Btn bg={C.amber} onClick={() => setWOStatus(wo, "بانتظار مواد")}>بانتظار مواد</Btn>
            </>
          )}
          {["معلق", "بانتظار مواد"].includes(wo.status) && can.manage && <Btn bg={C.green} onClick={() => setWOStatus(wo, "قيد التنفيذ")}>استئناف</Btn>}
          {!["مغلق", "ملغي"].includes(wo.status) && can.manage && <Btn bg={C.red} onClick={() => setWOStatus(wo, "ملغي")}>إلغاء</Btn>}
        </div>
        {wo.status === "قيد التنفيذ" && gaps.length > 0 && (
          <div style={{ fontSize: 12, color: C.amber, marginTop: 6 }}>قبل الإكمال: {gaps.join(" · ")}</div>
        )}
        {wo.reviewNotes && wo.status === "مُعاد للتصحيح" && (
          <div style={{ fontSize: 13, color: C.red, marginTop: 6, fontWeight: 700 }}>ملاحظات المشرف: {wo.reviewNotes}</div>
        )}
      </div>

      <div style={{ display: "flex", gap: 5, overflowX: "auto", marginBottom: 10 }}>
        {TABS.map((t) => <Chip key={t} active={sub === t} onClick={() => setSub(t)}>{t}</Chip>)}
      </div>

      {/* ───── عام: معاينة العمل ───── */}
      {sub === "عام" && (
        <>
        {(wo.routeAssets || []).length > 0 && (
          <Section title={"أصول المسار (" + wo.routeAssets.filter((x) => x.status !== "معلق").length + "/" + wo.routeAssets.length + ")"}>
            {(() => { const h = db.logicalHierarchies.find((x) => x.id === wo.routeId); return wo.routeAssets.map((x) => {
              const ast = db.assets.find((z) => z.id === x.assetId);
              return (
                <div key={x.assetId} style={{ ...card(), borderRightColor: x.status === "تم" ? C.green : x.status === "تخطي" ? C.amber : C.ink }}>
                  <Row main={(ast?.number ? ast.number + " — " : "") + (ast?.name || "أصل")} sub={ast?.location}
                    badge={{ text: x.status, color: x.status === "تم" ? C.green : x.status === "تخطي" ? C.amber : C.steel }}
                    action={x.status === "معلق" && can.execute && wo.status === "قيد التنفيذ" ? (
                      <div style={{ display: "flex", gap: 4 }}>
                        <Btn bg={C.green} onClick={() => update("workOrders", wo.id, { routeAssets: wo.routeAssets.map((y) => y.assetId === x.assetId ? { ...y, status: "تم" } : y), execLog: log(wo, "مسار: تم — " + (ast?.name || "")) })}>تم</Btn>
                        {(h?.allowSkip) && <Btn bg={C.amber} onClick={() => update("workOrders", wo.id, { routeAssets: wo.routeAssets.map((y) => y.assetId === x.assetId ? { ...y, status: "تخطي" } : y), execLog: log(wo, "مسار: تخطي — " + (ast?.name || "")) })}>تخطي</Btn>}
                      </div>
                    ) : null} />
                </div>
              );
            }); })()}
          </Section>
        )}
          <Section title="معاينة العمل">
            <div style={card()}>
              <div style={{ fontSize: 13.5, lineHeight: 1.9 }}>
                الأصل: <b>{nameOf("assets", wo.assetId)}</b><br />
                آخر صيانة لهذا الأصل: <b>{(() => {
                  const prev = db.workOrders.filter((x) => x.assetId === wo.assetId && x.id !== wo.id && x.status === "مغلق").slice(-1)[0];
                  return prev ? prev.completedAt + " (" + prev.title + ")" : "لا يوجد";
                })()}</b><br />
                السلامة: <b>{wo.safetyRequired ? "تصريح عزل طاقة مطلوب" : "غير مطلوب"}</b> ·
                الصور: <b>{wo.photoRequired ? "قبل/بعد إلزامية" : "اختيارية"}</b>
              </div>
            </div>
          </Section>
          <Section title={"الاستثناءات (" + (wo.exceptions || []).length + ")"}>
            {(wo.exceptions || []).map((e, i) => (
              <div key={i} style={{ ...card(), borderRightColor: C.amber }}><Row main={e.text} sub={e.at} /></div>
            ))}
            {can.execute && (
              <div style={{ display: "flex", gap: 8 }}>
                <input value={excText} onChange={(e) => setExcText(e.target.value)} placeholder="نقص مادة، عدم توفر فني…" style={input} />
                <Btn bg={C.amber} onClick={() => { if (excText.trim()) { update("workOrders", wo.id, { exceptions: [...(wo.exceptions || []), { text: excText, at: today() }], execLog: log(wo, "استثناء: " + excText) }); setExcText(""); } }}>تسجيل</Btn>
              </div>
            )}
          </Section>
        </>
      )}

      {/* ───── العمليات ───── */}
      {sub === "العمليات" && (
        <Section title={"العمليات (" + wo.operations.length + ")"}>
          {wo.operations.slice().sort((a, b) => a.seq - b.seq).map((op) => (
            <div key={op.id} style={{ ...card(), opacity: mineOnly(op) ? 1 : 0.55 }}>
              <Row main={op.seq + " — " + op.name + (op.opType === "خارجية" ? " (خارجية)" : "")}
                sub={[op.opType === "خارجية" ? "المورد: " + (op.supplier || "—") : (op.assigneeId ? "الفني: " + nameOf("technicians", op.assigneeId) : "غير مُسند"),
                  op.chargeType ? "تحميل " + op.chargeType : "",
                  op.status === "مكتملة" ? op.actualHours + " ساعة فعلية" : op.minutes ? op.minutes + " د مخطط" : ""].filter(Boolean).join(" · ")}
                action={op.status === "مكتملة"
                  ? <Badge text="مكتملة" color={C.green} />
                  : wo.status === "قيد التنفيذ" && can.execute && mineOnly(op)
                    ? <Btn bg={C.green} onClick={() => setCompleting(op)}>إكمال</Btn> : null} />
              {(op.attachments || []).length > 0 && (
                <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                  {(op.attachments || []).map((a) => a.type === "رابط" && a.value
                    ? <button key={a.id} onClick={(e) => { e.stopPropagation(); window.open(a.value, "_blank"); }} style={{ ...delBtn, color: C.blue, marginTop: 0 }}>🔗 {a.name}</button>
                    : <span key={a.id} style={{ fontSize: 12, color: C.steel }}>📝 {a.name}{a.value ? ": " + a.value : ""}</span>)}
                </div>
              )}
              {(op.repairReason || op.workDone || op.repairTx) && (
                <div style={{ fontSize: 12, color: C.steel, marginTop: 2 }}>أكواد الإصلاح: {[op.repairReason, op.repairTx, op.workDone].filter(Boolean).join(" / ")}</div>
              )}
              {op.status !== "مكتملة" && can.manage && (
                <select value={op.assigneeId || ""} onChange={(e) => {
                  patchOps(wo.operations.map((o) => o.id === op.id ? { ...o, assigneeId: e.target.value } : o));
                }} style={{ ...input, marginTop: 6, padding: "6px 10px", fontSize: 13 }}>
                  <option value="">— إسناد لفني —</option>
                  {db.technicians.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.specialty || "عام"})</option>)}
                </select>
              )}
            </div>
          ))}
          {["مسودة", "مُصدر"].includes(wo.status) && can.manage && <Btn bg={C.ink} onClick={() => setOpForm(true)} style={{ width: "100%" }}>+ إضافة عملية</Btn>}
        </Section>
      )}

      {/* ───── المواد: صرف ← استخدام ← إرجاع (وثيقة التنفيذ §8) ───── */}
      {sub === "المواد" && (
        <Section title="المواد — مطلوب ← حجز ← تجهيز ← صرف ← استخدام ← إرجاع">
          {(wo.materials || []).length === 0 && <Empty text="أضف المواد المطلوبة من ماستر الأصناف — لا صرف بدون أمر عمل." />}
          {(wo.materials || []).map((m) => {
            const issued = Number(m.issuedQty || 0);
            const ret = Math.max(0, issued - Number(m.usedQty || 0));
            const av = m.itemId ? availableQty(m.itemId) + (m.reserved && !issued ? Number(m.qty || 0) : 0) : null;
            const stage = issued ? (m.returned ? "أُرجع الفائض" : "مصروف") : m.picked ? "جاهز للصرف" : m.reserved ? "محجوز" : "مطلوب";
            return (
              <div key={m.id} style={{ ...card(), borderRightColor: issued ? C.green : m.reserved ? C.blue : C.ink }}>
                <Row main={(m.itemId ? nameOf("items", m.itemId) : m.name) + " ×" + (m.qty || m.issuedQty)}
                  badge={{ text: stage, color: issued ? C.green : m.picked ? C.purple : m.reserved ? C.blue : C.steel }}
                  sub={[m.itemId && !issued ? "المتاح: " + Math.max(0, av) : "", issued ? "مصروف " + issued + " × " + money(m.unitCost) : ""].filter(Boolean).join(" · ")} />
                {/* مخزن: حجز ← تأكيد تجهيز ← صرف */}
                {!issued && !["مغلق", "ملغي"].includes(wo.status) && (
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    {!m.reserved && m.itemId && can.warehouse && (
                      <Btn bg={C.blue} onClick={() => {
                        if (Number(m.qty || 0) > availableQty(m.itemId)) { alert("المتاح غير كافٍ (" + Math.max(0, availableQty(m.itemId)) + ") — حدّث الرصيد باستلام أو خفّض الكمية"); return; }
                        update("workOrders", wo.id, { materials: wo.materials.map((x) => x.id === m.id ? { ...x, reserved: true } : x), execLog: log(wo, "حجز: " + nameOf("items", m.itemId) + " ×" + m.qty) });
                      }}>حجز</Btn>
                    )}
                    {m.reserved && !m.picked && can.warehouse && (
                      <Btn bg={C.purple} onClick={() => update("workOrders", wo.id, { materials: wo.materials.map((x) => x.id === m.id ? { ...x, picked: true } : x), execLog: log(wo, "تأكيد تجهيز: " + nameOf("items", m.itemId)) })}>تأكيد التجهيز</Btn>
                    )}
                    {m.reserved && m.picked && can.warehouse && (
                      <Btn bg={C.green} onClick={() => {
                        const item = db.items.find((i) => i.id === m.itemId);
                        addTx({ type: "صرف لأمر عمل", itemId: m.itemId, qty: Number(m.qty || 0), workOrderId: wo.id });
                        update("workOrders", wo.id, { materials: wo.materials.map((x) => x.id === m.id ? { ...x, issuedQty: Number(m.qty || 0), unitCost: Number(item?.unitCost || 0), usedQty: "" } : x), execLog: log(wo, "صرف: " + nameOf("items", m.itemId) + " ×" + m.qty) });
                      }}>صرف للأمر</Btn>
                    )}
                    {can.manage && <Btn bg={C.red} onClick={() => update("workOrders", wo.id, { materials: wo.materials.filter((x) => x.id !== m.id) })}>إزالة</Btn>}
                  </div>
                )}
                {/* فني: تأكيد المستخدم ← إرجاع الفائض */}
                {issued > 0 && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13 }}>المستخدم فعليًا:</span>
                    <input type="number" value={m.usedQty ?? ""} disabled={!can.execute || m.returned || ["مغلق", "ملغي"].includes(wo.status)}
                      onChange={(e) => update("workOrders", wo.id, { materials: wo.materials.map((x) => x.id === m.id ? { ...x, usedQty: e.target.value } : x) })}
                      style={{ ...input, width: 80, padding: "6px 10px" }} />
                    <span style={{ fontSize: 12.5, color: C.steel }}>يُرجَع: {ret} · التكلفة: {money(Number(m.usedQty || 0) * Number(m.unitCost || 0))}</span>
                    {!m.returned && ret > 0 && m.usedQty !== "" && m.usedQty != null && can.warehouse && (
                      <Btn bg={C.amber} onClick={() => {
                        addTx({ type: "إرجاع من أمر عمل", itemId: m.itemId, qty: ret, workOrderId: wo.id });
                        update("workOrders", wo.id, { materials: wo.materials.map((x) => x.id === m.id ? { ...x, returned: true } : x), execLog: log(wo, "إرجاع فائض: ×" + ret) });
                      }}>إرجاع الفائض للمخزن</Btn>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {can.manage && !["مغلق", "ملغي"].includes(wo.status) && db.items.length > 0 && (
            <Btn bg={C.ink} onClick={() => setMatForm(true)} style={{ width: "100%" }}>+ مادة مطلوبة (من الأصناف)</Btn>
          )}
          {db.items.length === 0 && <div style={{ fontSize: 12.5, color: C.steel, marginTop: 6 }}>أنشئ الأصناف أولًا من «المخزون ← الأصناف».</div>}
        </Section>
      )}

      {/* ───── السلامة (وثيقة التنفيذ §4) ───── */}
      {sub === "السلامة" && (
        <Section title="قائمة فحص السلامة">
          {!wo.safetyRequired && (wo.checklist || []).length === 0 && <Empty text="هذا الأمر لا يتطلب قائمة سلامة." />}
          {(wo.checklist || []).map((c) => (
            <label key={c.id} style={{ ...card(), display: "flex", gap: 10, alignItems: "center" }}>
              <input type="checkbox" checked={c.done} disabled={!can.execute || ["مغلق", "ملغي"].includes(wo.status)}
                onChange={(e) => update("workOrders", wo.id, {
                  checklist: wo.checklist.map((x) => x.id === c.id ? { ...x, done: e.target.checked } : x),
                  execLog: log(wo, (e.target.checked ? "✓ " : "✗ ") + c.text),
                })}
                style={{ width: 22, height: 22 }} />
              <span style={{ fontSize: 14.5, textDecoration: c.done ? "line-through" : "none" }}>{c.text}</span>
            </label>
          ))}
          {can.manage && !["مغلق", "ملغي"].includes(wo.status) && (
            <AddInline placeholder="بند فحص إضافي…" onAdd={(t) =>
              update("workOrders", wo.id, { checklist: [...(wo.checklist || []), { id: uid(), text: t, done: false }] })} />
          )}
        </Section>
      )}

      {/* ───── العطل (وثيقة التنفيذ §10) ───── */}
      {sub === "العطل" && (
        <Section title="تسجيل العطل">
          {["تصحيحي", "طارئ"].includes(wo.type) && !wo.failure &&
            <div style={{ fontSize: 13, color: C.red, marginBottom: 8 }}>⚠ إلزامي قبل الإكمال لأوامر التصحيح والطوارئ.</div>}
          {wo.failure ? (
            <div style={{ ...card(), borderRightColor: C.red }}>
              <div style={{ fontSize: 14, lineHeight: 2 }}>
                <b>نمط العطل:</b> {wo.failure.mode}{wo.failure.repeated ? " (متكرر ⚠)" : ""}<br />
                <b>السبب:</b> {wo.failure.cause}<br />
                <b>الأثر:</b> {wo.failure.effect}<br />
                <b>الإجراء المتخذ:</b> {wo.failure.action}<br />
                <b>زمن التوقف:</b> {wo.failure.downtime} دقيقة<br />
                {wo.failure.rootCause && <><b>السبب الجذري:</b> {wo.failure.rootCause}</>}
              </div>
              {can.execute && !["مغلق", "ملغي"].includes(wo.status) && <Btn bg={C.blue} onClick={() => setFailForm(true)} style={{ marginTop: 8 }}>تعديل</Btn>}
            </div>
          ) : (
            can.execute && !["مغلق", "ملغي"].includes(wo.status)
              ? <Btn bg={C.red} onClick={() => setFailForm(true)} style={{ width: "100%", padding: 12 }}>+ تسجيل عطل</Btn>
              : <Empty text="لا عطل مسجل." />
          )}
        </Section>
      )}

      {/* ───── الصور (وثيقة التنفيذ §11) ───── */}
      {sub === "الصور" && <PhotosTab ctx={ctx} wo={wo} />}

      {/* ───── سجل التنفيذ والحالات ───── */}
      {/* ───── ضمان المورد (ف6 §22) ───── */}
      {sub === "الضمان" && (() => {
        const cs = activeContracts(wo.assetId);
        const woEnts = db.entitlements.filter((e) => e.workOrderId === wo.id);
        const woClaims = db.claims.filter((c) => c.workOrderId === wo.id);
        return (<>
          {can.manage && (
            <div style={{ ...card(), display: "flex", gap: 16, flexWrap: "wrap" }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={!!wo.warrantyRepair} disabled={["مغلق", "ملغي"].includes(wo.status) && woEnts.length > 0}
                  onChange={(e) => update("workOrders", wo.id, { warrantyRepair: e.target.checked, execLog: log(wo, "إصلاح ضمان: " + (e.target.checked ? "نعم" : "لا")) })} style={{ width: 20, height: 20 }} />
                <span style={{ fontSize: 14 }}>إصلاح ضمان</span>
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={!!wo.matchCodes}
                  onChange={(e) => update("workOrders", wo.id, { matchCodes: e.target.checked })} style={{ width: 20, height: 20 }} />
                <span style={{ fontSize: 14 }}>مطابقة أكواد الإصلاح</span>
              </label>
            </div>
          )}
          <Section title={"العقود الفعالة للأصل وأصوله المرتبطة (" + cs.length + ")"}>
            {cs.length === 0 && <Empty text="لا عقود فعالة — وجود الأيقونة 🛡 لا يعني تغطية نهائية؛ القرار حسب الشروط والأكواد." />}
            {cs.map((c) => (
              <div key={c.id} style={{ ...card(), borderRightColor: C.green }}>
                <Row main={c.number + " — " + nameOf("coverages", c.coverageId)}
                  sub={[nameOf("assets", c.assetId) !== nameOf("assets", wo.assetId) ? "أصل مرتبط: " + nameOf("assets", c.assetId) : "",
                    "ينتهي " + fmt(contractEffectiveEnd(c))].filter(Boolean).join(" · ")} />
              </div>
            ))}
          </Section>
          {can.manage && ["بانتظار المراجعة", "مغلق"].includes(wo.status) && (
            <Btn bg={C.purple} style={{ width: "100%", padding: 12, marginBottom: 12 }} onClick={() => generateEntitlements(wo)}>
              ⚙ توليد استحقاقات الضمان وتجميعها في مطالبة
            </Btn>
          )}
          {wo.status !== "مغلق" && wo.status !== "بانتظار المراجعة" && (
            <div style={{ fontSize: 12.5, color: C.steel, marginBottom: 10 }}>يفضّل توليد الاستحقاقات بعد إكمال الأمر واكتمال التكلفة (قاعدة ف6).</div>
          )}
          <Section title={"استحقاقات هذا الأمر (" + woEnts.length + ")"}>
            {woEnts.map((e) => (
              <div key={e.id} style={{ ...card(), borderRightColor: e.included ? C.green : C.steel }}>
                <Row main={e.type + " — " + e.description} badge={e.included ? { text: "ضمن مطالبة", color: C.green } : { text: "مستبعد", color: C.steel }}
                  sub={e.qty + " × " + money(e.unitCost) + " = " + money(e.total)} />
              </div>
            ))}
            {woEnts.length === 0 && <Empty text="لا استحقاقات بعد." />}
          </Section>
          {woClaims.length > 0 && (
            <Section title="مطالبات هذا الأمر">
              {woClaims.map((c) => (
                <div key={c.id} style={card()}>
                  <Row main={c.number + " — " + nameOf("warrantyProviders", c.providerId)}
                    badge={{ text: c.status, color: { "قيد المراجعة": C.amber, "مُقدمة": C.blue, "محلولة": C.green, "مرفوضة": C.red }[c.status] || C.steel }}
                    sub="تُدار من: المزيد ← الضمانات ← المطالبات" />
                </div>
              ))}
            </Section>
          )}
        </>);
      })()}

      {sub === "السجل" && (
        <>
          <Section title="سجل التنفيذ (Audit)">
            {(wo.execLog || []).slice().reverse().map((h, i) => (
              <div key={i} style={{ fontSize: 13, color: C.steel, marginBottom: 4, borderBottom: `1px dashed ${C.line}`, paddingBottom: 4 }}>
                <b style={{ color: C.ink }}>{h.action}</b> — {h.at} — {h.by}
              </div>
            ))}
          </Section>
          <Section title="سجل الحالات">
            {(wo.history || []).map((h, i) => (
              <div key={i} style={{ fontSize: 13, color: C.steel, marginBottom: 3 }}>
                {h.at} — {h.from ? h.from + " ← " : ""}<b style={{ color: C.ink }}>{h.to}</b>
              </div>
            ))}
          </Section>
        </>
      )}

      {/* نوافذ فرعية */}
      {opForm && (
        <FormSheet title="إضافة عملية" onClose={() => setOpForm(false)} db={db}
          schema={[
            { k: "seq", label: "التسلسل", type: "number" }, { k: "name", label: "اسم العملية" },
            { k: "workCenterId", label: "مركز العمل", type: "select", from: "workCenters", fromKey: "name" },
            { k: "minutes", label: "الدقائق المخططة", type: "number" },
            { k: "assigneeId", label: "الفني", type: "select", from: "technicians", fromKey: "name" },
          ]} initial={{ seq: (wo.operations.length + 1) * 10 }}
          onSave={(d) => { patchOps([...wo.operations, { id: uid(), status: "معلقة", actualHours: 0, ...d }]); setOpForm(false); }} />
      )}
      {matForm && (
        <FormSheet title="مادة مطلوبة" onClose={() => setMatForm(false)} db={db}
          schema={[
            { k: "itemId", label: "الصنف (لا قطعة غيار بدون ماستر الأصناف)", type: "select", from: "items", fromLabel: (i) => i.code + " — " + i.name + " (متاح " + Math.max(0, availableQty(i.id)) + ")" },
            { k: "qty", label: "الكمية المطلوبة", type: "number" },
          ]} initial={{ qty: 1 }}
          onSave={(d) => {
            if (!d.itemId) { alert("اختر الصنف"); return; }
            update("workOrders", wo.id, { materials: [...(wo.materials || []), { id: uid(), ...d, reserved: false, picked: false, issuedQty: 0, usedQty: "", returned: false, unitCost: Number(db.items.find((i) => i.id === d.itemId)?.unitCost || 0) }], execLog: log(wo, "مادة مطلوبة: " + nameOf("items", d.itemId) + " ×" + d.qty) });
            setMatForm(false);
          }} />
      )}
      {failForm && (
        <FormSheet title="بيانات العطل" onClose={() => setFailForm(false)} db={db}
          schema={[
            { k: "mode", label: "نمط العطل", type: "select", options: FAILURE_MODES },
            { k: "cause", label: "السبب" }, { k: "effect", label: "الأثر (توقف الخط…)" },
            { k: "action", label: "الإجراء المتخذ" },
            { k: "downtime", label: "زمن التوقف (دقيقة)", type: "number" },
            { k: "rootCause", label: "السبب الجذري", type: "textarea" },
            { k: "repeated", label: "عطل متكرر؟", type: "check" },
          ]} initial={wo.failure || { mode: FAILURE_MODES[0] }}
          onSave={(d) => { update("workOrders", wo.id, { failure: d, execLog: log(wo, "تسجيل عطل: " + d.mode) }); setFailForm(false); }} />
      )}
      {completing && <CompleteOpSheet ctx={ctx} wo={wo} op={completing} onClose={() => setCompleting(null)}
        onComplete={(d) => {
          patchOps(wo.operations.map((o) => o.id === completing.id
            ? { ...o, status: "مكتملة", completedAt: today(), actualHours: Number(d.hours || 0) } : o));
          setCompleting(null);
        }} />}
      {reviewing && <ReviewSheet ctx={ctx} wo={wo} onClose={() => setReviewing(false)} />}
    </Sheet>
  );
}

/* مراجعة المشرف (وثيقة التنفيذ §13): اعتماد / رفض / أمر متابعة */
function ReviewSheet({ ctx, wo, onClose }) {
  const { db, nameOf, setWOStatus, createWO, woCost } = ctx;
  const [notes, setNotes] = useState("");
  const hours = (wo.operations || []).reduce((s, o) => s + Number(o.actualHours || 0), 0);
  return (
    <Sheet title={"مراجعة " + wo.number} onClose={onClose}>
      <div style={{ ...card(), fontSize: 13.5, lineHeight: 2 }}>
        <b>قائمة السلامة:</b> {(wo.checklist || []).every((c) => c.done) ? "✓ مكتملة" : "✗ ناقصة"}<br />
        <b>العمليات:</b> {(wo.operations || []).filter((o) => o.status === "مكتملة").length}/{(wo.operations || []).length} مكتملة<br />
        <b>ساعات العمل:</b> {hours} ساعة<br />
        <b>المواد المستخدمة:</b> {(wo.materials || []).map((m) => m.name + " ×" + (m.usedQty || 0)).join("، ") || "لا شيء"}<br />
        <b>العطل:</b> {wo.failure ? wo.failure.mode + " — " + wo.failure.cause : "غير مسجل"}<br />
        <b>الصور:</b> {(wo.photos || []).length} صورة<br />
        <b>التكلفة:</b> {money(woCost(wo).total)}
      </div>
      <Field label="ملاحظات المراجعة">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...input, resize: "vertical" }} />
      </Field>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Btn bg={C.green} style={{ padding: 13, fontSize: 15 }} onClick={() => { setWOStatus(wo, "مغلق", { reviewNotes: notes }); onClose(); }}>
          ✓ اعتماد وإغلاق نهائي
        </Btn>
        <Btn bg={C.red} style={{ padding: 13 }} onClick={() => {
          if (!notes.trim()) { alert("اكتب سبب الرفض للفني"); return; }
          setWOStatus(wo, "مُعاد للتصحيح", { reviewNotes: notes }); onClose();
        }}>✗ رفض — إعادة للفني مع ملاحظات</Btn>
        <Btn bg={C.purple} style={{ padding: 13 }} onClick={() => {
          createWO({ title: "متابعة — " + wo.title, assetId: wo.assetId, type: "تصحيحي", priority: "عالية",
            plannedStart: today(), safetyRequired: true, followUpOf: wo.number });
          setWOStatus(wo, "مغلق", { reviewNotes: (notes ? notes + " · " : "") + "أُنشئ أمر متابعة" }); onClose();
        }}>+ اعتماد مع أمر متابعة لعطل جديد</Btn>
      </div>
    </Sheet>
  );
}

/* تبويب الصور: قبل / أثناء / بعد / عطل / قطعة غيار */
function PhotosTab({ ctx, wo }) {
  const { update, can, log } = ctx;
  const [type, setType] = useState("قبل");
  const TYPES = ["قبل", "أثناء", "بعد", "عطل", "قطعة غيار"];
  const addPhoto = async (file) => {
    try {
      const data = await resizeImage(file);
      update("workOrders", wo.id, { photos: [...(wo.photos || []), { id: uid(), type, data, at: today() }], execLog: log(wo, "صورة " + type) });
    } catch (e) { alert("تعذر معالجة الصورة"); }
  };
  return (
    <Section title={"الصور (" + (wo.photos || []).length + ")" + (wo.photoRequired ? " — قبل/بعد إلزامية" : "")}>
      {can.execute && !["مغلق", "ملغي"].includes(wo.status) && (
        <div style={{ ...card() }}>
          <div style={{ display: "flex", gap: 5, marginBottom: 8, flexWrap: "wrap" }}>
            {TYPES.map((t) => <Chip key={t} active={type === t} onClick={() => setType(t)}>{t}</Chip>)}
          </div>
          <input type="file" accept="image/*" capture="environment" onChange={(e) => e.target.files[0] && addPhoto(e.target.files[0])} style={{ fontSize: 14 }} />
          <div style={{ fontSize: 11.5, color: C.steel, marginTop: 4 }}>تُضغط الصور تلقائيًا للحفاظ على مساحة التخزين.</div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {(wo.photos || []).map((p) => (
          <div key={p.id} style={{ border: `1.5px solid ${C.ink}`, borderRadius: 4, overflow: "hidden", background: "#fff" }}>
            <img src={p.data} alt={p.type} style={{ width: "100%", display: "block" }} />
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", fontSize: 12 }}>
              <b>{p.type}</b><span style={{ color: C.steel }}>{fmt(p.at)}</span>
              {can.execute && <button onClick={() => update("workOrders", wo.id, { photos: wo.photos.filter((x) => x.id !== p.id) })} style={{ ...delBtn, marginTop: 0 }}>حذف</button>}
            </div>
          </div>
        ))}
      </div>
      {(wo.photos || []).length === 0 && <Empty text="لا صور بعد." />}
    </Section>
  );
}

function CompleteOpSheet({ ctx, wo, op, onClose, onComplete }) {
  const { db, nameOf, addReading, currentValue, pmCheckAfterReading } = ctx;
  const [hours, setHours] = useState(op.minutes ? (op.minutes / 60).toFixed(1) : "1");
  const meters = db.assetMeters.filter((m) => m.assetId === wo.assetId && (!m.endDate || m.endDate >= today()));
  const isMand = (m) => (m.recordAtWO || db.meterTemplates.find((t) => t.id === m.templateId)?.recordAtWO) === "إلزامي";
  const mandPending = meters.filter((m) => isMand(m) && !db.readings.some((r) => r.workOrderId === wo.id && r.assetMeterId === m.id && !["معطلة", "ملغاة"].includes(r.status)));
  const [meterId, setMeterId] = useState(""); const [meterVal, setMeterVal] = useState(""); const [err, setErr] = useState("");
  return (
    <Sheet title={"إكمال: " + op.name} onClose={onClose}>
      <Field label="الساعات الفعلية"><input type="number" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} style={input} /></Field>
      {mandPending.length > 0 && (
        <div style={{ fontSize: 12.5, color: C.red, marginBottom: 8 }}>
          ⚠ عدادات إلزامية لم تُسجّل بعد: {mandPending.map((m) => nameOf("meterTemplates", m.templateId)).join("، ")} — لن يُقبل طلب الإكمال بدونها.
        </div>
      )}
      {meters.length > 0 && (
        <>
          <Field label="قراءة عداد عند الإكمال">
            <select value={meterId} onChange={(e) => { setMeterId(e.target.value); setErr(""); }} style={input}>
              <option value="">— بدون —</option>
              {meters.map((m) => <option key={m.id} value={m.id}>{(isMand(m) ? "⚠ إلزامي — " : "") + nameOf("meterTemplates", m.templateId)} (المعروض: {currentValue(m)})</option>)}
            </select>
          </Field>
          {meterId && <Field label="القراءة الجديدة"><input type="number" value={meterVal} onChange={(e) => setMeterVal(e.target.value)} style={input} /></Field>}
        </>
      )}
      {err && <div style={{ color: C.red, fontSize: 13, marginBottom: 8 }}>⚠ {err}</div>}
      <Btn bg={C.green} style={{ width: "100%", padding: 13, fontSize: 15 }} onClick={() => {
        if (meterId && meterVal !== "") {
          const am = db.assetMeters.find((m) => m.id === meterId);
          const alerts = pmCheckAfterReading(am, meterVal);
          const e = addReading(am, meterVal, today(), { source: "أمر عمل", workOrderId: wo.id });
          if (e) { setErr(e); return; }
          if (alerts.length) alert(alerts.map((x) => x.msg).join("\n"));
        }
        onComplete({ hours });
      }}>تأكيد إكمال العملية</Btn>
    </Sheet>
  );
}

/* ───────────────────────── تحليل الأعطال (Failure Analysis + MTTR) ───────────────────────── */
function FailureAnalysis({ ctx, openWO }) {
  const { db, nameOf } = ctx;
  const failures = db.workOrders.filter((w) => w.failure).map((w) => ({ wo: w, f: w.failure }));
  const mttr = failures.length ? Math.round(failures.reduce((s, x) => s + Number(x.f.downtime || 0), 0) / failures.length) : 0;
  const totalDowntime = failures.reduce((s, x) => s + Number(x.f.downtime || 0), 0);
  /* الأعطال المتكررة: نفس النمط على نفس الأصل أكثر من مرة */
  const repeatMap = {};
  failures.forEach(({ wo, f }) => { const k = (wo.assetId || "؟") + "|" + f.mode; repeatMap[k] = (repeatMap[k] || 0) + 1; });
  const repeated = Object.entries(repeatMap).filter(([, n]) => n > 1)
    .map(([k, n]) => { const [assetId, mode] = k.split("|"); return { asset: nameOf("assets", assetId), mode, n }; });
  /* أكثر الأصول مشاكل (وثيقة الأصول §Top Problem Assets) */
  const probMap = {};
  failures.forEach(({ wo }) => { probMap[wo.assetId] = (probMap[wo.assetId] || 0) + 1; });
  const topProblem = Object.entries(probMap).map(([id, n]) => ({ name: nameOf("assets", id), n })).sort((a, b) => b.n - a.n).slice(0, 5);
  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Stat n={failures.length} label="أعطال مسجلة" color={C.red} />
        <Stat n={mttr + " د"} label="MTTR متوسط الإصلاح" color={C.amber} small />
        <Stat n={totalDowntime + " د"} label="إجمالي التوقف" color={C.ink} small />
      </div>
      {topProblem.length > 0 && (
        <Section title="أكثر الأصول مشاكل">
          <div style={card()}>
            {topProblem.map((x) => (
              <div key={x.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 4 }}>
                <span>{x.name}</span><b style={{ color: C.red }}>{x.n} عطل</b>
              </div>
            ))}
          </div>
        </Section>
      )}
      {repeated.length > 0 && (
        <Section title="⚠ أعطال متكررة — تحتاج سببًا جذريًا">
          {repeated.map((r, i) => (
            <div key={i} style={{ ...card(), borderRightColor: C.red }}>
              <Row main={r.mode + " — " + r.asset} sub={"تكرر " + r.n + " مرات"} />
            </div>
          ))}
        </Section>
      )}
      <Section title="سجل الأعطال">
        {failures.length === 0 && <Empty text="لا أعطال مسجلة بعد — تُسجّل من داخل أمر العمل (تبويب العطل)." />}
        {failures.slice().reverse().map(({ wo, f }) => (
          <div key={wo.id} style={card()} onClick={() => openWO(wo.id)}>
            <Row main={f.mode + " — " + nameOf("assets", wo.assetId)}
              sub={[f.cause, f.downtime + " د توقف", wo.number].join(" · ")}
              badge={f.repeated ? { text: "متكرر", color: C.red } : undefined} />
          </div>
        ))}
      </Section>
    </>
  );
}

/* ───────────────────────── الإشراف (لوحة المشرف الكاملة) ───────────────────────── */
function Supervision({ ctx, openWO }) {
  const { db, nameOf, woCost } = ctx;
  const open = db.workOrders.filter((w) => ACTIVE_STATES.includes(w.status));
  const buckets = [
    ["أوامر اليوم", open.filter((w) => w.plannedStart && daysUntil(w.plannedStart) === 0)],
    ["متأخرة", open.filter((w) => w.plannedEnd && daysUntil(w.plannedEnd) < 0)],
    ["طارئة", open.filter((w) => w.priority === "طارئ" || w.type === "طارئ")],
    ["بانتظار مواد", open.filter((w) => w.status === "بانتظار مواد")],
    ["مكتملة بانتظار المراجعة", open.filter((w) => w.status === "بانتظار المراجعة")],
    ["مُعادة للتصحيح", open.filter((w) => w.status === "مُعاد للتصحيح")],
  ];
  /* حِمل الفنيين */
  const load = db.technicians.map((t) => ({
    name: t.name,
    n: open.reduce((s, w) => s + (w.operations || []).filter((o) => o.assigneeId === t.id && o.status !== "مكتملة").length, 0),
  })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  return (
    <>
      {load.length > 0 && (
        <Section title="حِمل الفنيين (عمليات مفتوحة)">
          <div style={card()}>
            {load.map((x) => (
              <div key={x.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 4 }}>
                <span>{x.name}</span><b>{x.n}</b>
              </div>
            ))}
          </div>
        </Section>
      )}
      {buckets.map(([title, list]) => list.length > 0 && (
        <Section key={title} title={title + " (" + list.length + ")"}>
          {list.map((w) => (
            <div key={w.id} style={card()} onClick={() => openWO(w.id)}>
              <Row main={w.number + " — " + w.title}
                sub={[nameOf("assets", w.assetId), woCost(w).total > 0 ? money(woCost(w).total) : ""].filter(Boolean).join(" · ")}
                badge={{ text: w.status, color: WO_COLORS[w.status] }} />
            </div>
          ))}
        </Section>
      ))}
      {buckets.every(([, l]) => l.length === 0) && <Empty text="لا أوامر تحتاج إشرافًا حاليًا." />}
    </>
  );
}

/* ───────────────────────── توقعات الصيانة ───────────────────────── */
function Forecast({ ctx, programDue, generateWO }) {
  const { db, nameOf, programAssets } = ctx;
  const lines = db.programs.map((p) => ({ p, info: programDue(p) }));
  return (
    <Section title="توقعات الصيانة الوقائية">
      {lines.length === 0 && <Empty text="أنشئ برامج وقائية أولًا لتوليد التوقعات." />}
      {lines.map(({ p, info }) => (
        <div key={p.id} style={{ ...card(), borderRightColor: info.due ? C.red : info.soon ? C.amber : C.green }}>
          <Row main={p.name}
            sub={(p.targetType === "مجموعة" ? "مجموعة: " + nameOf("assetGroups", p.assetGroupId) + " (" + programAssets(p).length + " أصل)" : nameOf("assets", p.assetId)) + " · " + info.label}
            action={info.due
              ? <Btn bg={C.orange} onClick={() => generateWO(p)}>{p.targetType === "مجموعة" ? "إنشاء أوامر" : "إنشاء أمر"}</Btn>
              : <Badge text={info.soon ? "قريبًا" : "في الموعد"} color={info.soon ? C.amber : C.green} />} />
        </div>
      ))}
    </Section>
  );
}

/* ───────────────────────── العمليات القياسية بخطوات (وثيقة التنفيذ §Standard Operation) ───────────────────────── */
/* ───────────────────────── مكتبة العمليات القياسية (ف7) ───────────────────────── */
function StdOpsManager({ ctx }) {
  const { db, add, update, nameOf, can } = ctx;
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("الكل");
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState(false);
  const [detail, setDetail] = useState(null);
  /* الاستخدام: في تعريفات العمل أو أوامر العمل (يمنع الحذف وتغيير الكود) */
  const usage = (id) => ({
    defs: db.workDefs.filter((d) => (d.opIds || []).includes(id)),
    wos: db.workOrders.filter((w) => (w.operations || []).some((o) => o.stdOpId === id)),
  });
  const isInactive = (o) => o.inactiveOn && daysUntil(o.inactiveOn) <= 0;
  let list = db.stdOps.filter((o) =>
    (!q || (o.name + o.code + (o.description || "") + nameOf("workCenters", o.workCenterId)).includes(q)) &&
    (filter === "الكل" || (filter === "داخلية" && (o.type || "داخلية") === "داخلية") || (filter === "خارجية" && o.type === "خارجية")) &&
    (showInactive || !isInactive(o)));
  const opSchema = (editing) => [
    { k: "type", label: "نوع العملية", type: "select", options: ["داخلية", "خارجية"] },
    { k: "code", label: "الكود (فريد)" + (editing && (usage(editing.id).defs.length || usage(editing.id).wos.length) ? " — مقفل (مستخدمة)" : "") },
    { k: "name", label: "اسم العملية" },
    { k: "description", label: "الوصف", type: "textarea" },
    { k: "workCenterId", label: "مركز العمل" + (editing && (editing.resources || []).length ? " — مقفل (توجد موارد)" : ""), type: "select", from: "workCenters", fromKey: "name" },
    { k: "minutes", label: "المدة بالدقائق", type: "number" },
    { k: "steps", label: "الخطوات (سطر لكل خطوة)", type: "textarea" },
    { k: "countPoint", label: "نقطة عد (يجب الإبلاغ عن إكمالها صراحةً)", type: "check" },
    { k: "autoTransact", label: "تنفيذ تلقائي (لا يجتمع مع نقطة العد)", type: "check" },
    { k: "supplier", label: "المورد (للخارجية)" },
    { k: "supplierSite", label: "موقع المورد" },
    { k: "ospItemId", label: "صنف خدمة المورد — من ماستر الأصناف (إلزامي للخارجية)", type: "select", from: "items", fromLabel: (i) => i.code + " — " + i.name },
    { k: "inactiveOn", label: "تعطيل اعتبارًا من", type: "date" },
  ];
  const validate = (d, editing) => {
    if (!String(d.code || "").trim() || !String(d.name || "").trim()) return "الكود والاسم مطلوبان";
    if (db.stdOps.some((o) => o.code === d.code && o.id !== editing?.id)) return "الكود مستخدم — يجب أن يكون فريدًا";
    if (d.countPoint && d.autoTransact) return "نقطة العد والتنفيذ التلقائي لا يجتمعان (قاعدة ف7)";
    if (d.type === "خارجية" && !d.ospItemId) return "العملية الخارجية تتطلب صنف خدمة المورد";
    if (d.type === "خارجية" && (editing?.resources || []).length) return "العملية الخارجية لا تحمل موارد داخلية — احذف الموارد أولًا";
    if (editing) {
      const u = usage(editing.id);
      if (d.code !== editing.code && (u.defs.length || u.wos.length)) return "لا يمكن تغيير الكود — العملية مستخدمة";
      if (d.workCenterId !== editing.workCenterId && (editing.resources || []).length) return "لا يمكن تغيير مركز العمل مع وجود موارد";
    }
    return null;
  };
  return (
    <>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 بحث بالاسم/الكود/الوصف/مركز العمل…" style={{ ...input, marginBottom: 8 }} />
      <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
        {["الكل", "داخلية", "خارجية"].map((f) => <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>{f}</Chip>)}
        <label style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 12.5 }}>
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> إظهار غير النشطة
        </label>
      </div>
      {can.manage && <Btn bg={C.orange} onClick={() => setForm(true)} style={{ width: "100%", padding: 12, marginBottom: 12 }}>+ عملية قياسية جديدة</Btn>}
      {list.length === 0 && <Empty text="مكتبة قوالب: عرّف «تشحيم محامل» مرة واحدة واستخدمها في كل تعريفات وأوامر العمل." />}
      {list.map((o) => {
        const u = usage(o.id);
        return (
          <div key={o.id} style={{ ...card(), borderRightColor: isInactive(o) ? C.steel : o.type === "خارجية" ? C.purple : C.ink, opacity: isInactive(o) ? 0.6 : 1 }}
            onClick={() => setDetail(o.id)}>
            <Row main={o.code + " — " + o.name}
              badge={isInactive(o) ? { text: "غير نشطة", color: C.steel } : { text: o.type || "داخلية", color: o.type === "خارجية" ? C.purple : C.blue }}
              sub={[nameOf("workCenters", o.workCenterId) !== "—" ? nameOf("workCenters", o.workCenterId) : "",
                (o.resources || []).length + " مورد", (o.attachments || []).length ? (o.attachments || []).length + " مرفق" : "",
                u.defs.length + u.wos.length > 0 ? "مستخدمة في " + (u.defs.length + u.wos.length) : "",
                o.type === "خارجية" && o.supplier ? "مورد: " + o.supplier : ""].filter(Boolean).join(" · ")} />
          </div>
        );
      })}
      {form && (
        <FormSheet title="عملية قياسية جديدة" onClose={() => setForm(false)} db={db} schema={opSchema(null)}
          initial={{ type: "داخلية", countPoint: true, autoTransact: false }}
          onSave={(d) => {
            const err = validate(d, null);
            if (err) { alert(err); return; }
            add("stdOps", { resources: [], attachments: [], ...d }); setForm(false);
          }} />
      )}
      {detail && <StdOpDetail ctx={ctx} opId={detail} onClose={() => setDetail(null)} usage={usage} opSchema={opSchema} validate={validate} />}
    </>
  );
}

function StdOpDetail({ ctx, opId, onClose, usage, opSchema, validate }) {
  const { db, update, remove, nameOf, can } = ctx;
  const o = db.stdOps.find((x) => x.id === opId);
  const [sub, setSub] = useState("عام");
  const [edit, setEdit] = useState(false);
  const [resForm, setResForm] = useState(null); // null | "new" | resource obj
  const [altFor, setAltFor] = useState(null);
  if (!o) return null;
  const u = usage(o.id);
  const used = u.defs.length + u.wos.length > 0;
  const TABS = ["عام", "الموارد", "المرفقات", "أكواد الإصلاح", "الاستخدام"];
  const wcResources = db.resources.filter((r) => !o.workCenterId || r.workCenterId === o.workCenterId);
  const patchRes = (rs) => update("stdOps", o.id, { resources: rs });
  const resSchema = [
    { k: "seq", label: "التسلسل (نفس الرقم = موارد متزامنة)", type: "number" },
    { k: "resourceId", label: "المورد (من نفس مركز العمل)", type: "select",
      from: "resources", fromLabel: (r) => r.name + (r.workCenterId === o.workCenterId ? "" : " ⚠ خارج المركز") },
    { k: "units", label: "الوحدات المخصصة", type: "number" },
    { k: "basis", label: "الأساس", type: "select", options: OP_BASIS },
    { k: "usage", label: "الاستخدام (ساعات/وحدة — أكبر من صفر)", type: "number" },
    { k: "chargeType", label: "نوع التحميل", type: "select", options: OP_CHARGE },
    { k: "activity", label: "النشاط", type: "select", options: OP_ACTIVITY },
    { k: "scheduled", label: "يدخل في الجدولة", type: "check" },
    { k: "principal", label: "مورد رئيسي (واحد فقط لكل تسلسل متزامن)", type: "check" },
  ];
  const validateRes = (d, editing) => {
    if (!d.resourceId) return "اختر المورد";
    if (!(Number(d.usage) > 0)) return "الاستخدام يجب أن يكون أكبر من صفر";
    const r = db.resources.find((x) => x.id === d.resourceId);
    if (o.workCenterId && r && r.workCenterId !== o.workCenterId) return "المورد يجب أن يتبع نفس مركز العمل";
    if (d.principal && (o.resources || []).some((x) => x.id !== editing?.id && Number(x.seq) === Number(d.seq) && x.principal))
      return "يوجد مورد رئيسي آخر بنفس التسلسل المتزامن";
    return null;
  };
  return (
    <Sheet title={o.code + " — " + o.name} onClose={onClose}>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        <Badge text={o.type || "داخلية"} color={o.type === "خارجية" ? C.purple : C.blue} />
        {o.countPoint && <Badge text="نقطة عد" color={C.ink} />}
        {o.autoTransact && <Badge text="تنفيذ تلقائي" color={C.amber} />}
        {o.inactiveOn && daysUntil(o.inactiveOn) <= 0 && <Badge text="غير نشطة" color={C.steel} />}
        {can.manage && <Btn bg={C.blue} onClick={() => setEdit(true)}>تعديل</Btn>}
        {can.admin && (used
          ? <Btn bg={C.steel} onClick={() => { update("stdOps", o.id, { inactiveOn: today() }); alert("العملية مستخدمة — عُطّلت بدل الحذف (قاعدة ف7)"); }}>تعطيل (مستخدمة)</Btn>
          : <Btn bg={C.red} onClick={() => { if (confirm("حذف العملية نهائيًا؟")) { remove("stdOps", o.id); onClose(); } }}>حذف</Btn>)}
      </div>
      <div style={{ display: "flex", gap: 5, overflowX: "auto", marginBottom: 10 }}>
        {TABS.map((t) => <Chip key={t} active={sub === t} onClick={() => setSub(t)}>{t}</Chip>)}
      </div>

      {sub === "عام" && (
        <div style={{ ...card(), fontSize: 14, lineHeight: 2 }}>
          {o.description && <>{o.description}<br /></>}
          مركز العمل: <b>{nameOf("workCenters", o.workCenterId)}</b> · المدة: <b>{o.minutes || "—"} د</b><br />
          {o.type === "خارجية" && (<>
            المورد: <b>{o.supplier || "—"}</b> · الموقع: <b>{o.supplierSite || "—"}</b><br />
            صنف الخدمة: <b>{nameOf("items", o.ospItemId)}</b><br />
            <span style={{ fontSize: 12.5, color: C.steel }}>العملية الخارجية لا تحمل موارد داخلية.</span><br />
          </>)}
          {(o.steps || "").split("\n").filter(Boolean).length > 0 && (<>
            <b>الخطوات:</b>
            {(o.steps || "").split("\n").filter(Boolean).map((s, i) => <div key={i} style={{ fontSize: 13.5 }}>{(i + 1) + ". " + s}</div>)}
          </>)}
        </div>
      )}

      {sub === "الموارد" && (<>
        {o.type === "خارجية"
          ? <Empty text="الموارد للعمليات الداخلية فقط (قاعدة ف7)." />
          : (<>
            {(o.resources || []).slice().sort((a, b) => a.seq - b.seq).map((r) => (
              <div key={r.id} style={{ ...card(), borderRightColor: r.principal ? C.orange : C.ink }}>
                <Row main={r.seq + " — " + nameOf("resources", r.resourceId) + (r.principal ? " ★ رئيسي" : "")}
                  sub={[r.units + " وحدة", r.basis, "استخدام " + r.usage, r.chargeType + " التحميل", r.activity,
                    r.scheduled ? "مجدول" : "غير مجدول"].join(" · ")}
                  action={can.manage ? <Btn bg={C.blue} onClick={() => setResForm(r)}>تعديل</Btn> : null} />
                {(r.alternates || []).length > 0 && (
                  <div style={{ fontSize: 12.5, color: C.steel, marginTop: 4 }}>
                    البدائل: {(r.alternates || []).map((a) => nameOf("resources", a.resourceId) + " (أولوية " + a.priority + ")").join("، ")}
                  </div>
                )}
                {can.manage && (
                  <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                    <button onClick={() => setAltFor(r)} style={{ ...delBtn, color: C.blue, marginTop: 0 }}>+ مورد بديل</button>
                    <button onClick={() => patchRes(o.resources.filter((x) => x.id !== r.id))} style={{ ...delBtn, marginTop: 0 }}>حذف</button>
                  </div>
                )}
              </div>
            ))}
            {(o.resources || []).length === 0 && <Empty text="مثال: تسلسل 10 فني (رئيسي) + جهاز تشخيص متزامن، ثم تسلسل 20 مفتش جودة." />}
            {can.manage && <Btn bg={C.ink} onClick={() => setResForm("new")} style={{ width: "100%" }}>+ إضافة مورد للعملية</Btn>}
          </>)}
      </>)}

      {sub === "المرفقات" && (<>
        <div style={{ fontSize: 12.5, color: C.steel, marginBottom: 8 }}>تورَّث تعليمات العمل إلى أوامر العمل عند الإنشاء (نسخة).</div>
        {(o.attachments || []).map((a) => (
          <div key={a.id} style={card()}>
            <Row main={(a.type === "رابط" ? "🔗 " : "📝 ") + a.name}
              sub={a.type === "نص" ? a.value : ""}
              action={a.type === "رابط" && a.value ? <Btn bg={C.blue} onClick={() => window.open(a.value, "_blank")}>فتح</Btn> : null} />
            {can.manage && <button onClick={() => update("stdOps", o.id, { attachments: o.attachments.filter((x) => x.id !== a.id) })} style={delBtn}>حذف</button>}
          </div>
        ))}
        {can.manage && <AttachForm onAdd={(a) => update("stdOps", o.id, { attachments: [...(o.attachments || []), { id: uid(), ...a }] })} />}
      </>)}

      {sub === "أكواد الإصلاح" && (
        <div style={card()}>
          <div style={{ fontSize: 12.5, color: C.steel, marginBottom: 8 }}>تنتقل إلى عملية أمر العمل عند الإنشاء وتستخدم في تحليل الضمان والتقارير.</div>
          <Field label="سبب الإصلاح">
            <select value={o.repairReason || ""} onChange={(e) => update("stdOps", o.id, { repairReason: e.target.value })} disabled={!can.manage} style={input}>
              <option value="">—</option>{REPAIR_REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="كود معاملة الإصلاح (النظام/المكون)">
            <input value={o.repairTx || ""} onChange={(e) => update("stdOps", o.id, { repairTx: e.target.value })} disabled={!can.manage} placeholder="ELV-BRG محامل المصاعد…" style={input} />
          </Field>
          <Field label="العمل المنجز">
            <select value={o.workDone || ""} onChange={(e) => update("stdOps", o.id, { workDone: e.target.value })} disabled={!can.manage} style={input}>
              <option value="">—</option>{WORK_DONE.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
        </div>
      )}

      {sub === "الاستخدام" && (<>
        <Section title={"تعريفات العمل (" + u.defs.length + ") — مرجع: تحديث العملية ينعكس عليها"}>
          {u.defs.map((d) => <div key={d.id} style={card()}><Row main={d.name} /></div>)}
          {u.defs.length === 0 && <Empty text="غير مستخدمة في تعريفات عمل." />}
        </Section>
        <Section title={"أوامر العمل (" + u.wos.length + ") — نسخة: لا تتأثر بالتحديث"}>
          {u.wos.map((w) => <div key={w.id} style={card()}><Row main={w.number + " — " + w.title} badge={{ text: w.status, color: WO_COLORS[w.status] }} /></div>)}
          {u.wos.length === 0 && <Empty text="غير مستخدمة في أوامر عمل." />}
        </Section>
      </>)}

      {edit && (
        <FormSheet title="تعديل العملية القياسية" onClose={() => setEdit(false)} db={db} schema={opSchema(o)} initial={o}
          onSave={(d) => { const err = validate(d, o); if (err) { alert(err); return; } update("stdOps", o.id, d); setEdit(false); }} />
      )}
      {resForm && (
        <FormSheet title={resForm === "new" ? "إضافة مورد" : "تعديل مورد"} onClose={() => setResForm(null)} db={db} schema={resSchema}
          initial={resForm === "new" ? { seq: ((o.resources || []).length + 1) * 10, units: 1, basis: "ثابت", usage: 1, chargeType: "يدوي", activity: "تنفيذ", scheduled: true, principal: (o.resources || []).length === 0 } : resForm}
          onSave={(d) => {
            const err = validateRes(d, resForm === "new" ? null : resForm);
            if (err) { alert(err); return; }
            patchRes(resForm === "new" ? [...(o.resources || []), { id: uid(), alternates: [], ...d }]
              : o.resources.map((x) => x.id === resForm.id ? { ...x, ...d } : x));
            setResForm(null);
          }} />
      )}
      {altFor && (
        <FormSheet title={"مورد بديل لـ " + nameOf("resources", altFor.resourceId)} onClose={() => setAltFor(null)} db={db}
          schema={[
            { k: "resourceId", label: "المورد البديل (نشط، نفس مركز العمل)", type: "select", from: "resources", fromKey: "name" },
            { k: "priority", label: "الأولوية", type: "number" },
          ]} initial={{ priority: ((altFor.alternates || []).length + 1) }}
          onSave={(d) => {
            if (!d.resourceId) { alert("اختر البديل"); return; }
            if (d.resourceId === altFor.resourceId) { alert("البديل لا يكون نفس المورد الأساسي"); return; }
            if ((altFor.alternates || []).some((a) => a.resourceId === d.resourceId)) { alert("البديل مضاف مسبقًا"); return; }
            const r = db.resources.find((x) => x.id === d.resourceId);
            if (o.workCenterId && r && r.workCenterId !== o.workCenterId) { alert("البديل يجب أن يتبع نفس مركز العمل"); return; }
            patchRes(o.resources.map((x) => x.id === altFor.id ? { ...x, alternates: [...(x.alternates || []), d] } : x));
            setAltFor(null);
          }} />
      )}
    </Sheet>
  );
}

function AttachForm({ onAdd }) {
  const [name, setName] = useState(""); const [type, setType] = useState("رابط"); const [value, setValue] = useState("");
  return (
    <div style={card()}>
      <Field label="اسم المرفق"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="فيديو تشحيم المحامل" style={input} /></Field>
      <div style={{ display: "flex", gap: 8 }}>
        <Field label="النوع">
          <select value={type} onChange={(e) => setType(e.target.value)} style={input}>{ATTACH_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        </Field>
      </div>
      <Field label={type === "رابط" ? "الرابط (URL)" : "نص التعليمات"}>
        {type === "رابط"
          ? <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="https://…" style={input} />
          : <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={3} style={{ ...input, resize: "vertical" }} />}
      </Field>
      <Btn bg={C.ink} style={{ width: "100%" }} onClick={() => { if (name.trim()) { onAdd({ name, type, value }); setName(""); setValue(""); } }}>+ إضافة مرفق</Btn>
    </div>
  );
}

/* تعريفات العمل: عمليات + مواد + موارد + وقت (وثيقة التنفيذ §Work Definition) */
function WorkDefs({ ctx }) {
  return <Crud ctx={ctx} entity="workDefs" title="تعريفات العمل" schema={[
    { k: "name", label: "اسم التعريف (مثل: PM شهري للمصاعد)" },
    { k: "description", label: "الوصف", type: "textarea" },
    { k: "opIds", label: "العمليات (من القياسية)", type: "multi", from: "stdOps", fromKey: "name" },
    { k: "materials", label: "المواد المطلوبة (شحم، أدوات تنظيف…)" },
    { k: "resources", label: "الموارد المطلوبة (فني ميكانيكي + كهربائي…)" },
    { k: "estimatedHours", label: "الوقت التقديري (ساعات)", type: "number" },
  ]} render={(d) => [d.name, [(d.opIds || []).length + " عملية", d.estimatedHours ? d.estimatedHours + " ساعة" : "", d.materials].filter(Boolean).join(" · ")]} />;
}

/* ───────────────────────── طلبات العمل ───────────────────────── */
function Requests({ ctx, actRequest }) {
  const { db, nameOf, add, remove, can } = ctx;
  const [form, setForm] = useState(false);
  return (
    <>
      <Btn bg={C.orange} onClick={() => setForm(true)} style={{ width: "100%", padding: 12, marginBottom: 12 }}>+ طلب عمل جديد</Btn>
      {db.workRequests.length === 0 && <Empty text="لاحظ المشغّل صوتًا غير طبيعي؟ يرفع طلب عمل من هنا." />}
      {db.workRequests.map((r) => (
        <div key={r.id} style={card()}>
          <Row main={r.title} sub={nameOf("assets", r.assetId) + " · خطورة " + r.severity + (r.desc ? " · " + r.desc : "")}
            badge={{ text: r.status, color: { "مفتوح": C.amber, "مقبول": C.blue, "محوّل": C.green, "مرفوض": C.red }[r.status] }} />
          {can.manage && (
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              {(REQ_FLOW[r.status] || []).map((a) => (
                <Btn key={a} bg={a === "رفض" ? C.red : a === "قبول" ? C.blue : C.green} onClick={() => actRequest(r, a)}>{a}</Btn>
              ))}
              <button onClick={() => remove("workRequests", r.id)} style={delBtn}>حذف</button>
            </div>
          )}
        </div>
      ))}
      {form && (
        <FormSheet title="طلب عمل" onClose={() => setForm(false)} db={db}
          schema={[
            { k: "title", label: "وصف المشكلة (صوت غير طبيعي…)" },
            { k: "assetId", label: "الأصل", type: "select", from: "assets", fromKey: "name" },
            { k: "severity", label: "الخطورة", type: "select", options: ["منخفضة", "متوسطة", "حرجة"] },
            { k: "desc", label: "تفاصيل إضافية", type: "textarea" },
          ]} initial={{ severity: "متوسطة" }}
          onSave={(d) => {
            const exc = ctx.assetExclusion(d.assetId);
            if (exc.requests) { alert("⛔ الأصل مستبعد من طلبات العمل بواسطة مجموعة «" + exc.groupName + "»"); return; }
            add("workRequests", { status: "مفتوح", createdAt: today(), ...d }); setForm(false);
          }} />
      )}
    </>
  );
}

/* ───────────────────────── البرامج الوقائية ───────────────────────── */
function Programs({ ctx, programDue, generateWO }) {
  const { db, nameOf, add, remove, programAssets } = ctx;
  const [form, setForm] = useState(false);
  return (
    <>
      <Btn bg={C.orange} onClick={() => setForm(true)} style={{ width: "100%", padding: 12, marginBottom: 12 }}>+ متطلب صيانة وقائية</Btn>
      {db.programs.length === 0 && <Empty text="مثال: مراوح الصوامع — كل 500 ساعة تشغيل ← أمر عمل تلقائي." />}
      {db.programs.map((p) => {
        const info = programDue(p);
        return (
          <div key={p.id} style={{ ...card(), borderRightColor: info.due ? C.red : info.soon ? C.amber : C.ink }}>
            <Row main={p.name}
              sub={[(p.targetType === "مجموعة" ? "مجموعة " + nameOf("assetGroups", p.assetGroupId) + " (" + programAssets(p).length + " أصل)" : nameOf("assets", p.assetId)),
                p.method + " كل " + p.interval, info.label].join(" · ")}
              action={info.due
                ? <Btn bg={C.orange} onClick={() => generateWO(p)}>إنشاء</Btn>
                : <Badge text={info.soon ? "قريبًا ⏳" : "غير مستحق"} color={info.soon ? C.amber : C.steel} />} />
            <button onClick={() => remove("programs", p.id)} style={delBtn}>حذف</button>
          </div>
        );
      })}
      {form && (
        <FormSheet title="متطلب وقائي" onClose={() => setForm(false)} db={db}
          schema={[
            { k: "name", label: "اسم المتطلب (فحص شهري للمصاعد…)" },
            { k: "targetType", label: "يطبق على", type: "select", options: ["أصل واحد", "مجموعة"] },
            { k: "assetId", label: "الأصل (لو أصل واحد)", type: "select", from: "assets", fromKey: "name" },
            { k: "assetGroupId", label: "المجموعة (لو مجموعة)", type: "select", from: "assetGroups", fromKey: "name" },
            { k: "workDefId", label: "تعريف العمل (قالب PM)", type: "select", from: "workDefs", fromKey: "name" },
            { k: "method", label: "طريقة التوقع", type: "select", options: ["فاصل أيام", "فاصل عداد"] },
            { k: "interval", label: "الفاصل (أيام أو وحدات عداد)", type: "number" },
            { k: "assetMeterId", label: "عداد الأصل (لطريقة العداد — أصل واحد فقط)", type: "select", from: "assetMeters",
              fromLabel: (m) => nameOf("assets", m.assetId) + " / " + nameOf("meterTemplates", m.templateId) },
            { k: "startDate", label: "تاريخ البداية", type: "date" },
          ]} initial={{ targetType: "أصل واحد", method: "فاصل أيام", startDate: today() }}
          onSave={(d) => {
            if (d.targetType === "مجموعة" && d.method === "فاصل عداد") { alert("طريقة العداد تعمل مع أصل واحد فقط — استخدم فاصل الأيام للمجموعات"); return; }
            if (d.targetType === "مجموعة" && !d.assetGroupId) { alert("اختر المجموعة"); return; }
            add("programs", { lastMeterValue: 0, ...d }); setForm(false);
          }} />
      )}
    </>
  );
}

/* ───────────────────────── الهرميات المنطقية ومسارات الأصول (ف3 §14) ───────────────────────── */
function LogicalHierarchies({ ctx, openAsset }) {
  const { db, add, update, remove, nameOf, can, createWO, assetUsable } = ctx;
  const [form, setForm] = useState(null);
  const topmostOnly = (a) => !a.parentId; /* لا تضف فرعًا ماديًا — الأب الأعلى فقط */
  return (
    <>
      <div style={{ fontSize: 12.5, color: C.steel, marginBottom: 8 }}>
        الهرمية المنطقية تجمع أصولًا عبر المواقع (مصنع، خط، أسطول). فعّل «مسار أصول» لصيانة المجموعة بأمر عمل واحد.
      </div>
      {can.manage && <Btn bg={C.orange} onClick={() => setForm("new")} style={{ width: "100%", padding: 12, marginBottom: 12 }}>+ هرمية منطقية / مسار</Btn>}
      {db.logicalHierarchies.length === 0 && <Empty text="مثال مسار: «فحص طفايات المبنى أ» — كل الطفايات في قائمة أمر عمل واحد مع سماح بالتخطي." />}
      {db.logicalHierarchies.map((h) => (
        <div key={h.id} style={{ ...card(), borderRightColor: h.assetRoute ? C.purple : C.ink, opacity: h.disabled ? 0.6 : 1 }}>
          <Row main={(h.code ? h.code + " — " : "") + h.name}
            badge={h.assetRoute ? { text: "مسار أصول", color: C.purple } : h.disabled ? { text: "معطلة", color: C.steel } : undefined}
            sub={[(h.nodes || []).length + " أصل", h.allowSkip ? "يسمح بالتخطي" : ""].filter(Boolean).join(" · ")} />
          <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
            {can.manage && <button onClick={() => setForm(h)} style={{ ...delBtn, color: C.blue, marginTop: 0 }}>تعديل</button>}
            {can.manage && h.assetRoute && !h.disabled && (h.nodes || []).length > 0 && (
              <Btn bg={C.purple} onClick={() => {
                const nodes = (h.nodes || []).filter((id) => assetUsable(db.assets.find((x) => x.id === id)));
                if (!nodes.length) { alert("لا أصول صالحة في المسار"); return; }
                createWO({ title: "مسار — " + h.name, assetId: nodes[0], type: "وقائي", priority: "عادية",
                  plannedStart: today(), safetyRequired: true, routeId: h.id,
                  routeAssets: nodes.map((id) => ({ assetId: id, status: "معلق" })) });
                alert("✓ أُنشئ أمر عمل المسار يشمل " + nodes.length + " أصل");
              }}>إنشاء أمر عمل للمسار</Btn>
            )}
            {can.admin && <button onClick={() => { if (confirm("حذف الهرمية؟")) remove("logicalHierarchies", h.id); }} style={{ ...delBtn, marginTop: 0 }}>حذف</button>}
          </div>
        </div>
      ))}
      {form && (
        <FormSheet title={form === "new" ? "هرمية منطقية جديدة" : "تعديل هرمية"} onClose={() => setForm(null)} db={db}
          schema={[
            { k: "name", label: "الاسم (خط الطحن 1، أسطول الرياض…)" }, { k: "code", label: "الكود (فريد)" },
            { k: "description", label: "الوصف", type: "textarea" },
            { k: "assetRoute", label: "مسار أصول (صيانة المجموعة بأمر واحد)", type: "check" },
            { k: "allowSkip", label: "السماح بتخطي أصل أثناء التنفيذ", type: "check" },
            { k: "disabled", label: "معطلة", type: "check" },
            { k: "nodes", label: "الأصول (الأب الأعلى فقط — لا فروع مادية)", type: "multi", from: "assets", fromKey: "name" },
          ]} initial={form === "new" ? { nodes: [] } : form}
          onSave={(d) => {
            if (!String(d.name || "").trim()) { alert("الاسم مطلوب"); return; }
            if (d.code && db.logicalHierarchies.some((x) => x.code === d.code && x.id !== form?.id)) { alert("الكود مستخدم"); return; }
            const bad = (d.nodes || []).map((id) => db.assets.find((a) => a.id === id)).filter((a) => a && a.parentId);
            if (bad.length) { alert("هذه الأصول فروع مادية — أضف الأب الأعلى فقط:\n• " + bad.map((a) => a.name).join("\n• ")); return; }
            form === "new" ? add("logicalHierarchies", d) : update("logicalHierarchies", form.id, d);
            setForm(null);
          }} />
      )}
    </>
  );
}

/* ───────────────────────── مركز ضمان المورد (ف6) ───────────────────────── */
function WarrantyHub({ ctx, openWO }) {
  const { db, add, update, remove, nameOf, can, contractState, contractEffectiveEnd, contractCalcExpiration } = ctx;
  const [sub, setSub] = useState("العقود");
  const [covDetail, setCovDetail] = useState(null);
  const [claimDetail, setClaimDetail] = useState(null);
  const [contractForm, setContractForm] = useState(false);
  const SUBS = ["العقود", "التغطيات", "المطالبات", "الاستحقاقات", "أسعار العمالة", "أزمنة الإصلاح", "الموردون"];
  const stateColor = { "جاهز": C.green, "مسودة": C.steel, "منتهٍ": C.red };
  return (
    <>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12 }}>
        {SUBS.map((s) => <Chip key={s} active={sub === s} onClick={() => setSub(s)}>{s}</Chip>)}
      </div>

      {sub === "الموردون" && (
        <Crud ctx={ctx} entity="warrantyProviders" title="موردو الضمان" schema={[
          { k: "name", label: "اسم مورد الضمان / OEM" }, { k: "number", label: "رقم المورد" },
        ]} render={(p) => [p.name, p.number || ""]} />
      )}

      {sub === "أسعار العمالة" && (
        <Crud ctx={ctx} entity="laborRates" title="أسعار تعويض العمالة" schema={[
          { k: "providerId", label: "مورد الضمان", type: "select", from: "warrantyProviders", fromKey: "name" },
          { k: "hourlyRate", label: "سعر الساعة (ر.س)", type: "number" },
          { k: "startDate", label: "بداية السريان (≤ بداية العقد)", type: "date" },
          { k: "endDate", label: "نهاية السريان", type: "date" },
          { k: "active", label: "نشط", type: "check" },
        ]} render={(r) => [nameOf("warrantyProviders", r.providerId) + " — " + money(r.hourlyRate) + "/ساعة",
          fmt(r.startDate) + " ← " + (r.endDate ? fmt(r.endDate) : "مفتوح")]}
          badge={(r) => ({ text: r.active === false ? "موقوف" : "نشط", color: r.active === false ? C.steel : C.green })} />
      )}

      {sub === "أزمنة الإصلاح" && (
        <Crud ctx={ctx} entity="repairTimes" title="أزمنة الإصلاح القياسية" schema={[
          { k: "providerId", label: "مورد الضمان", type: "select", from: "warrantyProviders", fromKey: "name" },
          { k: "stdOpId", label: "العملية القياسية", type: "select", from: "stdOps", fromLabel: (o) => o.code + " — " + o.name },
          { k: "hours", label: "ساعات الإصلاح القابلة للتعويض", type: "number" },
          { k: "startDate", label: "بداية السريان", type: "date" },
          { k: "active", label: "نشط", type: "check" },
        ]} render={(t) => [nameOf("stdOps", t.stdOpId, "name") + " — " + t.hours + " ساعة",
          nameOf("warrantyProviders", t.providerId)]} />
      )}

      {sub === "التغطيات" && (<>
        {can.manage && <Btn bg={C.orange} onClick={() => setCovDetail("new")} style={{ width: "100%", padding: 12, marginBottom: 12 }}>+ قالب تغطية جديد</Btn>}
        {db.coverages.length === 0 && <Empty text="التغطية قالب reusable: المدة و/أو فاصل عداد + شروط التعويض + أكواد الإصلاح المغطاة." />}
        {db.coverages.map((v) => (
          <div key={v.id} style={{ ...card(), borderRightColor: v.status === "جاهز" ? C.green : C.steel }} onClick={() => setCovDetail(v.id)}>
            <Row main={v.code + " — " + v.name} badge={{ text: v.status, color: v.status === "جاهز" ? C.green : C.steel }}
              sub={[nameOf("warrantyProviders", v.providerId), v.duration ? v.duration + " " + v.durationUom : "",
                (v.meters || []).length ? (v.meters || []).length + " عداد" : "",
                db.contracts.filter((c) => c.coverageId === v.id).length + " عقد"].filter(Boolean).join(" · ")} />
          </div>
        ))}
      </>)}

      {sub === "العقود" && (<>
        {can.manage && <Btn bg={C.orange} onClick={() => setContractForm(true)} style={{ width: "100%", padding: 12, marginBottom: 12 }}>+ عقد ضمان لأصل</Btn>}
        {db.contracts.length === 0 && <Empty text="العقد ينشأ من تغطية «جاهز» لأصل محدد — وينتهي بالمدة أو العداد أيهما أقرب." />}
        {db.contracts.map((c) => {
          const st = contractState(c);
          const calc = contractCalcExpiration(c);
          return (
            <div key={c.id} style={{ ...card(), borderRightColor: stateColor[st] }}>
              <Row main={c.number + " — " + nameOf("assets", c.assetId)} badge={{ text: st, color: stateColor[st] }}
                sub={[nameOf("coverages", c.coverageId), "يبدأ " + fmt(c.startDate),
                  c.endDate ? "ينتهي " + fmt(c.endDate) : "", calc ? "متوقع بالعداد: " + fmt(calc) : ""].filter(Boolean).join(" · ")} />
              {can.manage && (
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  {c.status === "مسودة" && <Btn bg={C.green} onClick={() => update("contracts", c.id, { status: "جاهز" })}>جاهز</Btn>}
                  <button onClick={() => { if (confirm("حذف العقد؟")) remove("contracts", c.id); }} style={delBtn}>حذف</button>
                </div>
              )}
            </div>
          );
        })}
      </>)}

      {sub === "المطالبات" && (<>
        {db.claims.length === 0 && <Empty text="المطالبات تُنشأ من زر «توليد الاستحقاقات» داخل أمر العمل ← تبويب الضمان." />}
        {db.claims.map((cl) => {
          const ents = db.entitlements.filter((e) => e.claimId === cl.id);
          const total = ents.reduce((s, e) => s + Number(e.total || 0), 0) + (cl.adjustments || []).reduce((s, a) => s + Number(a.amount || 0), 0);
          return (
            <div key={cl.id} style={card()} onClick={() => setClaimDetail(cl.id)}>
              <Row main={cl.number + " — " + nameOf("warrantyProviders", cl.providerId)}
                badge={{ text: cl.status, color: { "قيد المراجعة": C.amber, "مُقدمة": C.blue, "محلولة": C.green, "مرفوضة": C.red }[cl.status] || C.steel }}
                sub={[db.workOrders.find((w) => w.id === cl.workOrderId)?.number, ents.length + " استحقاق", money(total)].filter(Boolean).join(" · ")} />
            </div>
          );
        })}
      </>)}

      {sub === "الاستحقاقات" && (<>
        {db.entitlements.length === 0 && <Empty text="الاستحقاق = نفقة مادة/مورد/إصلاح قياسي قابلة أو غير قابلة للتعويض." />}
        {db.entitlements.slice().reverse().map((e) => (
          <div key={e.id} style={{ ...card(), borderRightColor: e.included ? C.green : C.steel }}>
            <Row main={e.type + " — " + e.description} badge={e.included ? { text: "ضمن مطالبة", color: C.green } : { text: "مستبعد", color: C.steel }}
              sub={[e.qty + " × " + money(e.unitCost) + " = " + money(e.total),
                db.workOrders.find((w) => w.id === e.workOrderId)?.number,
                e.contractId ? db.contracts.find((c) => c.id === e.contractId)?.number : "بدون عقد (لا مطابقة)"].filter(Boolean).join(" · ")} />
          </div>
        ))}
      </>)}

      {covDetail && <CoverageDetail ctx={ctx} covId={covDetail} onClose={() => setCovDetail(null)} />}
      {claimDetail && <ClaimDetail ctx={ctx} claimId={claimDetail} onClose={() => setClaimDetail(null)} openWO={openWO} />}
      {contractForm && (
        <FormSheet title="عقد ضمان جديد" onClose={() => setContractForm(false)} db={db}
          schema={[
            { k: "assetId", label: "الأصل", type: "select", from: "assets", fromLabel: (a) => a.number + " — " + a.name },
            { k: "coverageId", label: "التغطية (جاهز فقط)", type: "select", from: "coverages", fromLabel: (v) => v.code + " — " + v.name + (v.status !== "جاهز" ? " (مسودة ✗)" : "") },
            { k: "startDate", label: "بداية التغطية", type: "date" },
            { k: "extRef", label: "مرجع خارجي (رقم أمر الشراء…)" },
            { k: "notes", label: "ملاحظات العقد", type: "textarea" },
          ]} initial={{ startDate: today() }}
          onSave={(d) => {
            if (!d.assetId || !d.coverageId) { alert("اختر الأصل والتغطية"); return; }
            const cov = db.coverages.find((v) => v.id === d.coverageId);
            if (cov.status !== "جاهز") { alert("التغطية مسودة — يجب أن تكون «جاهز» لإنشاء عقود (قاعدة ف6)"); return; }
            let endDate = "";
            if (cov.duration) {
              const dt = new Date(d.startDate + "T00:00:00");
              dt.setDate(dt.getDate() + Number(cov.duration) * (DUR_UOM[cov.durationUom] || 1));
              endDate = dt.toISOString().slice(0, 10);
            }
            /* عدادات التغطية يجب أن تطابق عدادات الأصل، وإلا يبقى العقد مسودة للمراجعة */
            const meters = (cov.meters || []).filter((m) => m.enabled !== false).map((m) => ({ ...m }));
            const mismatch = meters.some((m) => !db.assetMeters.some((am) => am.assetId === d.assetId && am.templateId === m.templateId));
            add("contracts", { number: "CW-" + String(1000 + db.contracts.length + 1), status: mismatch ? "مسودة" : "جاهز",
              endDate, meters, ...d });
            if (mismatch) alert("⚠ عدادات التغطية لا تطابق عدادات الأصل — أُنشئ العقد كمسودة للمراجعة");
            setContractForm(false);
          }} />
      )}
    </>
  );
}

function CoverageDetail({ ctx, covId, onClose }) {
  const { db, add, update, nameOf, can } = ctx;
  const isNew = covId === "new";
  const v = isNew ? null : db.coverages.find((x) => x.id === covId);
  const [f, setF] = useState(isNew ? { status: "مسودة", durationUom: "شهر", laborReimb: true, partsReimb: true, startDate: today() } : null);
  const hasContracts = v ? db.contracts.some((c) => c.coverageId === v.id) : false;
  if (isNew) {
    return (
      <FormSheet title="قالب تغطية — الأساسيات" onClose={onClose} db={db}
        schema={[
          { k: "code", label: "الكود (فريد، لا يتغير بعد الإنشاء)" }, { k: "name", label: "اسم التغطية" },
          { k: "description", label: "الوصف", type: "textarea" },
          { k: "providerId", label: "مورد الضمان (إلزامي)", type: "select", from: "warrantyProviders", fromKey: "name" },
          { k: "type", label: "نوع التغطية", type: "select", options: COV_TYPES },
          { k: "startDate", label: "بداية القالب", type: "date" }, { k: "endDate", label: "نهاية القالب (يمنع عقودًا جديدة)", type: "date" },
          { k: "duration", label: "مدة الضمان (اتركها فارغة لو عداد فقط)", type: "number" },
          { k: "durationUom", label: "وحدة المدة", type: "select", options: Object.keys(DUR_UOM) },
          { k: "laborReimb", label: "تعويض العمالة (الموارد تدخل المطالبة)", type: "check" },
          { k: "partsReimb", label: "تعويض القطع (المواد تدخل المطالبة)", type: "check" },
          { k: "terms", label: "شروط الخدمة (نص حر)", type: "textarea" },
        ]} initial={f}
        onSave={(d) => {
          if (!d.code || !d.name) { alert("الكود والاسم مطلوبان"); return; }
          if (db.coverages.some((x) => x.code === d.code)) { alert("الكود مستخدم"); return; }
          if (!d.providerId) { alert("مورد الضمان إلزامي"); return; }
          add("coverages", { status: "مسودة", meters: [], repairCodes: [], items: [], ...d });
          onClose();
        }} />
    );
  }
  if (!v) return null;
  return (
    <Sheet title={v.code + " — " + v.name} onClose={onClose}>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        <Badge text={v.status} color={v.status === "جاهز" ? C.green : C.steel} />
        {can.manage && v.status === "مسودة" && (
          <Btn bg={C.green} onClick={() => {
            if (!v.duration && !(v.meters || []).some((m) => m.enabled !== false)) { alert("«جاهز» يتطلب مدة أو فاصل عداد — العقد يحتاج طريقة انتهاء (قاعدة ف6)"); return; }
            update("coverages", v.id, { status: "جاهز" });
          }}>تحويل إلى جاهز</Btn>
        )}
        {can.manage && v.status === "جاهز" && !hasContracts && <Btn bg={C.steel} onClick={() => update("coverages", v.id, { status: "مسودة" })}>إرجاع لمسودة</Btn>}
        {hasContracts && <span style={{ fontSize: 12, color: C.steel, alignSelf: "center" }}>توجد عقود — لا رجوع لمسودة ولا حذف صفوف (عطّل بدلًا منه)</span>}
      </div>
      <div style={{ ...card(), fontSize: 13.5, lineHeight: 2 }}>
        المورد: <b>{nameOf("warrantyProviders", v.providerId)}</b> · النوع: <b>{v.type || "—"}</b><br />
        المدة: <b>{v.duration ? v.duration + " " + v.durationUom : "—"}</b> · تعويض العمالة: <b>{v.laborReimb ? "نعم" : "لا"}</b> · تعويض القطع: <b>{v.partsReimb ? "نعم" : "لا"}</b>
        {v.terms && <><br />الشروط: {v.terms}</>}
      </div>
      <Section title={"عدادات الاستخدام (" + (v.meters || []).length + ") — ينتهي العقد بالأقرب"}>
        {(v.meters || []).map((m) => (
          <div key={m.id} style={{ ...card(), opacity: m.enabled === false ? 0.5 : 1 }}>
            <Row main={nameOf("meterTemplates", m.templateId)} sub={"من " + m.startValue + " + فاصل " + m.interval + " = نهاية " + (Number(m.startValue || 0) + Number(m.interval || 0))}
              action={can.manage && m.enabled !== false ? <Btn bg={C.steel} onClick={() => update("coverages", v.id, { meters: v.meters.map((x) => x.id === m.id ? { ...x, enabled: false } : x) })}>تعطيل</Btn> : m.enabled === false ? <Badge text="معطل" color={C.steel} /> : null} />
          </div>
        ))}
        {can.manage && <CovMeterForm ctx={ctx} onAdd={(m) => update("coverages", v.id, { meters: [...(v.meters || []), { id: uid(), enabled: true, ...m }] })} />}
      </Section>
      <Section title={"أكواد الإصلاح المغطاة (" + (v.repairCodes || []).length + ")"}>
        <div style={{ fontSize: 12.5, color: C.steel, marginBottom: 6 }}>مثال: 013 فرامل ← 013-001 فرامل أمامية. الكود الأعلى يغطي ما تحته.</div>
        {(v.repairCodes || []).map((r) => (
          <div key={r.id} style={{ ...card(), opacity: r.enabled === false ? 0.5 : 1 }}>
            <Row main={r.code} sub={r.description}
              action={can.manage && r.enabled !== false ? <Btn bg={C.steel} onClick={() => update("coverages", v.id, { repairCodes: v.repairCodes.map((x) => x.id === r.id ? { ...x, enabled: false } : x) })}>تعطيل</Btn> : r.enabled === false ? <Badge text="معطل" color={C.steel} /> : null} />
          </div>
        ))}
        {can.manage && <AddInline placeholder="الكود، الوصف (ELV-BRG، محامل المصاعد)" onAdd={(t) => {
          const seg = t.includes("،") ? t.split("،") : t.split(",");
          update("coverages", v.id, { repairCodes: [...(v.repairCodes || []), { id: uid(), code: (seg[0] || t).trim(), description: (seg[1] || "").trim(), enabled: true }] });
        }} />}
      </Section>
      <Section title={"العقود المنشأة (" + db.contracts.filter((c) => c.coverageId === v.id).length + ")"}>
        {db.contracts.filter((c) => c.coverageId === v.id).map((c) => (
          <div key={c.id} style={card()}><Row main={c.number + " — " + nameOf("assets", c.assetId)} sub={"يبدأ " + fmt(c.startDate)} /></div>
        ))}
      </Section>
    </Sheet>
  );
}

function CovMeterForm({ ctx, onAdd }) {
  const { db } = ctx;
  const [tpl, setTpl] = useState(""); const [start, setStart] = useState("0"); const [intv, setIntv] = useState("");
  return (
    <div style={card()}>
      <div style={{ display: "flex", gap: 8 }}>
        <Field label="قالب العداد">
          <select value={tpl} onChange={(e) => setTpl(e.target.value)} style={input}>
            <option value="">—</option>
            {db.meterTemplates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.uom})</option>)}
          </select>
        </Field>
        <Field label="البداية"><input type="number" value={start} onChange={(e) => setStart(e.target.value)} style={input} /></Field>
        <Field label="الفاصل (5000…)"><input type="number" value={intv} onChange={(e) => setIntv(e.target.value)} style={input} /></Field>
      </div>
      <Btn bg={C.ink} style={{ width: "100%" }} onClick={() => {
        if (!tpl || !Number(intv)) { alert("اختر العداد وأدخل الفاصل"); return; }
        onAdd({ templateId: tpl, startValue: Number(start || 0), interval: Number(intv) });
        setTpl(""); setStart("0"); setIntv("");
      }}>+ إضافة فاصل عداد</Btn>
    </div>
  );
}

function ClaimDetail({ ctx, claimId, onClose, openWO }) {
  const { db, update, remove, nameOf, can, woCost } = ctx;
  const cl = db.claims.find((x) => x.id === claimId);
  const [adj, setAdj] = useState("");
  if (!cl) return null;
  const wo = db.workOrders.find((w) => w.id === cl.workOrderId);
  const allEnts = db.entitlements.filter((e) => e.workOrderId === cl.workOrderId);
  const inc = allEnts.filter((e) => e.claimId === cl.id);
  const adjTotal = (cl.adjustments || []).reduce((s, a) => s + Number(a.amount || 0), 0);
  const total = inc.reduce((s, e) => s + Number(e.total || 0), 0) + adjTotal;
  const byType = {};
  inc.forEach((e) => { byType[e.type] = (byType[e.type] || 0) + Number(e.total || 0); });
  const woTotal = wo ? woCost(wo).total : 0;
  return (
    <Sheet title={"مطالبة " + cl.number} onClose={onClose}>
      <div style={{ ...card(), fontSize: 13.5, lineHeight: 2 }}>
        المورد: <b>{nameOf("warrantyProviders", cl.providerId)}</b> · الأمر: <b style={{ textDecoration: "underline" }} onClick={() => wo && openWO(wo.id)}>{wo?.number || "—"}</b><br />
        مبلغ المطالبة: <b>{money(total)}</b> · تكلفة الأمر: <b>{money(woTotal)}</b>
        {total !== woTotal && <span style={{ color: C.amber }}> (الفرق = معاملات لم تدخل المطالبة)</span>}
      </div>
      {can.manage && (<>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="حالة المطالبة">
            <select value={cl.status} onChange={(e) => update("claims", cl.id, { status: e.target.value, ...(e.target.value === "محلولة" ? { resolutionDate: today() } : {}) })} style={input}>
              {CLAIM_STATUS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="موعد التقديم"><input type="date" value={cl.submitBy || ""} onChange={(e) => update("claims", cl.id, { submitBy: e.target.value })} style={input} /></Field>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="المسؤول"><input value={cl.assignedTo || ""} onChange={(e) => update("claims", cl.id, { assignedTo: e.target.value })} style={input} /></Field>
          <Field label="مبلغ التعويض الفعلي"><input type="number" value={cl.reimbursementAmount || ""} onChange={(e) => update("claims", cl.id, { reimbursementAmount: e.target.value })} style={input} /></Field>
        </div>
      </>)}
      <Section title={"الاستحقاقات — إدخال/إخراج (" + inc.length + "/" + allEnts.length + ")"}>
        {allEnts.map((e) => {
          const isIn = e.claimId === cl.id;
          return (
            <div key={e.id} style={{ ...card(), borderRightColor: isIn ? C.green : C.steel, opacity: isIn ? 1 : 0.65 }}>
              <Row main={e.type + " — " + e.description} sub={e.qty + " × " + money(e.unitCost) + " = " + money(e.total) + (e.contractId ? "" : " · بدون عقد")}
                action={can.manage ? (isIn
                  ? <Btn bg={C.steel} onClick={() => update("entitlements", e.id, { claimId: "", included: false })}>إخراج</Btn>
                  : <Btn bg={C.green} onClick={() => update("entitlements", e.id, { claimId: cl.id, included: true })}>إدخال</Btn>) : null} />
            </div>
          );
        })}
      </Section>
      <Section title="مراجعة المبالغ">
        <div style={card()}>
          {Object.entries(byType).map(([t, s]) => (
            <div key={t} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 4 }}><span>{t}</span><b>{money(s)}</b></div>
          ))}
          {(cl.adjustments || []).map((a, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 4, color: C.amber }}><span>تعديل: {a.desc}</span><b>{money(a.amount)}</b></div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, borderTop: `1px solid ${C.line}`, paddingTop: 6, fontWeight: 800 }}>
            <span>الإجمالي</span><span>{money(total)}</span>
          </div>
        </div>
        {can.manage && (
          <div style={{ display: "flex", gap: 8 }}>
            <input type="number" value={adj} onChange={(e) => setAdj(e.target.value)} placeholder="مبلغ تعديل +/−" style={input} />
            <Btn bg={C.amber} onClick={() => { if (adj !== "") { update("claims", cl.id, { adjustments: [...(cl.adjustments || []), { desc: "تعديل يدوي", amount: Number(adj) }] }); setAdj(""); } }}>إضافة</Btn>
          </div>
        )}
      </Section>
      {can.admin && <Btn bg={C.red} style={{ width: "100%", padding: 12 }} onClick={() => { if (confirm("حذف المطالبة؟ (الاستحقاقات تبقى)")) { db.entitlements.filter((e) => e.claimId === cl.id).forEach((e) => update("entitlements", e.id, { claimId: "", included: false })); remove("claims", cl.id); onClose(); } }}>حذف المطالبة</Btn>}
    </Sheet>
  );
}

/* ───────────────────────── المخزون وقطع الغيار (وثيقة المخزون) ───────────────────────── */
function Inventory({ ctx, openWO }) {
  const { db, add, update, remove, nameOf, can, onHand, reservedQty, availableQty, addTx } = ctx;
  const [sub, setSub] = useState("الرصيد");
  const [txForm, setTxForm] = useState(null); // نوع الحركة
  const [stockCard, setStockCard] = useState(null);
  const SUBS = ["الرصيد", "الأصناف", "المستودعات", "الحركات", "التجهيز والصرف", "تنبيهات", "تقارير"];
  const canStock = can.warehouse; /* لا تعديل مخزون مباشر من الفني */

  /* قوائم التجهيز: أوامر مفتوحة فيها مواد محجوزة لم تُصرف */
  const pickWOs = db.workOrders.filter((w) => ACTIVE_STATES.includes(w.status) &&
    (w.materials || []).some((m) => m.itemId && m.reserved && !Number(m.issuedQty || 0)));
  const lowStock = db.items.filter((i) => i.min !== "" && i.min != null && onHand(i.id) <= Number(i.min));
  const valuation = db.items.reduce((s, i) => s + onHand(i.id) * Number(i.unitCost || 0), 0);

  /* استهلاك المواد حسب الأصل */
  const consumptionByAsset = {};
  db.workOrders.forEach((w) => (w.materials || []).forEach((m) => {
    const c = Number(m.usedQty || 0) * Number(m.unitCost || 0);
    if (c > 0) consumptionByAsset[w.assetId] = (consumptionByAsset[w.assetId] || 0) + c;
  }));
  const consumption = Object.entries(consumptionByAsset).map(([id, c]) => ({ name: nameOf("assets", id), c })).sort((a, b) => b.c - a.c).slice(0, 8);

  return (
    <>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12 }}>
        {SUBS.map((s) => <Chip key={s} active={sub === s} onClick={() => setSub(s)}>{s}</Chip>)}
      </div>

      {sub === "الأصناف" && (
        <Crud ctx={ctx} entity="items" title="ماستر الأصناف" schema={[
          { k: "code", label: "كود الصنف (BRG-6312…)" }, { k: "name", label: "اسم الصنف" },
          { k: "category", label: "الفئة", type: "select", options: ITEM_CATS },
          { k: "uom", label: "وحدة القياس (قطعة، لتر…)" },
          { k: "unitCost", label: "تكلفة الوحدة (ر.س)", type: "number" },
          { k: "min", label: "الحد الأدنى", type: "number" }, { k: "max", label: "الحد الأقصى", type: "number" },
          { k: "critical", label: "قطعة حرجة", type: "check" },
        ]} render={(i) => [i.code + " — " + i.name,
          [i.category, "رصيد " + onHand(i.id) + " " + (i.uom || ""), money(i.unitCost) + "/وحدة", i.critical ? "⚠ حرجة" : ""].filter(Boolean).join(" · ")]} />
      )}

      {sub === "المستودعات" && (
        <Crud ctx={ctx} entity="warehouses" title="المستودعات والمخازن الفرعية" schema={[
          { k: "name", label: "اسم المستودع/المخزن" }, { k: "code", label: "الرمز" },
          { k: "location", label: "الموقع" },
        ]} render={(w) => [w.name, [w.code, w.location].filter(Boolean).join(" · ")]} />
      )}

      {sub === "الرصيد" && (<>
        {canStock && (
          <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
            <Btn bg={C.green} onClick={() => setTxForm("استلام")}>+ استلام</Btn>
            <Btn bg={C.blue} onClick={() => setTxForm("تحويل")}>تحويل</Btn>
            <Btn bg={C.amber} onClick={() => setTxForm("تسوية")}>تسوية</Btn>
            <Btn bg={C.red} onClick={() => setTxForm("إتلاف")}>إتلاف</Btn>
          </div>
        )}
        {db.items.length === 0 && <Empty text="أضف الأصناف أولًا من تبويب «الأصناف» ثم سجّل استلامًا." />}
        {db.items.map((i) => {
          const oh = onHand(i.id), rs = reservedQty(i.id), av = oh - rs;
          const low = i.min !== "" && i.min != null && oh <= Number(i.min);
          return (
            <div key={i.id} style={{ ...card(), borderRightColor: low ? C.red : C.ink }} onClick={() => setStockCard(i)}>
              <Row main={i.code + " — " + i.name}
                sub={"الرصيد: " + oh + " · محجوز: " + rs + " · المتاح: " + av + " " + (i.uom || "") + (low ? " · ⚠ تحت الحد الأدنى (" + i.min + ")" : "")}
                badge={i.critical ? { text: "حرجة", color: C.red } : undefined} />
            </div>
          );
        })}
      </>)}

      {sub === "الحركات" && (<>
        {db.stockTx.length === 0 && <Empty text="لا حركات بعد — الرصيد لا يتغير إلا بحركة (قاعدة النظام)." />}
        {db.stockTx.slice().reverse().slice(0, 50).map((t) => (
          <div key={t.id} style={{ ...card(), borderRightColor: ["صرف لأمر عمل", "إتلاف"].includes(t.type) ? C.red : t.type === "استلام" || t.type === "إرجاع من أمر عمل" ? C.green : C.amber }}>
            <Row main={t.type + " — " + nameOf("items", t.itemId)}
              sub={["كمية " + t.qty, t.at, t.workOrderId ? db.workOrders.find((w) => w.id === t.workOrderId)?.number : "",
                t.warehouseId ? nameOf("warehouses", t.warehouseId) : "", t.note].filter(Boolean).join(" · ")} />
          </div>
        ))}
      </>)}

      {sub === "التجهيز والصرف" && (<>
        {pickWOs.length === 0 && <Empty text="لا مواد محجوزة بانتظار التجهيز. تُحجز المواد من داخل أمر العمل." />}
        {pickWOs.map((w) => (
          <div key={w.id} style={card()} onClick={() => openWO(w.id)}>
            <Row main={"قائمة تجهيز — " + w.number} badge={{ text: w.status, color: WO_COLORS[w.status] }}
              sub={(w.materials || []).filter((m) => m.reserved && !Number(m.issuedQty || 0))
                .map((m) => nameOf("items", m.itemId) + " ×" + m.qty).join("، ")} />
          </div>
        ))}
      </>)}

      {sub === "تنبيهات" && (<>
        {lowStock.length === 0 && <Empty text="لا أصناف تحت الحد الأدنى. 👌" />}
        {lowStock.map((i) => (
          <div key={i.id} style={{ ...card(), borderRightColor: C.red }}>
            <Row main={i.code + " — " + i.name}
              sub={"الرصيد " + onHand(i.id) + " ≤ الحد الأدنى " + i.min + " — أنشئ طلب شراء"}
              badge={i.critical ? { text: "حرجة ⚠", color: C.red } : { text: "إعادة طلب", color: C.amber }} />
          </div>
        ))}
      </>)}

      {sub === "تقارير" && (<>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <Stat n={money(valuation)} label="قيمة المخزون" color={C.blue} small />
          <Stat n={db.items.length} label="أصناف" color={C.ink} />
          <Stat n={lowStock.length} label="تحت الحد" color={lowStock.length ? C.red : C.steel} />
        </div>
        <Section title="استهلاك المواد حسب الأصل (ر.س)">
          {consumption.length === 0 && <Empty text="سيظهر عند صرف واستخدام مواد على أوامر العمل." />}
          <div style={card()}>
            {consumption.map((x) => (
              <div key={x.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 4 }}>
                <span>{x.name}</span><b>{money(x.c)}</b>
              </div>
            ))}
          </div>
        </Section>
      </>)}

      {txForm && (
        <FormSheet title={"حركة مخزون — " + txForm} onClose={() => setTxForm(null)} db={db}
          schema={[
            { k: "itemId", label: "الصنف", type: "select", from: "items", fromLabel: (i) => i.code + " — " + i.name },
            { k: "qty", label: txForm === "تسوية" ? "الكمية (+/−)" : "الكمية", type: "number" },
            ...(db.warehouses.length ? [{ k: "warehouseId", label: txForm === "تحويل" ? "من مستودع" : "المستودع", type: "select", from: "warehouses", fromKey: "name" }] : []),
            ...(txForm === "تحويل" ? [{ k: "toWarehouseId", label: "إلى مستودع", type: "select", from: "warehouses", fromKey: "name" }] : []),
            { k: "note", label: "ملاحظة" },
          ]} initial={{ qty: 1 }}
          onSave={(d) => {
            if (!d.itemId) { alert("اختر الصنف"); return; }
            if (["صرف لأمر عمل", "إتلاف"].includes(txForm) && Number(d.qty) > onHand(d.itemId)) { alert("الكمية أكبر من الرصيد"); return; }
            if (txForm === "إتلاف" && Number(d.qty) > onHand(d.itemId)) { alert("الكمية أكبر من الرصيد"); return; }
            addTx({ type: txForm, ...d }); setTxForm(null);
          }} />
      )}
      {stockCard && (
        <Sheet title={"بطاقة صنف — " + stockCard.code} onClose={() => setStockCard(null)}>
          <div style={{ ...card(), fontSize: 14, lineHeight: 2 }}>
            <b>{stockCard.name}</b> · {stockCard.category || "—"}<br />
            الرصيد: <b>{onHand(stockCard.id)}</b> · محجوز: <b>{reservedQty(stockCard.id)}</b> · المتاح: <b>{availableQty(stockCard.id)}</b> {stockCard.uom || ""}<br />
            تكلفة الوحدة: {money(stockCard.unitCost)} · قيمة الرصيد: <b>{money(onHand(stockCard.id) * Number(stockCard.unitCost || 0))}</b>
          </div>
          <Section title="يُستخدم في الأصول">
            {db.assets.filter((a) => (a.parts || []).some((p) => p.itemId === stockCard.id || p.name === stockCard.name)).map((a) => (
              <div key={a.id} style={card()}><Row main={a.number + " — " + a.name} sub={a.location} /></div>
            ))}
            {db.assets.filter((a) => (a.parts || []).some((p) => p.itemId === stockCard.id || p.name === stockCard.name)).length === 0 &&
              <Empty text="غير مربوط بأصول — اربطه من ملف الأصل ← قطع الغيار." />}
          </Section>
          <Section title="الحركات (بطاقة الصنف)">
            {db.stockTx.filter((t) => t.itemId === stockCard.id).slice().reverse().map((t) => (
              <div key={t.id} style={{ fontSize: 13, color: C.steel, marginBottom: 4, borderBottom: `1px dashed ${C.line}`, paddingBottom: 4 }}>
                <b style={{ color: C.ink }}>{t.type}</b> · {t.qty} · {t.at}
                {t.workOrderId ? " · " + (db.workOrders.find((w) => w.id === t.workOrderId)?.number || "") : ""}
              </div>
            ))}
            {db.stockTx.filter((t) => t.itemId === stockCard.id).length === 0 && <Empty text="لا حركات لهذا الصنف." />}
          </Section>
        </Sheet>
      )}
    </>
  );
}

/* ───────────────────────── الأصول ───────────────────────── */
/* ───────────────────────── مجموعات الأصول: قواعد ← مجموعات ← تعيينات (ف4) ───────────────────────── */
function AssetGroups({ ctx }) {
  const { db, add, update, remove, nameOf, can, groupRule, groupActive, activeAssignments } = ctx;
  const [sub, setSub] = useState("المجموعات");
  const [q, setQ] = useState("");
  const [ruleForm, setRuleForm] = useState(null);
  const [groupForm, setGroupForm] = useState(null);
  const [detail, setDetail] = useState(null);
  const stdRule = () => {
    let r = db.assetGroupRules.find((x) => x.code === "STD");
    if (!r) r = add("assetGroupRules", { name: "التصنيف القياسي", code: "STD", description: "", attributes: [], usages: ["عام (صيانة وبرامج)"], enforceUnique: false, inactiveOn: "" });
    return r;
  };
  const missing = STANDARD_GROUPS.filter(([code]) => !db.assetGroups.some((g) => g.code === code));
  const seed = () => {
    const r = stdRule();
    missing.forEach(([code, name], i) => add("assetGroups", { code, name, ruleId: r.id,
      number: "AG-" + String(100 + db.assetGroups.length + i + 1), description: "", attrValues: {},
      excludeFromRequests: false, excludeFromWO: false, inactiveOn: "", assignments: [], assetIds: [] }));
  };
  const ruleHasGroups = (rid) => db.assetGroups.some((g) => g.ruleId === rid);
  const ruleHasAssignments = (rid) => db.assetGroups.some((g) => g.ruleId === rid && (g.assignments || []).length > 0);
  const isStatusRule = (r) => (r.usages || []).includes("حالة الأصل (قاعدة تحقق)");

  const ruleSchema = (editing) => [
    { k: "name", label: "اسم القاعدة" }, { k: "code", label: "الكود (فريد)" },
    { k: "description", label: "الوصف", type: "textarea" },
    { k: "usages", label: "الاستخدامات", type: "multi-static", options: RULE_USAGES },
    { k: "attributes", label: "خصائص التجميع" + (editing && ruleHasGroups(editing.id) ? " — مقفلة (توجد مجموعات)" : ""), type: "multi-static", options: GROUP_ATTRS.map(([, l]) => l) },
    { k: "enforceUnique", label: "تعيين فريد (الأصل في مجموعة واحدة ضمن القاعدة)" + (editing && ruleHasAssignments(editing.id) ? " — مقفل (توجد تعيينات)" : ""), type: "check" },
    { k: "inactiveOn", label: "تعطيل اعتبارًا من (لا مجموعات جديدة بعده)", type: "date" },
  ];
  const attrKeyByLabel = (l) => GROUP_ATTRS.find(([, lab]) => lab === l)?.[0] || l;
  const validateRule = (d, editing) => {
    if (!String(d.name || "").trim() || !String(d.code || "").trim()) return "الاسم والكود مطلوبان";
    if (db.assetGroupRules.some((r) => r.code === d.code && r.id !== editing?.id)) return "الكود مستخدم";
    if (!(d.usages || []).length) return "اختر استخدامًا واحدًا على الأقل";
    if ((d.usages || []).includes("حالة الأصل (قاعدة تحقق)")) {
      if ((d.usages || []).length > 1) return "«حالة الأصل» لا يجتمع مع استخدامات أخرى (قاعدة ف4)";
      if ((d.attributes || []).length) return "«حالة الأصل»: خصائص التجميع معطلة — أي أصل يمكن تعيينه";
      d.enforceUnique = true; /* إجباري */
      if (db.assetGroupRules.some((r) => r.id !== editing?.id && (r.usages || []).includes("حالة الأصل (قاعدة تحقق)")))
        return "قاعدة واحدة فقط من نوع «حالة الأصل» مسموحة";
    }
    if (editing) {
      const oldAttrs = JSON.stringify((editing.attributes || []).slice().sort());
      if (JSON.stringify((d.attributes || []).slice().sort()) !== oldAttrs && ruleHasGroups(editing.id)) return "لا تغيّر خصائص التجميع — توجد مجموعات تحت القاعدة";
      if (!!d.enforceUnique !== !!editing.enforceUnique && ruleHasAssignments(editing.id)) return "لا تغيّر «التعيين الفريد» — توجد أصول معينة";
    }
    return null;
  };

  let groups = db.assetGroups.filter((g) => !q || ((g.name || "") + (g.number || "") + (g.code || "") + (groupRule(g)?.name || "")).includes(q));

  return (
    <>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <Chip active={sub === "المجموعات"} onClick={() => setSub("المجموعات")}>المجموعات ({db.assetGroups.length})</Chip>
        <Chip active={sub === "القواعد"} onClick={() => setSub("القواعد")}>القواعد ({db.assetGroupRules.length})</Chip>
      </div>

      {sub === "القواعد" && (<>
        {can.manage && <Btn bg={C.orange} onClick={() => setRuleForm("new")} style={{ width: "100%", padding: 12, marginBottom: 12 }}>+ قاعدة مجموعات جديدة</Btn>}
        {db.assetGroupRules.length === 0 && <Empty text="ابدأ بالقاعدة: «مركبات حسب الموقع» بخاصية الموقع، ثم أنشئ مجموعاتها." />}
        {db.assetGroupRules.map((r) => (
          <div key={r.id} style={{ ...card(), borderRightColor: isStatusRule(r) ? C.red : C.ink, opacity: (!r.inactiveOn || r.inactiveOn >= today()) ? 1 : 0.6 }}
            onClick={() => can.manage && setRuleForm(r)}>
            <Row main={r.code + " — " + r.name}
              badge={isStatusRule(r) ? { text: "حالة الأصل", color: C.red } : r.enforceUnique ? { text: "فريد", color: C.purple } : undefined}
              sub={[(r.attributes || []).length ? "خصائص: " + (r.attributes || []).join("، ") : "بلا خصائص",
                db.assetGroups.filter((g) => g.ruleId === r.id).length + " مجموعة",
                r.inactiveOn && r.inactiveOn < today() ? "معطلة" : ""].filter(Boolean).join(" · ")} />
          </div>
        ))}
      </>)}

      {sub === "المجموعات" && (<>
        {missing.length > 0 && (
          <div style={{ ...card(), borderRightColor: C.blue, marginBottom: 12 }}>
            <Row main="مجموعات المطاحن القياسية" sub={missing.length + " مجموعة جاهزة تحت قاعدة «التصنيف القياسي»"}
              action={<Btn bg={C.blue} onClick={seed}>إضافتها دفعة واحدة</Btn>} />
          </div>
        )}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 بحث بالرقم/الاسم/القاعدة…" style={{ ...input, marginBottom: 10 }} />
        {can.manage && <Btn bg={C.orange} onClick={() => {
          if (!db.assetGroupRules.length) { alert("أنشئ قاعدة أولًا — لا مجموعة بدون قاعدة (قاعدة ف4)"); setSub("القواعد"); return; }
          setGroupForm("new");
        }} style={{ width: "100%", padding: 12, marginBottom: 12 }}>+ مجموعة جديدة</Btn>}
        {groups.length === 0 && <Empty text="لا مجموعات مطابقة." />}
        {groups.map((g) => (
          <div key={g.id} style={{ ...card(), opacity: groupActive(g) ? 1 : 0.6 }} onClick={() => setDetail(g.id)}>
            <Row main={(g.number ? g.number + " — " : "") + g.name}
              badge={(g.excludeFromWO || g.excludeFromRequests) ? { text: "استبعاد ⛔", color: C.red } : !groupActive(g) ? { text: "معطلة", color: C.steel } : undefined}
              sub={[groupRule(g)?.name || "بدون قاعدة", activeAssignments(g).length + " أصل معين",
                Object.entries(g.attrValues || {}).filter(([, v]) => v).map(([k, v]) => (GROUP_ATTRS.find(([kk]) => kk === k)?.[1] || k) + ": " + (k === "workCenterId" ? nameOf("workCenters", v) : v)).join("، ")].filter(Boolean).join(" · ")} />
          </div>
        ))}
      </>)}

      {ruleForm && (
        <RuleFormSheet ctx={ctx} schema={ruleSchema(ruleForm === "new" ? null : ruleForm)} initial={ruleForm === "new" ? { usages: ["عام (صيانة وبرامج)"], attributes: [] } : { ...ruleForm }}
          title={ruleForm === "new" ? "قاعدة جديدة" : "تعديل قاعدة"} onClose={() => setRuleForm(null)}
          onDelete={ruleForm !== "new" && can.admin && !ruleHasGroups(ruleForm.id) ? () => { remove("assetGroupRules", ruleForm.id); setRuleForm(null); } : undefined}
          deleteBlockedMsg={ruleForm !== "new" && ruleHasGroups(ruleForm?.id) ? "توجد مجموعات تحت القاعدة — لا حذف؛ استخدم التعطيل" : ""}
          onSave={(d) => {
            const err = validateRule(d, ruleForm === "new" ? null : ruleForm);
            if (err) { alert(err); return; }
            ruleForm === "new" ? add("assetGroupRules", d) : update("assetGroupRules", ruleForm.id, d);
            setRuleForm(null);
          }} />
      )}
      {groupForm && (
        <GroupForm ctx={ctx} g={groupForm === "new" ? null : groupForm} onClose={() => setGroupForm(null)} />
      )}
      {detail && <GroupDetail ctx={ctx} groupId={detail} onClose={() => setDetail(null)} onEdit={(g) => { setDetail(null); setGroupForm(g); }} />}
    </>
  );
}

/* نموذج قاعدة مع خيارات ثابتة multi-static */
function RuleFormSheet({ ctx, schema, initial, title, onClose, onSave, onDelete, deleteBlockedMsg }) {
  const [f, setF] = useState(initial);
  const set = (k, v) => setF({ ...f, [k]: v });
  return (
    <Sheet title={title} onClose={onClose}>
      {schema.map((s) => (
        <Field key={s.k} label={s.label}>
          {s.type === "multi-static" && (
            <div style={{ border: `1.5px solid ${C.ink}`, borderRadius: 4, padding: 8, background: "#fff" }}>
              {s.options.map((o) => (
                <label key={o} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0" }}>
                  <input type="checkbox" checked={(f[s.k] || []).includes(o)}
                    onChange={(e) => set(s.k, e.target.checked ? [...(f[s.k] || []), o] : (f[s.k] || []).filter((x) => x !== o))} />
                  <span style={{ fontSize: 14 }}>{o}</span>
                </label>
              ))}
            </div>
          )}
          {s.type === "check" && <input type="checkbox" checked={!!f[s.k]} onChange={(e) => set(s.k, e.target.checked)} style={{ width: 22, height: 22 }} />}
          {s.type === "textarea" && <textarea value={f[s.k] || ""} onChange={(e) => set(s.k, e.target.value)} rows={2} style={{ ...input, resize: "vertical" }} />}
          {(!s.type || ["text", "date"].includes(s.type)) && <input type={s.type || "text"} value={f[s.k] ?? ""} onChange={(e) => set(s.k, e.target.value)} style={input} />}
        </Field>
      ))}
      {deleteBlockedMsg && <div style={{ fontSize: 12, color: C.steel, marginBottom: 8 }}>{deleteBlockedMsg}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <Btn bg={C.orange} style={{ flex: 1, padding: 13 }} onClick={() => onSave(f)}>حفظ</Btn>
        {onDelete && <Btn bg={C.red} style={{ padding: 13 }} onClick={onDelete}>حذف</Btn>}
      </div>
    </Sheet>
  );
}

/* إنشاء/تعديل مجموعة: القاعدة تحدد الخصائص المطلوب تعبئتها */
function GroupForm({ ctx, g, onClose }) {
  const { db, add, update, nameOf, activeAssignments } = ctx;
  const [f, setF] = useState(g ? { ...g } : { ruleId: db.assetGroupRules[0]?.id || "", attrValues: {}, excludeFromRequests: false, excludeFromWO: false });
  const rule = db.assetGroupRules.find((r) => r.id === f.ruleId);
  const hasAssigned = g && activeAssignments(g).length > 0;
  const isStatus = (rule?.usages || []).includes("حالة الأصل (قاعدة تحقق)");
  const attrKey = (label) => GROUP_ATTRS.find(([, l]) => l === label)?.[0] || label;
  const set = (k, v) => setF({ ...f, [k]: v });
  return (
    <Sheet title={g ? "تعديل مجموعة" : "مجموعة جديدة"} onClose={onClose}>
      <Field label={"القاعدة" + (g ? " — لا تتغير" : "")}>
        <select value={f.ruleId} disabled={!!g} onChange={(e) => set("ruleId", e.target.value)} style={input}>
          {db.assetGroupRules.map((r) => {
            const inactive = r.inactiveOn && r.inactiveOn < today();
            return <option key={r.id} value={r.id} disabled={inactive}>{r.name}{inactive ? " (معطلة ✗)" : ""}</option>;
          })}
        </select>
      </Field>
      <Field label="اسم المجموعة"><input value={f.name || ""} onChange={(e) => set("name", e.target.value)} style={input} /></Field>
      <Field label="الوصف"><input value={f.description || ""} onChange={(e) => set("description", e.target.value)} style={input} /></Field>
      {(rule?.attributes || []).map((label) => {
        const k = attrKey(label);
        return (
          <Field key={k} label={"خاصية: " + label + (hasAssigned ? " — مقفلة (توجد أصول)" : "")}>
            {k === "workCenterId" ? (
              <select value={(f.attrValues || {})[k] || ""} disabled={hasAssigned}
                onChange={(e) => set("attrValues", { ...(f.attrValues || {}), [k]: e.target.value })} style={input}>
                <option value="">—</option>
                {db.workCenters.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            ) : k === "type" ? (
              <select value={(f.attrValues || {})[k] || ""} disabled={hasAssigned}
                onChange={(e) => set("attrValues", { ...(f.attrValues || {}), [k]: e.target.value })} style={input}>
                <option value="">—</option>
                {["معدات", "مركبة", "مبنى", "أداة", "أخرى"].map((t) => <option key={t}>{t}</option>)}
              </select>
            ) : (
              <input value={(f.attrValues || {})[k] || ""} disabled={hasAssigned}
                onChange={(e) => set("attrValues", { ...(f.attrValues || {}), [k]: e.target.value })} style={input} />
            )}
          </Field>
        );
      })}
      {isStatus && (<>
        <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <input type="checkbox" checked={!!f.excludeFromWO} disabled={hasAssigned} onChange={(e) => set("excludeFromWO", e.target.checked)} style={{ width: 20, height: 20 }} />
          <span style={{ fontSize: 14 }}>استبعاد أصول المجموعة من أوامر العمل{hasAssigned ? " (مقفل)" : ""}</span>
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <input type="checkbox" checked={!!f.excludeFromRequests} disabled={hasAssigned} onChange={(e) => set("excludeFromRequests", e.target.checked)} style={{ width: 20, height: 20 }} />
          <span style={{ fontSize: 14 }}>استبعاد أصول المجموعة من طلبات العمل{hasAssigned ? " (مقفل)" : ""}</span>
        </label>
      </>)}
      <Field label="تعطيل اعتبارًا من (لا تعيينات جديدة بعده)"><input type="date" value={f.inactiveOn || ""} onChange={(e) => set("inactiveOn", e.target.value)} style={input} /></Field>
      <Btn bg={C.orange} style={{ width: "100%", padding: 13 }} onClick={() => {
        if (!String(f.name || "").trim()) { alert("الاسم مطلوب"); return; }
        if (!f.ruleId) { alert("اختر القاعدة"); return; }
        const r = db.assetGroupRules.find((x) => x.id === f.ruleId);
        if (r?.inactiveOn && r.inactiveOn < today() && !g) { alert("القاعدة معطلة — لا مجموعات جديدة"); return; }
        for (const label of (r?.attributes || [])) {
          if (!((f.attrValues || {})[attrKey(label)])) { alert("أدخل قيمة خاصية «" + label + "» — إلزامية حسب القاعدة"); return; }
        }
        if (g) update("assetGroups", g.id, f);
        else add("assetGroups", { number: "AG-" + String(100 + db.assetGroups.length + 1), assignments: [], assetIds: [], code: "", ...f });
        onClose();
      }}>حفظ</Btn>
    </Sheet>
  );
}

/* تفاصيل المجموعة: التعيينات + إضافة المؤهلين + إعادة التحقق */
function GroupDetail({ ctx, groupId, onClose, onEdit }) {
  const { db, update, remove, nameOf, can, groupRule, groupActive, activeAssignments, canAssignAsset, assignAsset, unassignAsset, revalidateGroup } = ctx;
  const g = db.assetGroups.find((x) => x.id === groupId);
  const [showEnded, setShowEnded] = useState(false);
  const [pick, setPick] = useState("");
  if (!g) return null;
  const rule = groupRule(g);
  const act = activeAssignments(g);
  const ended = (g.assignments || []).filter((x) => x.end);
  const eligible = db.assets.filter((a) => !canAssignAsset(a, g));
  return (
    <Sheet title={(g.number ? g.number + " — " : "") + g.name} onClose={onClose}>
      <div style={{ ...card(), fontSize: 13.5, lineHeight: 2 }}>
        القاعدة: <b>{rule?.name || "—"}</b>{rule?.enforceUnique ? " · تعيين فريد" : ""}<br />
        {(rule?.attributes || []).length > 0 && <>الخصائص: <b>{Object.entries(g.attrValues || {}).filter(([, v]) => v).map(([k, v]) => (GROUP_ATTRS.find(([kk]) => kk === k)?.[1] || k) + " = " + (k === "workCenterId" ? nameOf("workCenters", v) : v)).join("، ")}</b><br /></>}
        {(g.excludeFromWO || g.excludeFromRequests) && <span style={{ color: C.red, fontWeight: 700 }}>⛔ تحقق: {[g.excludeFromWO ? "مستبعدة من أوامر العمل" : "", g.excludeFromRequests ? "مستبعدة من طلبات العمل" : ""].filter(Boolean).join(" و")}<br /></span>}
        {!groupActive(g) && <span style={{ color: C.steel }}>معطلة منذ {fmt(g.inactiveOn)} — لا تعيينات جديدة</span>}
      </div>
      {can.manage && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <Btn bg={C.blue} onClick={() => onEdit(g)}>تعديل</Btn>
          <Btn bg={C.amber} onClick={() => {
            const bad = revalidateGroup(g);
            alert(bad.length ? "⚠ أُنهيت تعيينات غير مطابقة:\n• " + bad.join("\n• ") : "✓ كل التعيينات مطابقة");
          }}>إعادة التحقق من التطابق</Btn>
          {can.admin && (act.length === 0
            ? <Btn bg={C.red} onClick={() => { if (confirm("حذف المجموعة؟")) { remove("assetGroups", g.id); onClose(); } }}>حذف</Btn>
            : <span style={{ fontSize: 12, color: C.steel, alignSelf: "center" }}>توجد أصول معينة — لا حذف</span>)}
        </div>
      )}
      <Section title={"الأصول المعينة (" + act.length + ")"}>
        {act.map((x) => {
          const a = db.assets.find((z) => z.id === x.assetId);
          return (
            <div key={x.id} style={card()}>
              <Row main={(a?.number ? a.number + " — " : "") + (a?.name || "أصل محذوف")} sub={"منذ " + fmt(x.start) + " · " + (x.by || "")}
                action={can.manage ? <Btn bg={C.red} onClick={() => unassignAsset(g, x.id, "إلغاء يدوي")}>إلغاء التعيين</Btn> : null} />
            </div>
          );
        })}
        {act.length === 0 && <Empty text="لا أصول معينة بعد." />}
        {can.manage && groupActive(g) && (
          <div style={{ display: "flex", gap: 8 }}>
            <select value={pick} onChange={(e) => setPick(e.target.value)} style={input}>
              <option value="">— الأصول المؤهلة فقط ({eligible.length}) —</option>
              {eligible.map((a) => <option key={a.id} value={a.id}>{a.number} — {a.name}</option>)}
            </select>
            <Btn bg={C.green} onClick={() => { if (!pick) return; const e = assignAsset(g, pick); if (e) alert(e); setPick(""); }}>تعيين</Btn>
          </div>
        )}
      </Section>
      {ended.length > 0 && (
        <Section title={"تعيينات منتهية (" + ended.length + ")"}>
          <button onClick={() => setShowEnded(!showEnded)} style={{ ...delBtn, color: C.blue }}>{showEnded ? "إخفاء" : "عرض"}</button>
          {showEnded && ended.map((x) => {
            const a = db.assets.find((z) => z.id === x.assetId);
            return (
              <div key={x.id} style={{ ...card(), opacity: 0.6 }}>
                <Row main={a?.name || "أصل"} sub={fmt(x.start) + " ← " + fmt(x.end) + " · السبب: " + (x.endReason || "—")} />
              </div>
            );
          })}
        </Section>
      )}
    </Sheet>
  );
}

function Assets({ ctx, openAsset }) {
  const { db, nameOf, can, exportAssetsCSV, assetUsable } = ctx;
  const [q, setQ] = useState("");
  const [wizard, setWizard] = useState(false);
  const [groupFilter, setGroupFilter] = useState("");
  const [showEnded, setShowEnded] = useState(false);
  const [flag, setFlag] = useState("الكل");
  let list = db.assets.filter((a) => !q || (a.name + a.number + (a.location || "") + (a.serial || "") + (a.customer || "")).includes(q));
  if (groupFilter) {
    const g = db.assetGroups.find((x) => x.id === groupFilter);
    list = list.filter((a) => (g?.assetIds || []).includes(a.id));
  }
  if (!showEnded) list = list.filter((a) => assetUsable(a));
  if (flag === "أوامر مسموحة") list = list.filter((a) => a.allowWO !== false);
  if (flag === "برامج مسموحة") list = list.filter((a) => a.allowPrograms !== false);
  if (flag === "IoT") list = list.filter((a) => a.enableIoT);
  if (flag === "أصول عملاء") list = list.filter((a) => a.ownership === "عميل");
  return (
    <>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 بحث بالاسم أو الرقم أو الموقع…" style={{ ...input, marginBottom: 8 }} />
      {db.assetGroups.length > 0 && (
        <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} style={{ ...input, marginBottom: 10, padding: "8px 12px" }}>
          <option value="">كل المجموعات</option>
          {db.assetGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      )}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 8 }}>
        {["الكل", "أوامر مسموحة", "برامج مسموحة", "IoT", "أصول عملاء"].map((f) => <Chip key={f} active={flag === f} onClick={() => setFlag(f)}>{f}</Chip>)}
      </div>
      <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, marginBottom: 8 }}>
        <input type="checkbox" checked={showEnded} onChange={(e) => setShowEnded(e.target.checked)} /> إظهار الأصول المنتهية/الموقوفة
      </label>
      {can.manage && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <Btn bg={C.orange} onClick={() => setWizard(true)} style={{ flex: 1, padding: 12 }}>+ تسجيل أصل (معالج)</Btn>
          <Btn bg={C.blue} onClick={exportAssetsCSV} style={{ padding: 12 }}>CSV</Btn>
        </div>
      )}
      {list.length === 0 && <Empty text="لا أصول مطابقة." />}
      {list.map((a) => (
        <div key={a.id} style={card()} onClick={() => openAsset(a.id)}>
          <Row main={a.number + " — " + a.name}
            sub={[a.location, a.type, a.ownership === "عميل" ? "عميل: " + (a.customer || "—") : "", Number(a.quantity) > 1 ? "كمية " + a.quantity : "",
              a.critical ? "⚠ حرج" : "", a.allowWO === false ? "🚫 أوامر" : "", a.enableIoT ? "📡 IoT" : "",
              a.parentId ? "تابع لـ " + nameOf("assets", a.parentId) : ""].filter(Boolean).join(" · ")}
            badge={!assetUsable(a) ? { text: a.endDate && a.endDate < today() ? "منتهٍ" : "موقوف", color: C.steel } : undefined} />
        </div>
      ))}
      {wizard && <AssetWizard ctx={ctx} onClose={() => setWizard(false)} />}
    </>
  );
}

/* معالج إنشاء الأصل خطوة بخطوة (وثيقة الأصول §تدفق الإنشاء) */
function AssetWizard({ ctx, onClose }) {
  const { db, add, update } = ctx;
  const [step, setStep] = useState(0);
  const [a, setA] = useState({ active: true, critical: false, type: "معدات" });
  const [meterTplId, setMeterTplId] = useState(""); const [meterInit, setMeterInit] = useState("0");
  const [partsText, setPartsText] = useState("");
  const [warr, setWarr] = useState({ supplier: "", start: "", end: "" });
  const set = (k, v) => setA({ ...a, [k]: v });
  const STEPS = ["الأساسيات والموقع", "التصنيف", "البيانات الفنية", "الهيكل", "العدادات", "قطع الغيار", "الضمان"];
  const next = () => {
    if (step === 0) {
      if (!String(a.name || "").trim()) return alert("أدخل اسم الأصل");
      if (!String(a.location || "").trim()) return alert("لا أصل بدون موقع (قاعدة النظام)");
      const err = ctx.assetSaveErrors(a, null);
      if (err) return alert(err);
    }
    setStep(step + 1);
  };
  const finish = () => {
    const parts = partsText.split("\n").filter(Boolean).map((l) => {
      const seg = l.includes("،") ? l.split("،") : l.split(",");
      return { id: uid(), name: (seg[0] || l).trim(), qty: (seg[1] || "1").trim() };
    });
    const groupId = a._groupId; const data = { ...a }; delete data._groupId;
    if (!String(data.number || "").trim()) data.number = ctx.nextAssetNumber();
    const created = add("assets", { ...data, parts, docs: [], photos: [], specs: data.specs || "",
      allowWO: true, allowPrograms: true, quantity: Number(data.quantity || 1), notes: [],
      history: [{ action: "إنشاء عبر المعالج", at: now(), by: ctx.role }] });
    if (groupId) {
      const g = db.assetGroups.find((x) => x.id === groupId);
      if (g) update("assetGroups", g.id, { assetIds: [...(g.assetIds || []), created.id] });
    }
    if (meterTplId) add("assetMeters", { assetId: created.id, templateId: meterTplId, initial: Number(meterInit || 0) });
    if (warr.supplier && warr.end) add("warranties", { assetId: created.id, ...warr });
    alert("✓ أُنشئ ملف الأصل — جاهز للصيانة والتكاليف");
    onClose();
  };
  return (
    <Sheet title={"تسجيل أصل — " + (step + 1) + "/" + STEPS.length + ": " + STEPS[step]} onClose={onClose}>
      <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
        {STEPS.map((s, i) => <div key={s} style={{ flex: 1, height: 5, borderRadius: 3, background: i <= step ? C.orange : C.line }} />)}
      </div>
      {step === 0 && (<>
        <Field label="رقم الأصل (فارغ = توليد تلقائي)"><input value={a.number || ""} onChange={(e) => set("number", e.target.value)} placeholder="ELA-01" style={input} /></Field>
        <Field label="اسم الأصل"><input value={a.name || ""} onChange={(e) => set("name", e.target.value)} style={input} /></Field>
        <Field label="الموقع (إلزامي — المصنع/المنطقة)"><input value={a.location || ""} onChange={(e) => set("location", e.target.value)} placeholder="طابق الطحن — خط 1" style={input} /></Field>
      </>)}
      {step === 1 && (<>
        <Field label="نوع الأصل">
          <select value={a.type} onChange={(e) => set("type", e.target.value)} style={input}>
            {["معدات", "مركبة", "مبنى", "أداة", "أخرى"].map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="المجموعة (مصاعد قواديس، مراوح…)">
          <select value={a._groupId || ""} onChange={(e) => set("_groupId", e.target.value)} style={input}>
            <option value="">— بدون —</option>
            {db.assetGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </Field>
        <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
          <input type="checkbox" checked={!!a.critical} onChange={(e) => set("critical", e.target.checked)} style={{ width: 20, height: 20 }} />
          <span>أصل حرج</span>
        </label>
      </>)}
      {step === 2 && (<>
        <Field label="الرقم التسلسلي"><input value={a.serial || ""} onChange={(e) => set("serial", e.target.value)} style={input} /></Field>
        <Field label="المواصفات الفنية (سطر لكل مواصفة)">
          <textarea value={a.specs || ""} onChange={(e) => set("specs", e.target.value)} rows={4} placeholder={"القدرة: 15 kW\nالسرعة: 1450 rpm\nالمصنّع: Buhler"} style={{ ...input, resize: "vertical" }} />
        </Field>
      </>)}
      {step === 3 && (
        <Field label="الأصل الأب (الهيكل الفيزيائي)">
          <select value={a.parentId || ""} onChange={(e) => set("parentId", e.target.value)} style={input}>
            <option value="">— أصل رئيسي —</option>
            {db.assets.map((x) => <option key={x.id} value={x.id}>{x.number} — {x.name}</option>)}
          </select>
        </Field>
      )}
      {step === 4 && (<>
        <Field label="ربط عداد (اختياري)">
          <select value={meterTplId} onChange={(e) => setMeterTplId(e.target.value)} style={input}>
            <option value="">— بدون عداد —</option>
            {db.meterTemplates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.uom})</option>)}
          </select>
        </Field>
        {meterTplId && <Field label="القراءة الابتدائية"><input type="number" value={meterInit} onChange={(e) => setMeterInit(e.target.value)} style={input} /></Field>}
        {db.meterTemplates.length === 0 && <div style={{ fontSize: 12.5, color: C.steel, marginBottom: 10 }}>لا قوالب عدادات بعد — أنشئها من تبويب العدادات لاحقًا.</div>}
      </>)}
      {step === 5 && (
        <Field label="قطع الغيار (سطر لكل قطعة: الاسم، الكمية)">
          <textarea value={partsText} onChange={(e) => setPartsText(e.target.value)} rows={4} placeholder={"سير ناقل، 2\nمحمل 6205، 4\nشحم ليثيوم، 1"} style={{ ...input, resize: "vertical" }} />
        </Field>
      )}
      {step === 6 && (<>
        <Field label="مورد الضمان (اتركه فارغًا إن لا يوجد)"><input value={warr.supplier} onChange={(e) => setWarr({ ...warr, supplier: e.target.value })} style={input} /></Field>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="البداية"><input type="date" value={warr.start} onChange={(e) => setWarr({ ...warr, start: e.target.value })} style={input} /></Field>
          <Field label="النهاية"><input type="date" value={warr.end} onChange={(e) => setWarr({ ...warr, end: e.target.value })} style={input} /></Field>
        </div>
      </>)}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        {step > 0 && <Btn bg={C.steel} style={{ padding: 12 }} onClick={() => setStep(step - 1)}>السابق</Btn>}
        {step < STEPS.length - 1
          ? <Btn bg={C.orange} style={{ flex: 1, padding: 12 }} onClick={next}>التالي</Btn>
          : <Btn bg={C.green} style={{ flex: 1, padding: 12 }} onClick={finish}>✓ إنشاء ملف الأصل</Btn>}
      </div>
    </Sheet>
  );
}

function AssetGroupJoin({ a, db, canAssignAsset, assignAsset }) {
  const [pick, setPick] = useState("");
  const eligible = db.assetGroups.filter((g) => !canAssignAsset(a, g));
  if (!eligible.length) return null;
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <select value={pick} onChange={(e) => setPick(e.target.value)} style={input}>
        <option value="">— ضمّه لمجموعة مؤهلة ({eligible.length}) —</option>
        {eligible.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
      </select>
      <Btn bg={C.green} onClick={() => { if (!pick) return; const g = db.assetGroups.find((x) => x.id === pick); const e = assignAsset(g, a.id); if (e) alert(e); setPick(""); }}>تعيين</Btn>
    </div>
  );
}

function DocForm({ onAdd }) {
  const [name, setName] = useState(""); const [type, setType] = useState(DOC_TYPES[0]); const [url, setUrl] = useState("");
  return (
    <div style={card()}>
      <Field label="اسم المستند"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="دليل تشغيل المصعد" style={input} /></Field>
      <Field label="النوع">
        <select value={type} onChange={(e) => setType(e.target.value)} style={input}>{DOC_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
      </Field>
      <Field label="رابط الملف (Drive/سيرفر — اختياري)"><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" style={input} /></Field>
      <Btn bg={C.ink} style={{ width: "100%" }} onClick={() => { if (name.trim()) { onAdd({ name, type, url }); setName(""); setUrl(""); } }}>+ إضافة مستند</Btn>
    </div>
  );
}

function AssetDetail({ ctx, assetId, onClose, openWO }) {
  const { db, add, update, remove, nameOf, ltd, can, woCost, activeWarranty, activeAssignments, canAssignAsset, assignAsset, unassignAsset, copyAsset, splitAsset, assetSaveErrors, propagateLocation, logAsset, descendants, assetUsable } = ctx;
  const a = db.assets.find((x) => x.id === assetId);
  const [sub, setSub] = useState("عام");
  const [edit, setEdit] = useState(false);
  if (!a) return null;
  const children = db.assets.filter((x) => x.parentId === a.id);
  const wos = db.workOrders.filter((w) => w.assetId === a.id);
  const meters = db.assetMeters.filter((m) => m.assetId === a.id);
  const warr = db.warranties.filter((w) => w.assetId === a.id);
  const aw = activeWarranty(a.id);
  const totalCost = wos.reduce((s, w) => s + woCost(w).total, 0);
  const failures = wos.filter((w) => w.failure);
  const TABS = ["عام", "الهيكل", "قطع الغيار", "المستندات", "الصور", "التكاليف", "التاريخ", "ملاحظات"];
  const addDoc = (d) => update("assets", a.id, { docs: [...(a.docs || []), { id: uid(), ...d }] });
  const addPhoto = async (file) => {
    try { const data = await resizeImage(file); update("assets", a.id, { photos: [...(a.photos || []), { id: uid(), data, at: today() }] }); }
    catch (e) { alert("تعذر معالجة الصورة"); }
  };
  return (
    <Sheet title={a.number} onClose={onClose}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>{a.name} {a.critical && <span style={{ color: C.red }}>⚠</span>}</div>
        <div style={{ fontSize: 13, color: C.steel }}>
          {[a.type, a.location, a.serial ? "تسلسلي " + a.serial : ""].filter(Boolean).join(" · ")}
        </div>
        {aw && <div style={{ fontSize: 13, color: C.green, fontWeight: 700, marginTop: 4 }}>🛡 تحت ضمان «{aw.supplier}» حتى {fmt(aw.end)} — راجعه قبل أي إصلاح داخلي</div>}
        {!assetUsable(a) && <div style={{ fontSize: 13, color: C.steel, fontWeight: 700, marginTop: 4 }}>⛔ {a.endDate && a.endDate < today() ? "أصل منتهٍ منذ " + fmt(a.endDate) : "موقوف"} — لا أوامر ولا برامج</div>}
        {can.manage && (
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <Btn bg={C.blue} onClick={() => setEdit(true)}>تعديل</Btn>
            <Btn bg={C.purple} onClick={() => {
              const withMeters = db.assetMeters.some((m) => m.assetId === a.id) && confirm("نسخ عدادات الأصل أيضًا؟ (بقراءة ابتدائية 0)");
              const c = copyAsset(a, withMeters);
              alert("✓ أُنشئت النسخة " + c.number);
            }}>نسخ</Btn>
            {!a.serial && Number(a.quantity || 1) > 1 && (
              <Btn bg={C.amber} onClick={() => {
                if (!confirm("تقسيم الأصل إلى " + a.quantity + " وحدات مستقلة (كمية كل وحدة = 1)؟")) return;
                const e = splitAsset(a);
                alert(e ? "⛔ " + e : "✓ تم التقسيم — راجع قائمة الأصول");
              }}>تقسيم ({a.quantity})</Btn>
            )}
            <Btn bg={a.active === false ? C.green : C.steel} onClick={() => update("assets", a.id, { active: a.active === false })}>
              {a.active === false ? "تفعيل" : "إيقاف"}
            </Btn>
            {can.admin && <Btn bg={C.red} onClick={() => { remove("assets", a.id); onClose(); }}>حذف</Btn>}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 5, overflowX: "auto", marginBottom: 10 }}>
        {TABS.map((t) => <Chip key={t} active={sub === t} onClick={() => setSub(t)}>{t}</Chip>)}
      </div>

      {sub === "عام" && (<>
        <Section title="البيانات الفنية">
          <div style={card()}>
            {(a.specs || "").split("\n").filter(Boolean).map((l, i) => <div key={i} style={{ fontSize: 14, marginBottom: 3 }}>{l}</div>)}
            {!a.specs && <span style={{ color: C.steel, fontSize: 13 }}>لا مواصفات مسجلة — عدّل الأصل لإضافتها.</span>}
          </div>
        </Section>
        <Section title={"العدادات (" + meters.length + ")"}>
          {meters.map((m) => (
            <div key={m.id} style={card()}>
              <Row main={nameOf("meterTemplates", m.templateId)} sub={"إجمالي العمر: " + ltd(m) + " " + nameOf("meterTemplates", m.templateId, "uom")} />
            </div>
          ))}
          {meters.length === 0 && <Empty text="لا عدادات — اربطها من تبويب العدادات." />}
        </Section>
        <Section title={"الضمانات (" + warr.length + ")"}>
          {warr.map((w) => (
            <div key={w.id} style={card()}>
              <Row main={w.supplier} sub={(daysUntil(w.end) >= 0 ? "ساري حتى " : "منتهي منذ ") + fmt(w.end)}
                badge={{ text: daysUntil(w.end) >= 0 ? "ساري" : "منتهي", color: daysUntil(w.end) >= 0 ? C.green : C.red }} />
            </div>
          ))}
          {warr.length === 0 && <Empty text="لا ضمانات مسجلة." />}
        </Section>
        <Section title="مجموعات هذا الأصل">
          {db.assetGroups.filter((g) => activeAssignments(g).some((x) => x.assetId === a.id)).map((g) => {
            const asn = activeAssignments(g).find((x) => x.assetId === a.id);
            return (
              <div key={g.id} style={card()}>
                <Row main={g.name} sub={"منذ " + fmt(asn.start)}
                  badge={(g.excludeFromWO || g.excludeFromRequests) ? { text: "تحقق ⛔", color: C.red } : undefined}
                  action={can.manage ? <Btn bg={C.red} onClick={() => unassignAsset(g, asn.id, "إلغاء يدوي")}>إلغاء</Btn> : null} />
              </div>
            );
          })}
          {db.assetGroups.filter((g) => activeAssignments(g).some((x) => x.assetId === a.id)).length === 0 && <Empty text="غير معين لأي مجموعة." />}
          {can.manage && (
            <AssetGroupJoin a={a} db={db} canAssignAsset={canAssignAsset} assignAsset={assignAsset} />
          )}
        </Section>
      </>)}

      {sub === "الهيكل" && (
        <Section title="الهرمية المادية — الفرع يرث موقع الأب الأعلى">
          {a.parentId && <div style={card()}><Row main={"⬆ الأب: " + nameOf("assets", a.parentId)}
            action={can.manage ? <Btn bg={C.steel} onClick={() => { update("assets", a.id, { parentId: "" }); logAsset(a.id, "فصل عن الأب"); }}>فصل</Btn> : null} /></div>}
          {children.map((c) => (
            <div key={c.id} style={card()}>
              <Row main={"⬇ " + c.number + " — " + c.name} sub={c.location} />
              {can.manage && (
                <div style={{ display: "flex", gap: 10, marginTop: 4, alignItems: "center", flexWrap: "wrap" }}>
                  <button onClick={() => update("assets", c.id, { parentId: "" })} style={{ ...delBtn, marginTop: 0 }}>إزالة من الهيكل</button>
                  <select defaultValue="" onChange={(e) => { if (e.target.value) { update("assets", c.id, { parentId: e.target.value, location: db.assets.find((x) => x.id === e.target.value)?.location || c.location }); e.target.value = ""; } }} style={{ ...input, width: "auto", padding: "4px 8px", fontSize: 12 }}>
                    <option value="">نقل تحت أب آخر…</option>
                    {db.assets.filter((x) => x.id !== c.id && x.id !== a.id && !descendants(c.id).some((d) => d.id === x.id)).map((x) => <option key={x.id} value={x.id}>{x.number} — {x.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          ))}
          {!a.parentId && children.length === 0 && <Empty text="أصل مستقل — لا أب ولا مكونات تابعة." />}
          {can.manage && (<>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <select defaultValue="" id={"addch-" + a.id} onChange={(e) => {
                if (!e.target.value) return;
                const child = db.assets.find((x) => x.id === e.target.value);
                update("assets", child.id, { parentId: a.id, location: a.location || child.location });
                logAsset(a.id, "إضافة فرع: " + child.number);
                e.target.value = "";
              }} style={input}>
                <option value="">+ إضافة أصل موجود كفرع (يرث الموقع)…</option>
                {db.assets.filter((x) => x.id !== a.id && x.parentId !== a.id && !descendants(a.id).some((d) => d.id === x.id) && x.id !== a.parentId).map((x) => <option key={x.id} value={x.id}>{x.number} — {x.name}</option>)}
              </select>
            </div>
            <AddInline placeholder="+ إنشاء فرع جديد سريع (الاسم فقط)" onAdd={(t) => {
              add("assets", { number: ctx.nextAssetNumber(), name: t, type: a.type, location: a.location, parentId: a.id,
                parts: [], docs: [], photos: [], specs: "", allowWO: true, allowPrograms: true, quantity: 1, active: true,
                notes: [], history: [{ action: "إنشاء كفرع لـ " + a.number, at: now(), by: ctx.role }] });
            }} />
          </>)}
        </Section>
      )}

      {sub === "قطع الغيار" && (
        <Section title={"قطع الغيار المرتبطة (" + (a.parts || []).length + ")"}>
          {(a.parts || []).map((p) => (
            <div key={p.id} style={card()}>
              <Row main={p.name} sub={"الكمية الموصى بها: " + p.qty}
                action={can.manage ? <Btn bg={C.red} onClick={() => update("assets", a.id, { parts: a.parts.filter((x) => x.id !== p.id) })}>حذف</Btn> : null} />
            </div>
          ))}
          {can.manage && <AddInline placeholder="اسم القطعة، الكمية (محمل 6205، 4)" onAdd={(t) => {
            const seg = t.includes("،") ? t.split("،") : t.split(",");
            update("assets", a.id, { parts: [...(a.parts || []), { id: uid(), name: (seg[0] || t).trim(), qty: (seg[1] || "1").trim() }] });
          }} />}
        </Section>
      )}

      {sub === "المستندات" && (
        <Section title={"المستندات (" + (a.docs || []).length + ")"}>
          {(a.docs || []).map((d) => (
            <div key={d.id} style={card()}>
              <Row main={"📄 " + d.name} sub={d.type + (d.url ? "" : " · بدون رابط")}
                action={d.url ? <Btn bg={C.blue} onClick={() => window.open(d.url, "_blank")}>فتح</Btn> : null} />
              {can.manage && <button onClick={() => update("assets", a.id, { docs: a.docs.filter((x) => x.id !== d.id) })} style={delBtn}>حذف</button>}
            </div>
          ))}
          {can.manage && <DocForm onAdd={addDoc} />}
        </Section>
      )}

      {sub === "الصور" && (
        <Section title={"صور الأصل (" + (a.photos || []).length + ")"}>
          {can.manage && (
            <div style={{ ...card() }}>
              <input type="file" accept="image/*" capture="environment" onChange={(e) => e.target.files[0] && addPhoto(e.target.files[0])} style={{ fontSize: 14 }} />
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {(a.photos || []).map((p) => (
              <div key={p.id} style={{ border: `1.5px solid ${C.ink}`, borderRadius: 4, overflow: "hidden", background: "#fff" }}>
                <img src={p.data} alt="" style={{ width: "100%", display: "block" }} />
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", fontSize: 12 }}>
                  <span style={{ color: C.steel }}>{fmt(p.at)}</span>
                  {can.manage && <button onClick={() => update("assets", a.id, { photos: a.photos.filter((x) => x.id !== p.id) })} style={{ ...delBtn, marginTop: 0 }}>حذف</button>}
                </div>
              </div>
            ))}
          </div>
          {(a.photos || []).length === 0 && <Empty text="لا صور للأصل بعد." />}
        </Section>
      )}

      {sub === "التكاليف" && (
        <Section title="سجل التكاليف">
          <div style={{ ...card(), fontSize: 15, fontWeight: 800 }}>إجمالي تكلفة صيانة هذا الأصل: {money(totalCost)}</div>
          {wos.filter((w) => woCost(w).total > 0).map((w) => (
            <div key={w.id} style={card()} onClick={() => openWO(w.id)}>
              <Row main={w.number + " — " + w.title} sub={w.type + " · " + fmt(w.completedAt || w.plannedStart)}
                badge={{ text: money(woCost(w).total), color: C.orange }} />
            </div>
          ))}
        </Section>
      )}

      {sub === "التاريخ" && (<>
        <Section title={"تاريخ الصيانة (" + wos.length + ")"}>
          {wos.slice().reverse().map((w) => (
            <div key={w.id} style={card()} onClick={() => openWO(w.id)}>
              <Row main={w.number + " — " + w.title} sub={w.type + " · " + fmt(w.plannedStart)} badge={{ text: w.status, color: WO_COLORS[w.status] }} />
            </div>
          ))}
          {wos.length === 0 && <Empty text="لا أوامر عمل على هذا الأصل." />}
        </Section>
        <Section title={"تاريخ الأعطال (" + failures.length + ")"}>
          {failures.map((w) => (
            <div key={w.id} style={{ ...card(), borderRightColor: C.red }} onClick={() => openWO(w.id)}>
              <Row main={w.failure.mode} sub={w.failure.cause + " · " + w.failure.downtime + " د توقف"} />
            </div>
          ))}
          {failures.length === 0 && <Empty text="لا أعطال مسجلة لهذا الأصل." />}
        </Section>
        <Section title={"سجل تغييرات الأصل (" + (a.history || []).length + ")"}>
          {(a.history || []).slice().reverse().map((h, i) => (
            <div key={i} style={{ fontSize: 13, color: C.steel, marginBottom: 4, borderBottom: `1px dashed ${C.line}`, paddingBottom: 4 }}>
              <b style={{ color: C.ink }}>{h.action}</b> — {h.at} — {h.by}
            </div>
          ))}
          {(a.history || []).length === 0 && <Empty text="لا تغييرات مسجلة." />}
        </Section>
      </>)}

      {sub === "ملاحظات" && (
        <Section title={"ملاحظات الأصل (" + (a.notes || []).length + ")"}>
          {(a.notes || []).slice().reverse().map((n) => (
            <div key={n.id} style={card()}>
              <Row main={n.text} sub={n.at + " · " + n.by}
                action={can.manage ? <Btn bg={C.red} onClick={() => update("assets", a.id, { notes: a.notes.filter((x) => x.id !== n.id) })}>حذف</Btn> : null} />
            </div>
          ))}
          {(a.notes || []).length === 0 && <Empty text="لا ملاحظات." />}
          {can.execute && <AddInline placeholder="ملاحظة جديدة…" onAdd={(t) =>
            update("assets", a.id, { notes: [...(a.notes || []), { id: uid(), text: t, at: now(), by: ctx.role }] })} />}
        </Section>
      )}

      {edit && (
        <FormSheet title="تعديل الأصل" onClose={() => setEdit(false)} db={db} schema={assetSchema()}
          initial={a} onSave={(d) => {
            const err = assetSaveErrors(d, a.id);
            if (err) { alert(err); return; }
            if (!String(d.number || "").trim()) d.number = ctx.nextAssetNumber();
            const locChanged = d.location !== a.location;
            update("assets", a.id, { ...d, history: [...(a.history || []), { action: "تعديل البيانات" + (locChanged ? " (الموقع ← " + d.location + ")" : ""), at: now(), by: ctx.role }] });
            setEdit(false);
            if (locChanged) {
              const n = propagateLocation(a.id, d.location);
              if (n > 0) alert("ℹ حُدّث موقع " + n + " أصل تابع (وراثة موقع الأب الأعلى)");
            }
          }} />
      )}
    </Sheet>
  );
}

/* ───────────────────────── العدادات ───────────────────────── */
/* ───────────────────────── العدادات (ف5) ───────────────────────── */
function Meters({ ctx }) {
  const { db, nameOf, add, update, remove, lastReading, ltd, currentValue, addReading, meterReadings, activeReadings, meterRows,
    calcUtilRate, utilRate, disableReading, can, pmCheckAfterReading, generateWO } = ctx;
  const [sub, setSub] = useState("meters");
  const [q, setQ] = useState("");
  const [tplForm, setTplForm] = useState(null); // null | "new" | tpl
  const [amForm, setAmForm] = useState(false);
  const [amSettings, setAmSettings] = useState(null);
  const [reading, setReading] = useState(null);
  const [history, setHistory] = useState(null);
  const [massTpl, setMassTpl] = useState(null);
  const tplLinked = (tplId) => db.assetMeters.filter((m) => m.templateId === tplId).length;
  const tplActive = (t) => (!t.startDate || t.startDate <= today()) && (!t.endDate || t.endDate >= today());
  const amActive = (m) => !m.endDate || m.endDate >= today();

  const tplSchema = (editing) => {
    const locked = editing && editing !== "new" && tplLinked(editing.id) > 0;
    return [
      { k: "name", label: "اسم القالب" }, { k: "code", label: "الكود (فريد)" },
      { k: "description", label: "الوصف" }, { k: "uom", label: "وحدة القياس (ساعة، كم، درجة…)" },
      { k: "meterType", label: "نوع العداد" + (locked ? " — مقفل (مرتبط بأصول)" : ""), type: "select", options: ["مستمر", "مقياس"] },
      { k: "readingType", label: "نوع القراءة" + (locked ? " — مقفل" : ""), type: "select", options: ["مطلق", "تغير"] },
      { k: "direction", label: "الاتجاه (المقياس = ثنائي)" + (locked ? " — مقفل" : ""), type: "select", options: ["تصاعدي", "تنازلي", "ثنائي"] },
      { k: "startDate", label: "بداية الفعالية", type: "date" }, { k: "endDate", label: "نهاية الفعالية", type: "date" },
      { k: "initial", label: "القيمة الابتدائية (تصبح أول قراءة عند الربط)", type: "number" },
      { k: "min", label: "حد أدنى (للتغير/المقياس)", type: "number" }, { k: "max", label: "حد أقصى (للتغير/المقياس)", type: "number" },
      { k: "recordAtWO", label: "التسجيل عند إكمال أمر العمل", type: "select", options: ["لا يسمح", "اختياري", "إلزامي"] },
      { k: "resetAllowed", label: "السماح بالتصفير (تصاعدي فقط)", type: "check" },
      { k: "resetValue", label: "قيمة التصفير (0 أو 1)", type: "number" },
      { k: "rolloverAllowed", label: "السماح بالتدوير Rollover (مستمر مطلق تصاعدي)", type: "check" },
      { k: "rolloverMax", label: "أقصى قيمة قبل التدوير", type: "number" },
      { k: "rolloverMin", label: "قيمة البداية بعد التدوير", type: "number" },
      { k: "allowSchedule", label: "يصلح لبرامج الصيانة (لا ينطبق على المقياس)", type: "check" },
      { k: "estDailyRate", label: "معدل الاستخدام اليومي المقدّر", type: "number" },
      { k: "readingsForRate", label: "عدد القراءات لحساب المعدل تلقائيًا (≥2)", type: "number" },
    ];
  };
  const validateTpl = (d, editing) => {
    if (!String(d.name || "").trim() || !String(d.code || "").trim()) return "الاسم والكود مطلوبان";
    if (db.meterTemplates.some((t) => t.code === d.code && t.id !== editing?.id)) return "الكود مستخدم — يجب أن يكون فريدًا";
    if (d.meterType === "مقياس") { d.direction = "ثنائي"; d.allowSchedule = false; d.resetAllowed = false; d.rolloverAllowed = false; }
    if (d.rolloverAllowed && !(d.meterType === "مستمر" && d.readingType === "مطلق" && d.direction === "تصاعدي"))
      return "التدوير: مستمر + مطلق + تصاعدي فقط (قاعدة ف5)";
    if (d.rolloverAllowed && !Number(d.rolloverMax)) return "حدد أقصى قيمة قبل التدوير";
    if (d.rolloverAllowed && d.resetAllowed && Number(d.rolloverMin || 0) !== Number(d.resetValue || 0))
      return "مع وجود تصفير: قيمة البداية بعد التدوير يجب أن تساوي قيمة التصفير";
    if (d.resetAllowed && d.direction !== "تصاعدي") return "التصفير للعدادات التصاعدية فقط";
    if (d.allowSchedule && d.direction !== "تصاعدي") return "يوصى ببرامج الصيانة للتصاعدي فقط — غيّر الاتجاه أو عطّل الخيار";
    if (editing && editing !== "new" && tplLinked(editing.id) > 0) {
      if (d.meterType !== editing.meterType || d.readingType !== editing.readingType || d.direction !== editing.direction)
        return "النوع/القراءة/الاتجاه مقفلة — القالب مرتبط بعدادات أصول";
    }
    return null;
  };
  const associate = (assetId, tpl, silent) => {
    if (db.assetMeters.some((m) => m.assetId === assetId && m.templateId === tpl.id && amActive(m))) return "موجود";
    const am = add("assetMeters", { assetId, templateId: tpl.id, initial: Number(tpl.initial || 0),
      recordAtWO: "", endDate: "", estDailyRate: "", readingsForRate: "" });
    if (tpl.initial !== "" && tpl.initial != null)
      add("readings", { assetMeterId: am.id, value: Number(tpl.initial), at: tpl.startDate || today(),
        source: "ربط", isReset: false, rollover: false, status: "أولية", comments: "قراءة أولية من القالب", workOrderId: "" });
    return "جديد";
  };

  const tpls = db.meterTemplates.filter((t) => !q ||
    ((t.name || "") + (t.code || "") + (t.description || "") + (t.uom || "") + (t.meterType || "") + (t.readingType || "")).includes(q));

  return (
    <>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <Chip active={sub === "meters"} onClick={() => setSub("meters")}>عدادات الأصول</Chip>
        <Chip active={sub === "templates"} onClick={() => setSub("templates")}>القوالب</Chip>
      </div>

      {sub === "templates" && (<>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 بحث بالكود/الاسم/الوصف/الوحدة/النوع…" style={{ ...input, marginBottom: 10 }} />
        {can.manage && <Btn bg={C.orange} onClick={() => setTplForm("new")} style={{ width: "100%", padding: 12, marginBottom: 12 }}>+ قالب عداد</Btn>}
        {tpls.map((t) => (
          <div key={t.id} style={{ ...card(), opacity: tplActive(t) ? 1 : 0.6 }} onClick={() => can.manage && setTplForm(t)}>
            <Row main={(t.code ? t.code + " — " : "") + t.name + " (" + t.uom + ")"}
              badge={tplLinked(t.id) ? { text: tplLinked(t.id) + " أصل", color: C.blue } : undefined}
              sub={[t.meterType, t.readingType, t.direction, t.recordAtWO !== "لا يسمح" ? "عند الإكمال: " + t.recordAtWO : "",
                t.rolloverAllowed ? "تدوير عند " + t.rolloverMax : "", !tplActive(t) ? "غير فعّال" : ""].filter(Boolean).join(" · ")} />
            {can.manage && db.assetGroups.length > 0 && (
              <button onClick={(e) => { e.stopPropagation(); setMassTpl(t); }} style={{ ...delBtn, color: C.purple }}>ربط جماعي بمجموعة…</button>
            )}
          </div>
        ))}
        {tpls.length === 0 && <Empty text="أمثلة: عداد ساعات (مستمر/مطلق/تصاعدي)، عداد رحلة (+ تصفير)، حرارة (مقياس)." />}
      </>)}

      {sub === "meters" && (<>
        <Btn bg={C.orange} onClick={() => setAmForm(true)} style={{ width: "100%", padding: 12, marginBottom: 12 }}>+ ربط عداد بأصل</Btn>
        {db.assetMeters.length === 0 && <Empty text="أنشئ قالبًا ثم اربطه — كل علاقة أصل×قالب لها تاريخ قراءات مستقل." />}
        {db.assetMeters.map((m) => {
          const tpl = db.meterTemplates.find((t) => t.id === m.templateId);
          const rows = meterRows(m);
          const last = rows[rows.length - 1];
          const cr = calcUtilRate(m), ur = utilRate(m);
          return (
            <div key={m.id} style={{ ...card(), opacity: amActive(m) ? 1 : 0.55 }}>
              <Row main={nameOf("assets", m.assetId) + " — " + (tpl?.name || "عداد")}
                badge={!amActive(m) ? { text: "معطل", color: C.steel } : undefined}
                sub={["المعروض: " + (last ? last.displayed : m.initial), "العمر LTD: " + ltd(m) + " " + (tpl?.uom || ""),
                  ur ? "معدل/يوم: " + (Math.round(ur * 100) / 100) + (cr != null ? " (محسوب)" : "") : ""].filter(Boolean).join(" · ")}
                action={amActive(m) ? <Btn bg={C.blue} onClick={() => setReading(m)}>قراءة</Btn> : null} />
              <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                <button onClick={() => setHistory(m)} style={{ ...delBtn, color: C.blue, marginTop: 0 }}>السجل ({activeReadings(m.id).length})</button>
                {can.manage && <button onClick={() => setAmSettings(m)} style={{ ...delBtn, color: C.purple, marginTop: 0 }}>إعدادات</button>}
                {can.admin && (
                  <button onClick={() => {
                    const ops = activeReadings(m.id).filter((r) => r.status !== "أولية");
                    if (ops.length) { alert("توجد قراءات تشغيلية — لا حذف؛ استخدم «إعدادات ← تاريخ نهاية» للتعطيل (قاعدة ف5)"); return; }
                    if (confirm("حذف عداد الأصل وقراءته الأولية؟")) {
                      meterReadings(m.id).forEach((r) => remove("readings", r.id));
                      remove("assetMeters", m.id);
                    }
                  }} style={{ ...delBtn, marginTop: 0 }}>حذف</button>
                )}
              </div>
            </div>
          );
        })}
      </>)}

      {tplForm && (
        <FormSheet title={tplForm === "new" ? "قالب عداد جديد" : "تعديل قالب — " + tplForm.name} onClose={() => setTplForm(null)} db={db}
          schema={tplSchema(tplForm)}
          initial={tplForm === "new"
            ? { meterType: "مستمر", readingType: "مطلق", direction: "تصاعدي", recordAtWO: "لا يسمح", resetAllowed: true, resetValue: 0, rolloverMin: 0, allowSchedule: true, startDate: today() }
            : tplForm}
          onDelete={tplForm !== "new" && can.admin && tplLinked(tplForm.id) === 0 ? () => { remove("meterTemplates", tplForm.id); setTplForm(null); } : undefined}
          onSave={(d) => {
            const err = validateTpl(d, tplForm);
            if (err) { alert(err); return; }
            tplForm === "new" ? add("meterTemplates", d) : update("meterTemplates", tplForm.id, d);
            setTplForm(null);
          }} />
      )}
      {amForm && (
        <FormSheet title="ربط عداد بأصل" onClose={() => setAmForm(false)} db={db}
          schema={[
            { k: "assetId", label: "الأصل", type: "select", from: "assets", fromLabel: (a) => a.number + " — " + a.name },
            { k: "templateId", label: "القالب (الفعّال فقط)", type: "select", from: "meterTemplates",
              fromLabel: (t) => t.code + " — " + t.name + (tplActive(t) ? "" : " (غير فعّال ✗)") },
          ]} initial={{}}
          onSave={(d) => {
            if (!d.assetId || !d.templateId) { alert("اختر الأصل والقالب"); return; }
            const tpl = db.meterTemplates.find((t) => t.id === d.templateId);
            if (!tplActive(tpl)) { alert("القالب غير فعّال — لا يُنشأ عداد منه"); return; }
            const res = associate(d.assetId, tpl);
            if (res === "موجود") { alert("الأصل مرتبط بهذا القالب مسبقًا — العلاقة فريدة (قاعدة ف5)"); return; }
            setAmForm(false);
          }} />
      )}
      {massTpl && (
        <FormSheet title={"ربط جماعي — " + massTpl.name} onClose={() => setMassTpl(null)} db={db}
          schema={[{ k: "groupId", label: "مجموعة الأصول", type: "select", from: "assetGroups", fromKey: "name" }]}
          initial={{}}
          onSave={(d) => {
            const g = db.assetGroups.find((x) => x.id === d.groupId);
            if (!g) { alert("اختر المجموعة"); return; }
            let added = 0, existed = 0;
            (g.assetIds || []).forEach((aid) => { associate(aid, massTpl) === "جديد" ? added++ : existed++; });
            alert("سجل الربط الجماعي:\n• أصول رُبطت حديثًا: " + added + "\n• مرتبطة مسبقًا: " + existed);
            setMassTpl(null);
          }} />
      )}
      {amSettings && (
        <FormSheet title={"إعدادات عداد — " + nameOf("assets", amSettings.assetId)} onClose={() => setAmSettings(null)} db={db}
          schema={[
            { k: "recordAtWO", label: "التسجيل عند إكمال الأمر (فارغ = من القالب)", type: "select", options: ["", "لا يسمح", "اختياري", "إلزامي"] },
            { k: "estDailyRate", label: "معدل الاستخدام اليومي المقدّر", type: "number" },
            { k: "readingsForRate", label: "عدد القراءات للمعدل المحسوب (≥2)", type: "number" },
            { k: "endDate", label: "تاريخ نهاية (تعطيل العداد مع حفظ التاريخ)", type: "date" },
          ]} initial={amSettings}
          onSave={(d) => {
            update("assetMeters", amSettings.id, d);
            const cr = calcUtilRate({ ...amSettings, ...d });
            setAmSettings(null);
            if (cr != null) alert("المعدل المحسوب الحالي: " + (Math.round(cr * 100) / 100) + "/يوم — سيُستخدم في التوقعات بدل المقدّر");
          }} />
      )}
      {reading && <ReadingSheet ctx={ctx} am={reading} onClose={() => setReading(null)} pmCheckAfterReading={pmCheckAfterReading} generateWO={generateWO} />}
      {history && <ReadingHistory ctx={ctx} am={history} onClose={() => setHistory(null)} />}
    </>
  );
}

/* إدخال قراءة: تدوير/تصفير/تاريخية/ملاحظات (ف5 §9) */
function ReadingSheet({ ctx, am, onClose, pmCheckAfterReading, generateWO }) {
  const { db, nameOf, addReading, currentValue } = ctx;
  const tpl = db.meterTemplates.find((t) => t.id === am.templateId) || {};
  const [val, setVal] = useState(""); const [at, setAt] = useState(today());
  const [isReset, setIsReset] = useState(false); const [rollover, setRollover] = useState(false);
  const [historical, setHistorical] = useState(false); const [comments, setComments] = useState("");
  const [err, setErr] = useState("");
  const canReset = tpl.resetAllowed && tpl.direction === "تصاعدي" && tpl.meterType !== "مقياس";
  const canRoll = tpl.rolloverAllowed && tpl.meterType === "مستمر" && tpl.readingType === "مطلق" && tpl.direction === "تصاعدي";
  return (
    <Sheet title={"قراءة — " + tpl.name + " (المعروض: " + currentValue(am) + ")"} onClose={onClose}>
      <Field label={"القيمة الجديدة (" + (tpl.uom || "") + ")"}><input type="number" value={val} onChange={(e) => setVal(e.target.value)} style={input} /></Field>
      <Field label="تاريخ القراءة"><input type="date" value={at} onChange={(e) => setAt(e.target.value)} style={input} /></Field>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 10 }}>
        {canReset && (
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={isReset} onChange={(e) => { setIsReset(e.target.checked); setRollover(false); if (e.target.checked) setVal(String(tpl.resetValue ?? 0)); }} style={{ width: 20, height: 20 }} />
            <span style={{ fontSize: 14 }}>تصفير ← {tpl.resetValue ?? 0}</span>
          </label>
        )}
        {canRoll && (
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={rollover} onChange={(e) => { setRollover(e.target.checked); setIsReset(false); }} style={{ width: 20, height: 20 }} />
            <span style={{ fontSize: 14 }}>تدوير (تجاوز {tpl.rolloverMax})</span>
          </label>
        )}
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={historical} onChange={(e) => setHistorical(e.target.checked)} style={{ width: 20, height: 20 }} />
          <span style={{ fontSize: 14 }}>قراءة تاريخية (بين القراءات)</span>
        </label>
      </div>
      <Field label="ملاحظات"><input value={comments} onChange={(e) => setComments(e.target.value)} style={input} /></Field>
      {historical && <div style={{ fontSize: 12, color: C.amber, marginBottom: 8 }}>سيعاد حساب المعروض والعمر لكل القراءات اللاحقة تلقائيًا.</div>}
      {err && <div style={{ color: C.red, fontSize: 13, marginBottom: 8 }}>⚠ {err}</div>}
      <Btn bg={C.orange} style={{ width: "100%", padding: 12 }} onClick={() => {
        if (val === "") return setErr("أدخل قيمة");
        const alerts = (isReset || rollover) ? [] : pmCheckAfterReading(am, val);
        const e = addReading(am, val, at, { isReset, rollover, historical, comments });
        if (e) { setErr(e); return; }
        onClose();
        alerts.forEach((x) => {
          if (x.program) { if (confirm(x.msg + "؟")) generateWO(x.program); }
          else alert(x.msg);
        });
      }}>حفظ القراءة</Btn>
    </Sheet>
  );
}

/* سجل القراءات: Net/المعروض/العمر + الحالة + تعديل الأخيرة + تعطيل (ف5 §13) */
function ReadingHistory({ ctx, am, onClose }) {
  const { db, nameOf, meterRows, meterReadings, update, disableReading, can } = ctx;
  const tpl = db.meterTemplates.find((t) => t.id === am.templateId) || {};
  const [editLatest, setEditLatest] = useState(false);
  const [v, setV] = useState(""); const [d, setD] = useState("");
  const rows = meterRows(am);
  const disabled = meterReadings(am.id).filter((r) => ["معطلة", "ملغاة"].includes(r.status));
  const latest = rows[rows.length - 1];
  const STATUS_COLOR = { "مسجلة": C.ink, "أولية": C.blue, "تصفير": C.amber, "تدوير": C.purple, "معدلة": C.steel, "معطلة": C.steel };
  return (
    <Sheet title={"سجل القراءات — " + tpl.name} onClose={onClose}>
      {rows.slice().reverse().map((r) => {
        const isLatest = latest && r.id === latest.id;
        return (
          <div key={r.id} style={{ ...card(), borderRightColor: STATUS_COLOR[r.status] || C.ink }}>
            <Row main={"المعروض: " + r.displayed + " · العمر: " + r.ltd}
              badge={{ text: r.status, color: STATUS_COLOR[r.status] || C.ink }}
              sub={[r.at, "القيمة: " + r.value, "التغير: " + (Math.round(r.net * 100) / 100), r.source,
                r.workOrderId ? db.workOrders.find((w) => w.id === r.workOrderId)?.number : "", r.comments].filter(Boolean).join(" · ")} />
            {can.manage && (
              <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                {isLatest && r.status !== "أولية" && <button onClick={() => { setEditLatest(r); setV(String(r.value)); setD(r.at); }} style={{ ...delBtn, color: C.blue, marginTop: 0 }}>تعديل (الأخيرة فقط)</button>}
                {r.status !== "أولية" && <button onClick={() => { const e = disableReading(am, r); if (e) alert(e); }} style={{ ...delBtn, marginTop: 0 }}>تعطيل</button>}
              </div>
            )}
          </div>
        );
      })}
      {rows.length === 0 && <Empty text="لا قراءات فعالة." />}
      {disabled.length > 0 && (
        <Section title={"قراءات معطلة (" + disabled.length + ") — مستبعدة من الحساب"}>
          {disabled.map((r) => (
            <div key={r.id} style={{ ...card(), opacity: 0.5 }}>
              <Row main={"القيمة: " + r.value} sub={r.at + (r.comments ? " · " + r.comments : "")} badge={{ text: r.status, color: C.steel }} />
            </div>
          ))}
        </Section>
      )}
      {editLatest && (
        <Sheet title="تعديل آخر قراءة" onClose={() => setEditLatest(false)}>
          <Field label="القيمة"><input type="number" value={v} onChange={(e) => setV(e.target.value)} style={input} /></Field>
          <Field label="التاريخ"><input type="date" value={d} onChange={(e) => setD(e.target.value)} style={input} /></Field>
          <Btn bg={C.green} style={{ width: "100%", padding: 12 }} onClick={() => {
            update("readings", editLatest.id, { value: Number(v), at: d, status: "معدلة" });
            setEditLatest(false);
          }}>حفظ التعديل</Btn>
        </Sheet>
      )}
    </Sheet>
  );
}

/* ───────────────────────── منظمة الصيانة ───────────────────────── */
function Organization({ ctx }) {
  const [sub, setSub] = useState("areas");
  return (
    <>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto" }}>
        <Chip active={sub === "areas"} onClick={() => setSub("areas")}>مناطق العمل</Chip>
        <Chip active={sub === "centers"} onClick={() => setSub("centers")}>مراكز العمل</Chip>
        <Chip active={sub === "resources"} onClick={() => setSub("resources")}>الموارد</Chip>
      </div>
      {sub === "areas" && <Crud ctx={ctx} entity="workAreas" title="مناطق العمل" schema={[
        { k: "name", label: "الاسم" }, { k: "code", label: "الرمز" }, { k: "description", label: "الوصف" },
      ]} render={(a) => [a.name, a.code]} />}
      {sub === "centers" && <Crud ctx={ctx} entity="workCenters" title="مراكز العمل" schema={[
        { k: "name", label: "الاسم (الورشة الميكانيكية…)" }, { k: "code", label: "الرمز" },
        { k: "workAreaId", label: "منطقة العمل", type: "select", from: "workAreas", fromKey: "name" },
      ]} render={(a) => [a.name, "ضمن " + ctx.nameOf("workAreas", a.workAreaId)]} />}
      {sub === "resources" && <Crud ctx={ctx} entity="resources" title="الموارد" schema={[
        { k: "name", label: "الاسم" },
        { k: "type", label: "النوع", type: "select", options: ["عمالة", "معدات"] },
        { k: "workCenterId", label: "مركز العمل", type: "select", from: "workCenters", fromKey: "name" },
        { k: "qty", label: "العدد المتاح", type: "number" },
      ]} render={(r) => [r.name, [r.type, ctx.nameOf("workCenters", r.workCenterId)].filter((x) => x !== "—").join(" · ")]} />}
    </>
  );
}

/* ───────────────────────── التقارير ───────────────────────── */
function Reports({ db, woCost, nameOf }) {
  const all = db.workOrders;
  const byStatus = [...WO_FLOW, ...WO_EXTRA].map((s) => ({ name: s, عدد: all.filter((w) => w.status === s).length })).filter((d) => d.عدد > 0);
  const byType = ["وقائي", "تصحيحي", "طارئ"].map((t) => ({ name: t, value: all.filter((w) => w.type === t).length })).filter((d) => d.value > 0);
  const costByAsset = db.assets.map((a) => ({
    name: a.name, تكلفة: all.filter((w) => w.assetId === a.id).reduce((s, w) => s + woCost(w).total, 0),
  })).filter((d) => d.تكلفة > 0).sort((a, b) => b.تكلفة - a.تكلفة).slice(0, 6);
  /* أداء الفنيين: عمليات مكتملة + ساعات */
  const techPerf = db.technicians.map((t) => {
    let ops = 0, hours = 0;
    all.forEach((w) => (w.operations || []).forEach((o) => {
      if (o.assigneeId === t.id && o.status === "مكتملة") { ops++; hours += Number(o.actualHours || 0); }
    }));
    return { name: t.name, عمليات: ops, ساعات: hours };
  }).filter((x) => x.عمليات > 0).sort((a, b) => b.عمليات - a.عمليات);
  /* التزام الوقائية: المغلقة في موعدها */
  const pm = all.filter((w) => w.type === "وقائي" && ["مغلق"].includes(w.status));
  const pmOnTime = pm.filter((w) => !w.plannedEnd || !w.completedAt || w.completedAt <= w.plannedEnd).length;
  const totalCost = all.reduce((s, w) => s + woCost(w).total, 0);
  const done = all.filter((w) => w.status === "مغلق").length;
  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Stat n={all.length} label="إجمالي الأوامر" color={C.ink} />
        <Stat n={done} label="مغلق" color={C.green} />
        <Stat n={pm.length ? Math.round((pmOnTime / pm.length) * 100) + "%" : "—"} label="التزام الوقائية" color={C.blue} small />
        <Stat n={money(totalCost)} label="التكلفة" color={C.orange} small />
      </div>
      {byStatus.length === 0 ? <Empty text="ستظهر الرسوم عند توفر أوامر عمل." /> : (
        <>
          <Section title="أوامر العمل حسب الحالة">
            <div style={{ ...card(), height: 220, padding: 8 }}>
              <ResponsiveContainer><BarChart data={byStatus}><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} width={24} /><Tooltip /><Bar dataKey="عدد" fill={C.orange} /></BarChart></ResponsiveContainer>
            </div>
          </Section>
          {byType.length > 0 && (
            <Section title="وقائي / تصحيحي / طارئ">
              <div style={{ ...card(), height: 220, padding: 8 }}>
                <ResponsiveContainer><PieChart><Pie data={byType} dataKey="value" nameKey="name" outerRadius={70} label>
                  {byType.map((d, i) => <Cell key={i} fill={[C.green, C.amber, C.red][i]} />)}</Pie><Legend /><Tooltip /></PieChart></ResponsiveContainer>
              </div>
            </Section>
          )}
          {techPerf.length > 0 && (
            <Section title="أداء الفنيين">
              <div style={card()}>
                {techPerf.map((t) => (
                  <div key={t.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 4 }}>
                    <span>{t.name}</span><span>{t.عمليات} عملية · {t.ساعات} ساعة</span>
                  </div>
                ))}
              </div>
            </Section>
          )}
          {costByAsset.length > 0 && (
            <Section title="تكلفة الصيانة حسب الأصل (ر.س)">
              <div style={{ ...card(), height: 220, padding: 8 }}>
                <ResponsiveContainer><BarChart data={costByAsset} layout="vertical"><XAxis type="number" /><YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="تكلفة" fill={C.blue} /></BarChart></ResponsiveContainer>
              </div>
            </Section>
          )}
        </>
      )}
    </>
  );
}

/* ───────────────────────── البيانات والنسخ ───────────────────────── */
function DataTab({ exportData, importData, exportAssetsCSV, db, can, save }) {
  const counts = Object.values(db).filter(Array.isArray).reduce((a, v) => a + v.length, 0);
  return (
    <>
      <Section title="نسخة احتياطية">
        <div style={card()}>
          <div style={{ fontSize: 13, color: C.steel, marginBottom: 8 }}>
            لديك {counts} سجلًا. نزّل JSON أو استورده؛ البيانات الآن تُحفظ في الـ Backend عند توفره مع نسخة محلية احتياطية.
          </div>
          <Btn bg={C.blue} onClick={exportData} style={{ width: "100%", padding: 12, marginBottom: 8 }}>تنزيل نسخة احتياطية (JSON)</Btn>
          <Btn bg={C.purple} onClick={exportAssetsCSV} style={{ width: "100%", padding: 12 }}>تصدير سجل الأصول (CSV)</Btn>
        </div>
      </Section>
      <Section title="استيراد">
        <div style={card()}>
          <input type="file" accept=".json" onChange={(e) => e.target.files[0] && importData(e.target.files[0])} style={{ fontSize: 14 }} />
        </div>
      </Section>
      {can.admin && (
        <Section title="منطقة الخطر">
          <div style={{ ...card(), borderRightColor: C.red }}>
            <Btn bg={C.red} onClick={() => { if (confirm("حذف كل البيانات نهائيًا؟")) save({ ...EMPTY }); }} style={{ width: "100%", padding: 12 }}>مسح كل البيانات</Btn>
          </div>
        </Section>
      )}
    </>
  );
}

/* ───────────────────────── CRUD عام ───────────────────────── */
function assetSchema() {
  return [
    { k: "number", label: "رقم الأصل (فارغ = توليد تلقائي)" }, { k: "name", label: "اسم الأصل" },
    { k: "ownership", label: "الملكية", type: "select", options: ["مؤسسة", "عميل"] },
    { k: "customer", label: "العميل (لأصل العميل)" },
    { k: "type", label: "النوع", type: "select", options: ["معدات", "مركبة", "مبنى", "أداة", "أخرى"] },
    { k: "location", label: "الموقع (إلزامي)" }, { k: "serial", label: "الرقم التسلسلي (فريد)" },
    { k: "quantity", label: "الكمية (غير المسلسل يقبل >1 ثم تقسيم)", type: "number" },
    { k: "specs", label: "المواصفات الفنية (سطر لكل مواصفة)", type: "textarea" },
    { k: "parentId", label: "الأصل الأب", type: "select", from: "assets", fromKey: "name" },
    { k: "workCenterId", label: "مركز العمل", type: "select", from: "workCenters", fromKey: "name" },
    { k: "contact", label: "جهة الاتصال/المسؤول" },
    { k: "defaultWOType", label: "نوع أمر العمل الافتراضي", type: "select", options: ["", "تصحيحي", "وقائي", "طارئ"] },
    { k: "allowWO", label: "يسمح بأوامر العمل", type: "check" },
    { k: "allowPrograms", label: "يسمح ببرامج الصيانة", type: "check" },
    { k: "enableIoT", label: "تفعيل IoT (توأم رقمي)", type: "check" },
    { k: "critical", label: "أصل حرج", type: "check" }, { k: "active", label: "نشط", type: "check" },
    { k: "endDate", label: "تاريخ إنهاء الأصل (ينهي الصيانة والاستخدام)", type: "date" },
  ];
}

function Crud({ ctx, entity, title, schema, render, badge }) {
  const { db, add, update, remove, can } = ctx;
  const [form, setForm] = useState(null);
  const rows = db[entity];
  return (
    <>
      {can.manage && <Btn bg={C.orange} onClick={() => setForm("new")} style={{ width: "100%", padding: 12, marginBottom: 12 }}>+ إضافة — {title}</Btn>}
      {rows.length === 0 && <Empty text={"لا سجلات في " + title + " بعد."} />}
      {rows.map((r) => {
        const [main, sub] = render(r);
        return (
          <div key={r.id} style={card()} onClick={() => can.manage && setForm(r)}>
            <Row main={main} sub={sub} badge={badge ? badge(r) : undefined} />
          </div>
        );
      })}
      {form && (
        <FormSheet title={form === "new" ? "إضافة — " + title : "تعديل"} onClose={() => setForm(null)} db={db}
          schema={schema} initial={form === "new" ? { active: true } : form}
          onDelete={form !== "new" && can.admin ? () => { remove(entity, form.id); setForm(null); } : undefined}
          onSave={(d) => { form === "new" ? add(entity, d) : update(entity, form.id, d); setForm(null); }} />
      )}
    </>
  );
}

function FormSheet({ title, schema, db, initial = {}, onSave, onClose, onDelete }) {
  const [f, setF] = useState(initial);
  const set = (k, v) => setF({ ...f, [k]: v });
  const first = schema[0].k;
  return (
    <Sheet title={title} onClose={onClose}>
      {schema.map((s) => (
        <Field key={s.k} label={s.label}>
          {s.type === "select" && (
            <select value={f[s.k] || ""} onChange={(e) => set(s.k, e.target.value)} style={input}>
              <option value="">—</option>
              {(s.options || db[s.from] || []).map((o) =>
                typeof o === "string"
                  ? <option key={o} value={o}>{o}</option>
                  : <option key={o.id} value={o.id}>{s.fromLabel ? s.fromLabel(o) : o[s.fromKey]}</option>)}
            </select>
          )}
          {s.type === "multi" && (
            <div style={{ border: `1.5px solid ${C.ink}`, borderRadius: 4, padding: 8, maxHeight: 140, overflowY: "auto", background: "#fff" }}>
              {(db[s.from] || []).length === 0 && <div style={{ color: C.steel, fontSize: 13 }}>لا عناصر متاحة بعد</div>}
              {(db[s.from] || []).map((o) => (
                <label key={o.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0" }}>
                  <input type="checkbox" checked={(f[s.k] || []).includes(o.id)}
                    onChange={(e) => set(s.k, e.target.checked ? [...(f[s.k] || []), o.id] : (f[s.k] || []).filter((x) => x !== o.id))} />
                  <span style={{ fontSize: 14 }}>{o[s.fromKey]}</span>
                </label>
              ))}
            </div>
          )}
          {s.type === "check" && <input type="checkbox" checked={!!f[s.k]} onChange={(e) => set(s.k, e.target.checked)} style={{ width: 22, height: 22 }} />}
          {s.type === "textarea" && <textarea value={f[s.k] || ""} onChange={(e) => set(s.k, e.target.value)} rows={3} style={{ ...input, resize: "vertical" }} />}
          {(!s.type || ["text", "number", "date"].includes(s.type)) && (
            <input type={s.type || "text"} value={f[s.k] ?? ""} onChange={(e) => set(s.k, e.target.value)} style={input} />
          )}
        </Field>
      ))}
      <div style={{ display: "flex", gap: 8 }}>
        <Btn bg={C.orange} style={{ flex: 1, padding: 13, fontSize: 15, opacity: String(f[first] || "").trim() ? 1 : 0.5 }}
          onClick={() => String(f[first] || "").trim() && onSave(f)}>حفظ</Btn>
        {onDelete && <Btn bg={C.red} style={{ padding: 13 }} onClick={onDelete}>حذف</Btn>}
      </div>
    </Sheet>
  );
}

/* ───────────────────────── عناصر واجهة ───────────────────────── */
function AddInline({ placeholder, onAdd }) {
  const [t, setT] = useState("");
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <input value={t} onChange={(e) => setT(e.target.value)} placeholder={placeholder} style={input} />
      <Btn bg={C.ink} onClick={() => { if (t.trim()) { onAdd(t.trim()); setT(""); } }}>+</Btn>
    </div>
  );
}
const card = () => ({ background: C.card, border: `1.5px solid ${C.ink}`, borderRight: `8px solid ${C.ink}`, borderRadius: 4, padding: "10px 12px", marginBottom: 8, boxShadow: "-2px 2px 0 " + C.line });
const input = { width: "100%", padding: "10px 12px", border: `1.5px solid ${C.ink}`, borderRadius: 4, background: "#fff", boxSizing: "border-box" };
const delBtn = { marginTop: 6, background: "none", border: "none", color: C.steel, fontSize: 12, textDecoration: "underline", padding: 0 };

function Btn({ bg, children, style, onClick }) {
  return <button onClick={(e) => { e.stopPropagation(); onClick && onClick(); }} style={{ background: bg, color: "#fff", border: `1.5px solid ${C.ink}`, borderRadius: 4, padding: "7px 12px", fontSize: 13, fontWeight: 700, ...style }}>{children}</button>;
}
function Badge({ text, color }) {
  return <span style={{ background: color, color: "#fff", borderRadius: 4, padding: "3px 8px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{text}</span>;
}
function Chip({ active, children, onClick }) {
  return <button onClick={onClick} style={{ padding: "5px 12px", borderRadius: 999, border: `1.5px solid ${C.ink}`, background: active ? C.ink : "transparent", color: active ? "#fff" : C.ink, fontSize: 13, whiteSpace: "nowrap" }}>{children}</button>;
}
function Stat({ n, label, color, small }) {
  return <div style={{ flex: 1, background: C.card, border: `2px solid ${C.ink}`, borderRadius: 4, padding: "8px 10px" }}>
    <div style={{ fontSize: small ? 14 : 24, fontWeight: 800, color, lineHeight: 1.3 }}>{n}</div>
    <div style={{ fontSize: 10.5, color: C.steel }}>{label}</div>
  </div>;
}
function Section({ title, children }) {
  return <section style={{ marginBottom: 18 }}>
    <h2 style={{ fontSize: 15, fontWeight: 800, borderBottom: `1px solid ${C.line}`, paddingBottom: 5, margin: "0 0 8px" }}>{title}</h2>
    {children}
  </section>;
}
function Row({ main, sub, badge, action }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontWeight: 700, fontSize: 14.5 }}>{main}</div>
      {sub && <div style={{ fontSize: 12.5, color: C.steel }}>{sub}</div>}
    </div>
    {badge && <Badge text={badge.text} color={badge.color} />}
    {action}
  </div>;
}
function Empty({ text }) {
  return <div style={{ padding: "22px 12px", textAlign: "center", color: C.steel, border: `1.5px dashed ${C.line}`, borderRadius: 6, marginBottom: 8, fontSize: 13.5 }}>{text}</div>;
}
function Field({ label, children }) {
  return <label style={{ display: "block", marginBottom: 11, flex: 1 }}>
    <div style={{ fontSize: 12, color: C.steel, marginBottom: 4, fontWeight: 700 }}>{label}</div>
    {children}
  </label>;
}
function Sheet({ title, onClose, children }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(22,25,27,.5)", zIndex: 10, display: "flex", alignItems: "flex-end" }}>
      <div dir="rtl" onClick={(e) => e.stopPropagation()} style={{ background: C.card, width: "100%", maxHeight: "92vh", overflowY: "auto", borderTop: `3px solid ${C.ink}`, borderRadius: "12px 12px 0 0", padding: 16, fontFamily: "'Cairo', system-ui, sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
