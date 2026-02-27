"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Wallet,
  CreditCard,
  PiggyBank,
  TrendingDown,
  PlusCircle,
  Target,
  AlertCircle,
  CheckCircle2,
  List,
  Trash2,
  Download,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  X,
  Landmark,
} from "lucide-react";

// =============================================
// CẤU HÌNH DANH MỤC
// =============================================
const CATEGORIES = {
  INCOME: [
    { id: "salary", name: "Lương chính" },
    { id: "bonus", name: "Thưởng/Khác" },
  ],
  SAVINGS: [
    { id: "saving_fund", name: "Quỹ Tiết kiệm", group: "Tiết Kiệm (20%)" },
    { id: "debt_payoff", name: "Trả nợ gốc", group: "Tiết Kiệm (20%)" },
  ],
  NEEDS: [
    { id: "rent", name: "Nhà ở", group: "Thiết Yếu (50%)" },
    { id: "utilities", name: "Điện/Nước/Internet", group: "Thiết Yếu (50%)" },
    { id: "groceries", name: "Đi chợ/Siêu thị", group: "Thiết Yếu (50%)" },
    { id: "transport", name: "Xăng xe", group: "Thiết Yếu (50%)" },
  ],
  WANTS: [
    { id: "dining_out", name: "Ăn ngoài/Cà phê", group: "Giải Trí (30%)" },
    { id: "health", name: "Gym/Yoga", group: "Giải Trí (30%)" },
    {
      id: "entertainment",
      name: "Giải trí (Xem phim, Du lịch)",
      group: "Giải Trí (30%)",
    },
    { id: "shopping", name: "Mua sắm cá nhân", group: "Giải Trí (30%)" },
  ],
  DEBT: [
    { id: "debt_borrow", name: "Vay nợ", group: "Nợ" },
    { id: "debt_lend", name: "Cho vay", group: "Nợ" },
    { id: "debt_other", name: "Nợ khác", group: "Nợ" },
  ],
};

type TxType = "income" | "expense" | "debt";

type Transaction = {
  id: number;
  type: TxType;
  category: string;
  name: string;
  amount: number;
  date: string;
  method?: string;
};

type Budgets = { [key: string]: number };
type SortField = "date" | "amount" | "name" | "type";
type SortDir = "asc" | "desc";

// =============================================
// HELPERS
// =============================================
function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function monthKey(base: string, date = new Date()) {
  return `${base}_${date.getFullYear()}_${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}`;
}

function exportToExcel(
  transactions: Transaction[],
  budgets: Budgets,
  monthLabel: string
) {
  const allExpCats = [
    ...CATEGORIES.SAVINGS,
    ...CATEGORIES.NEEDS,
    ...CATEGORIES.WANTS,
  ];

  const getCatName = (t: Transaction) => {
    if (t.type === "income")
      return (
        CATEGORIES.INCOME.find((c) => c.id === t.category)?.name || t.category
      );
    if (t.type === "debt")
      return (
        CATEGORIES.DEBT.find((c) => c.id === t.category)?.name || t.category
      );
    return allExpCats.find((c) => c.id === t.category)?.name || t.category;
  };

  const getTypeLabel = (type: TxType) =>
    type === "income" ? "Thu nhập" : type === "debt" ? "Nợ" : "Chi tiêu";

  const spentByCategory = transactions
    .filter((t) => t.type === "expense")
    .reduce((acc: Record<string, number>, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const totalSpent = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const totalDebt = transactions
    .filter((t) => t.type === "debt")
    .reduce((s, t) => s + t.amount, 0);

  const esc = (s: string) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const row = (cells: string[]) =>
    `<Row>${cells
      .map((c) => `<Cell><Data ss:Type="String">${esc(c)}</Data></Cell>`)
      .join("")}</Row>`;

  const numRow = (cells: (string | number)[]) =>
    `<Row>${cells
      .map((c) =>
        typeof c === "number"
          ? `<Cell><Data ss:Type="Number">${c}</Data></Cell>`
          : `<Cell><Data ss:Type="String">${esc(String(c))}</Data></Cell>`
      )
      .join("")}</Row>`;

  const txRows = transactions
    .map((t) =>
      numRow([
        t.date,
        getTypeLabel(t.type),
        getCatName(t),
        t.name,
        t.method || "",
        t.type === "income" ? t.amount : -t.amount,
      ])
    )
    .join("");

  const sheet1 = `<Worksheet ss:Name="Giao Dịch"><Table>
    ${row([
      "Ngày",
      "Loại",
      "Danh mục",
      "Diễn giải",
      "Phương thức",
      "Số tiền (VNĐ)",
    ])}
    ${txRows}<Row/>
    ${numRow(["", "", "", "", "TỔNG THU", totalIncome])}
    ${numRow(["", "", "", "", "TỔNG CHI", totalSpent])}
    ${numRow(["", "", "", "", "TỔNG NỢ", totalDebt])}
    ${numRow(["", "", "", "", "CÒN LẠI", totalIncome - totalSpent])}
  </Table></Worksheet>`;

  const budgetRows = [
    ...CATEGORIES.SAVINGS,
    ...CATEGORIES.NEEDS,
    ...CATEGORIES.WANTS,
  ]
    .map((cat) => {
      const budgeted = budgets[cat.id] || 0;
      const spent = spentByCategory[cat.id] || 0;
      const pct =
        budgeted > 0 ? ((spent / budgeted) * 100).toFixed(1) + "%" : "0%";
      return numRow([
        cat.group || "",
        cat.name,
        budgeted,
        spent,
        budgeted - spent,
        pct,
      ]);
    })
    .join("");

  const sheet2 = `<Worksheet ss:Name="Ngân Sách"><Table>
    ${row(["Nhóm", "Danh mục", "Ngân sách", "Đã chi", "Còn lại", "% Sử dụng"])}
    ${budgetRows}
  </Table></Worksheet>`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  ${sheet1}${sheet2}
</Workbook>`;

  const blob = new Blob([xml], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ZBB_${monthLabel.replace("/", "-")}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

// =============================================
// COMPONENT CHÍNH
// =============================================
export default function App() {
  const now = new Date();
  const currentMonthKey = monthKey("zbb_transactions");
  const monthLabel = `${now.getMonth() + 1}/${now.getFullYear()}`;

  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    loadFromStorage<Transaction[]>(currentMonthKey, [])
  );
  const [budgets, setBudgets] = useState<Budgets>(() =>
    loadFromStorage<Budgets>("zbb_budgets", {})
  );
  const [formData, setFormData] = useState({
    type: "expense" as TxType,
    category: "groceries",
    name: "",
    amount: "",
    date: now.toISOString().split("T")[0],
    method: "Tiền mặt",
  });

  // Filter & Sort
  const [filterType, setFilterType] = useState<TxType | "all">("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterMethod, setFilterMethod] = useState("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    localStorage.setItem(currentMonthKey, JSON.stringify(transactions));
  }, [transactions, currentMonthKey]);

  useEffect(() => {
    localStorage.setItem("zbb_budgets", JSON.stringify(budgets));
  }, [budgets]);

  useEffect(() => {
    const thisMonth = `${now.getFullYear()}_${String(
      now.getMonth() + 1
    ).padStart(2, "0")}`;
    localStorage.setItem("zbb_last_month", thisMonth);
  }, []);

  // --- TÍNH TOÁN ---
  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const totalBudgeted = Object.values(budgets).reduce((s, v) => s + v, 0);
  const zbbBalance = totalIncome - totalBudgeted;
  const totalSpent = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const totalDebt = transactions
    .filter((t) => t.type === "debt")
    .reduce((s, t) => s + t.amount, 0);
  const debtCount = transactions.filter((t) => t.type === "debt").length;
  const creditCardEscrow = transactions
    .filter((t) => t.type === "expense" && t.method === "Thẻ tín dụng")
    .reduce((s, t) => s + t.amount, 0);
  const totalSaved = transactions
    .filter(
      (t) =>
        t.type === "expense" &&
        (t.category === "saving_fund" || t.category === "debt_payoff")
    )
    .reduce((s, t) => s + t.amount, 0);
  const spentByCategory = transactions
    .filter((t) => t.type === "expense")
    .reduce((acc: Record<string, number>, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});

  const allExpenseCategories = [
    ...CATEGORIES.SAVINGS,
    ...CATEGORIES.NEEDS,
    ...CATEGORIES.WANTS,
  ];

  const getCategoriesForType = (type: TxType) => {
    if (type === "income") return CATEGORIES.INCOME;
    if (type === "debt") return CATEGORIES.DEBT;
    return allExpenseCategories;
  };

  const getCatName = (t: Transaction) => {
    if (t.type === "income")
      return (
        CATEGORIES.INCOME.find((c) => c.id === t.category)?.name || t.category
      );
    if (t.type === "debt")
      return (
        CATEGORIES.DEBT.find((c) => c.id === t.category)?.name || t.category
      );
    return (
      allExpenseCategories.find((c) => c.id === t.category)?.name || t.category
    );
  };

  const getTypeBadge = (type: TxType) => {
    if (type === "income")
      return "border-emerald-200 text-emerald-700 bg-emerald-50";
    if (type === "debt")
      return "border-orange-200 text-orange-700 bg-orange-50";
    return "border-slate-200 text-slate-600 bg-slate-50";
  };

  const getTypeLabel = (type: TxType) => {
    if (type === "income") return "Thu nhập";
    if (type === "debt") return "Nợ";
    return "Chi tiêu";
  };

  // --- FILTER & SORT ---
  const filteredAndSorted = useMemo(() => {
    let result = [...transactions];
    if (filterType !== "all")
      result = result.filter((t) => t.type === filterType);
    if (filterCategory !== "all")
      result = result.filter((t) => t.category === filterCategory);
    if (filterMethod !== "all")
      result = result.filter((t) => t.method === filterMethod);
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === "date") cmp = a.date.localeCompare(b.date);
      else if (sortField === "amount") cmp = a.amount - b.amount;
      else if (sortField === "name") cmp = a.name.localeCompare(b.name);
      else if (sortField === "type") cmp = a.type.localeCompare(b.type);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [
    transactions,
    filterType,
    filterCategory,
    filterMethod,
    sortField,
    sortDir,
  ]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field)
      return <ArrowUpDown className="w-3 h-3 text-slate-300" />;
    return sortDir === "asc" ? (
      <ArrowUp className="w-3 h-3 text-indigo-500" />
    ) : (
      <ArrowDown className="w-3 h-3 text-indigo-500" />
    );
  };

  const hasActiveFilters =
    filterType !== "all" || filterCategory !== "all" || filterMethod !== "all";

  // --- HANDLERS ---
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    if (name === "type") {
      const newType = value as TxType;
      const cats = getCategoriesForType(newType);
      setFormData((prev) => ({
        ...prev,
        type: newType,
        category: cats[0]?.id || "",
        method: newType === "debt" ? "" : "Tiền mặt",
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.name) return;
    const newTx: Transaction = {
      id: Date.now(),
      type: formData.type,
      category: formData.category,
      name: formData.name,
      amount: parseInt(formData.amount, 10),
      date: formData.date,
      ...(formData.type !== "debt" && { method: formData.method }),
    };
    setTransactions((prev) => [newTx, ...prev]);
    setFormData((prev) => ({ ...prev, name: "", amount: "" }));
  };

  const handleDeleteTransaction = (id: number) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const handleResetMonth = () => {
    if (
      window.confirm(
        `Xóa toàn bộ giao dịch tháng ${monthLabel}? Ngân sách sẽ được giữ nguyên.`
      )
    ) {
      setTransactions([]);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);

  const renderCategoryProgress = (
    groupName: string,
    categories: typeof CATEGORIES.SAVINGS
  ) => (
    <div className="mb-6">
      <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3 pb-2 border-b">
        {groupName}
      </h3>
      <div className="space-y-4">
        {categories.map((cat) => {
          const budgeted = budgets[cat.id] || 0;
          const spent = spentByCategory[cat.id] || 0;
          const remaining = budgeted - spent;
          const percentage =
            budgeted > 0 ? Math.min((spent / budgeted) * 100, 100) : 0;
          let progressColor = "bg-blue-500";
          if (percentage >= 90) progressColor = "bg-red-500";
          else if (percentage >= 75) progressColor = "bg-yellow-500";
          else if (cat.group?.includes("Tiết Kiệm"))
            progressColor = "bg-green-500";
          return (
            <div key={cat.id} className="text-sm">
              <div className="flex justify-between mb-1">
                <span className="font-medium text-slate-700">{cat.name}</span>
                <span
                  className={`font-semibold ${
                    remaining < 0 ? "text-red-500" : "text-slate-600"
                  }`}
                >
                  {formatCurrency(remaining)}{" "}
                  <span className="text-xs font-normal text-slate-400">
                    còn lại
                  </span>
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className={`${progressColor} h-2 rounded-full transition-all duration-500`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-xs text-slate-500">
                <span>Đã chi: {formatCurrency(spent)}</span>
                <span>Ngân sách: {formatCurrency(budgeted)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const categoriesForForm = getCategoriesForType(formData.type);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <div className="mx-auto space-y-6">
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Bảng Điều Khiển ZBB - Tân Phạm
            </h1>
            <p className="text-slate-500">
              Quản trị tài chính cá nhân chủ động theo quy tắc 50/30/20
            </p>
          </div>
          <div className="mt-4 md:mt-0 flex flex-wrap items-center gap-2">
            <div className="px-4 py-2 bg-slate-100 rounded-lg flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-600" />
              <span className="font-semibold text-slate-700">
                Tháng {monthLabel}
              </span>
            </div>
            <button
              onClick={() => exportToExcel(transactions, budgets, monthLabel)}
              className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" /> Xuất Excel
            </button>
            <button
              onClick={handleResetMonth}
              className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-4 h-4" /> Xóa tháng này
            </button>
          </div>
        </header>

        {/* ZBB STATUS BAR */}
        <div
          className={`p-4 rounded-xl flex items-center justify-between shadow-sm border ${
            zbbBalance === 0
              ? "bg-emerald-50 border-emerald-200"
              : "bg-amber-50 border-amber-200"
          }`}
        >
          <div className="flex items-center gap-3">
            {zbbBalance === 0 ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            ) : (
              <AlertCircle className="w-6 h-6 text-amber-600" />
            )}
            <div>
              <h3
                className={`font-bold ${
                  zbbBalance === 0 ? "text-emerald-800" : "text-amber-800"
                }`}
              >
                Trạng thái Zero-Based Budget
              </h3>
              <p
                className={`text-sm ${
                  zbbBalance === 0 ? "text-emerald-600" : "text-amber-700"
                }`}
              >
                {zbbBalance === 0
                  ? "Tuyệt vời! Bạn đã phân bổ chính xác 100% thu nhập."
                  : `Bạn có ${formatCurrency(Math.abs(zbbBalance))} ${
                      zbbBalance > 0
                        ? "chưa được phân bổ"
                        : "phân bổ vượt quá thu nhập"
                    }. Hãy điều chỉnh lại ngân sách!`}
              </p>
            </div>
          </div>
          <div
            className={`text-xl font-bold ${
              zbbBalance === 0 ? "text-emerald-600" : "text-amber-700"
            }`}
          >
            {formatCurrency(zbbBalance)}
          </div>
        </div>

        {/* METRICS CARDS — 5 ô */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <Wallet className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-medium text-slate-500">
                Tổng Thu Nhập
              </h3>
            </div>
            <p className="text-xl font-bold text-slate-800">
              {formatCurrency(totalIncome)}
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                <TrendingDown className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-medium text-slate-500">
                Tổng Thực Chi
              </h3>
            </div>
            <p className="text-xl font-bold text-slate-800">
              {formatCurrency(totalSpent)}
            </p>
            <p className="text-xs text-slate-400 mt-1">Từ tất cả các nguồn</p>
          </div>

          {/* Tổng Nợ */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-orange-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-2 h-full bg-orange-400" />
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                <Landmark className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-medium text-slate-500">
                Tổng Nợ Tháng
              </h3>
            </div>
            <p className="text-xl font-bold text-orange-600">
              {formatCurrency(totalDebt)}
            </p>
            <p className="text-xs text-slate-500 mt-1 italic">
              {debtCount} khoản nợ
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-2 h-full bg-red-500" />
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-red-50 text-red-600 rounded-lg">
                <CreditCard className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-medium text-slate-500">
                Chờ Trả Thẻ
              </h3>
            </div>
            <p className="text-xl font-bold text-red-600">
              {formatCurrency(creditCardEscrow)}
            </p>
            <p className="text-xs text-slate-500 mt-1 italic">
              Chờ tất toán thẻ.
            </p>
          </div>

          <div className="col-span-2 md:col-span-1 bg-gradient-to-br from-emerald-500 to-teal-600 p-5 rounded-2xl shadow-sm text-white">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-white/20 rounded-lg">
                <PiggyBank className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-medium text-emerald-50">
                Tiết Kiệm/Trả Nợ
              </h3>
            </div>
            <p className="text-xl font-bold">{formatCurrency(totalSaved)}</p>
            <p className="text-xs text-emerald-100 mt-1">
              Quy tắc "Trả cho mình trước"
            </p>
          </div>
        </div>

        {/* MAIN CONTENT GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: BUDGET TRACKING */}
          <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Target className="w-5 h-5" /> Theo Dõi Ngân Sách
            </h2>
            <div
              className="overflow-y-auto pr-2"
              style={{ maxHeight: "600px" }}
            >
              {renderCategoryProgress(
                "Nhóm 1: Tiết kiệm / Trả nợ (20%)",
                CATEGORIES.SAVINGS
              )}
              {renderCategoryProgress(
                "Nhóm 2: Nhu cầu thiết yếu (50%)",
                CATEGORIES.NEEDS
              )}
              {renderCategoryProgress(
                "Nhóm 3: Giải trí / Linh hoạt (30%)",
                CATEGORIES.WANTS
              )}
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="lg:col-span-2 space-y-6">
            {/* FORM */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-indigo-600" /> Nhập Giao
                Dịch Mới
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Loại giao dịch
                    </label>
                    <select
                      name="type"
                      value={formData.type}
                      onChange={handleInputChange}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="expense">Chi tiêu (-)</option>
                      <option value="income">Thu nhập (+)</option>
                      <option value="debt">Nợ</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Danh mục
                    </label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {categoriesForForm.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {"group" in cat
                            ? `${cat.group} - ${cat.name}`
                            : cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Diễn giải (Tên chi phí)
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="VD: Tiền phở, Đóng học phí..."
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Số tiền (VNĐ)
                    </label>
                    <input
                      type="number"
                      name="amount"
                      value={formData.amount}
                      onChange={handleInputChange}
                      placeholder="0"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      required
                    />
                  </div>
                  {/* Phương thức — ẩn khi loại là Nợ */}
                  {formData.type !== "debt" ? (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Nguồn tiền / Phương thức
                      </label>
                      <select
                        name="method"
                        value={formData.method}
                        onChange={handleInputChange}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="Tiền mặt">Tiền mặt</option>
                        <option value="Chuyển khoản">
                          Chuyển khoản / Ví ĐT
                        </option>
                        <option value="Thẻ tín dụng">
                          Thẻ tín dụng (Ghi nợ ảo)
                        </option>
                      </select>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <p className="text-sm text-slate-400 italic">
                        * Giao dịch nợ không cần phương thức thanh toán.
                      </p>
                    </div>
                  )}
                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex justify-center items-center gap-2"
                    >
                      <PlusCircle className="w-5 h-5" /> Ghi nhận giao dịch
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* TRANSACTION LIST */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              {/* Header + Filter toggle */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <List className="w-5 h-5" />
                  Lịch Sử Tháng {monthLabel}
                  <span className="text-sm font-normal text-slate-400">
                    ({filteredAndSorted.length}/{transactions.length})
                  </span>
                </h2>
                <button
                  onClick={() => setShowFilters((v) => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    hasActiveFilters
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  Lọc
                  {hasActiveFilters
                    ? ` (${
                        [
                          filterType !== "all",
                          filterCategory !== "all",
                          filterMethod !== "all",
                        ].filter(Boolean).length
                      })`
                    : ""}
                </button>
              </div>

              {/* FILTER PANEL */}
              {showFilters && (
                <div className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Loại giao dịch
                    </label>
                    <select
                      value={filterType}
                      onChange={(e) =>
                        setFilterType(e.target.value as TxType | "all")
                      }
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      <option value="all">Tất cả</option>
                      <option value="income">Thu nhập</option>
                      <option value="expense">Chi tiêu</option>
                      <option value="debt">Nợ</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Danh mục
                    </label>
                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      <option value="all">Tất cả</option>
                      {[
                        ...CATEGORIES.INCOME,
                        ...allExpenseCategories,
                        ...CATEGORIES.DEBT,
                      ].map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Phương thức
                    </label>
                    <select
                      value={filterMethod}
                      onChange={(e) => setFilterMethod(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      <option value="all">Tất cả</option>
                      <option value="Tiền mặt">Tiền mặt</option>
                      <option value="Chuyển khoản">Chuyển khoản</option>
                      <option value="Thẻ tín dụng">Thẻ tín dụng</option>
                    </select>
                  </div>
                  {hasActiveFilters && (
                    <div className="md:col-span-3 flex justify-end">
                      <button
                        onClick={() => {
                          setFilterType("all");
                          setFilterCategory("all");
                          setFilterMethod("all");
                        }}
                        className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
                      >
                        <X className="w-3 h-3" /> Xóa bộ lọc
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                    <tr>
                      {[
                        { field: "date" as SortField, label: "Ngày" },
                        { field: "name" as SortField, label: "Diễn giải" },
                        { field: "type" as SortField, label: "Loại" },
                      ].map(({ field, label }) => (
                        <th
                          key={field}
                          className="px-4 py-3 cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap"
                          onClick={() => handleSort(field)}
                        >
                          <div className="flex items-center gap-1">
                            {label} <SortIcon field={field} />
                          </div>
                        </th>
                      ))}
                      <th className="px-4 py-3">Danh mục</th>
                      <th className="px-4 py-3">Phương thức</th>
                      <th
                        className="px-4 py-3 cursor-pointer hover:bg-slate-100 select-none text-right whitespace-nowrap"
                        onClick={() => handleSort("amount")}
                      >
                        <div className="flex items-center justify-end gap-1">
                          Số tiền <SortIcon field="amount" />
                        </div>
                      </th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSorted.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-12 text-center text-slate-400"
                        >
                          <div className="flex flex-col items-center gap-2">
                            <List className="w-8 h-8 text-slate-300" />
                            <span>
                              {hasActiveFilters
                                ? "Không có giao dịch nào khớp bộ lọc."
                                : "Chưa có giao dịch nào trong tháng này."}
                            </span>
                            {!hasActiveFilters && (
                              <span className="text-xs">
                                Hãy nhập giao dịch đầu tiên của tháng!
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredAndSorted.map((t) => (
                        <tr
                          key={t.id}
                          className="border-b border-slate-50 last:border-0 hover:bg-slate-50 group"
                        >
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                            {t.date}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-800">
                            {t.name}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-xs px-2 py-1 rounded border font-medium ${getTypeBadge(
                                t.type
                              )}`}
                            >
                              {getTypeLabel(t.type)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs">
                              {getCatName(t)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {t.method ? (
                              <span
                                className={`text-xs px-2 py-1 rounded border ${
                                  t.method === "Thẻ tín dụng"
                                    ? "border-red-200 text-red-600 bg-red-50"
                                    : t.method === "Tiền mặt"
                                    ? "border-green-200 text-green-600 bg-green-50"
                                    : "border-blue-200 text-blue-600 bg-blue-50"
                                }`}
                              >
                                {t.method}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-bold whitespace-nowrap ${
                              t.type === "income"
                                ? "text-emerald-600"
                                : t.type === "debt"
                                ? "text-orange-600"
                                : "text-slate-800"
                            }`}
                          >
                            {t.type === "income"
                              ? "+"
                              : t.type === "debt"
                              ? "±"
                              : "-"}
                            {formatCurrency(t.amount)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleDeleteTransaction(t.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-500"
                              title="Xóa giao dịch"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
