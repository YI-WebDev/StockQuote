import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, Search, Edit, Trash2, Eye, Upload, Download,
  Settings, MoreVertical, FileText, DollarSign, CalendarDays, X,
  ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { collection, query, onSnapshot, doc, deleteDoc, orderBy, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import Spinner from '../../components/Spinner';
import ConfirmModal from '../../components/ConfirmModal';
import Pagination from '../../components/Pagination';
import { ITEMS_PER_PAGE } from '../../config/constants';
import { importCsvToFirestore, downloadCsvWithBom } from '../../lib/csv';
import { generateQuoteNumber } from '../../lib/quoteNumber';
import { useOutsideClick } from '../../hooks/useOutsideClick';
import type { Quote } from '../../types/models';

export default function QuoteList() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  type SortColumn = 'quoteNumber' | 'subject' | 'customerName' | 'issueDate' | 'total' | null;
  type SortDirection = 'asc' | 'desc';
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useOutsideClick([
    { selector: ['.dropdown-container', '.dropdown-trigger'], onOutside: () => setOpenDropdownId(null) },
    { selector: '.settings-dropdown-container', onOutside: () => setIsSettingsOpen(false) },
  ]);

  useEffect(() => {
    const q = query(collection(db, 'quotes'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setQuotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Quote[]);
      setLoading(false);
    }, () => {
      setError('見積の取得に失敗しました');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredQuotes = useMemo(() => quotes.filter(q => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      q.quoteNumber.toLowerCase().includes(s) ||
      q.subject.toLowerCase().includes(s) ||
      q.customerName.toLowerCase().includes(s)
    );
  }), [quotes, search]);

  const sortedQuotes = useMemo(() => {
    if (!sortColumn) return filteredQuotes;
    return [...filteredQuotes].sort((a, b) => {
      let aVal: any = a[sortColumn];
      let bVal: any = b[sortColumn];
      if (aVal === undefined || aVal === null) aVal = '';
      else if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (bVal === undefined || bVal === null) bVal = '';
      else if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredQuotes, sortColumn, sortDirection]);

  const totalAmount = useMemo(() => quotes.reduce((sum, q) => sum + q.total, 0), [quotes]);

  const thisMonthQuotes = useMemo(() => {
    const now = new Date();
    return quotes.filter(q => {
      const d = new Date(q.issueDate);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
  }, [quotes]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [search, sortColumn, sortDirection]);

  const totalPages = Math.ceil(sortedQuotes.length / ITEMS_PER_PAGE);
  const paginatedQuotes = sortedQuotes.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const allPageSelected = paginatedQuotes.length > 0 && paginatedQuotes.every(q => selectedIds.has(q.id));
  const somePageSelected = paginatedQuotes.some(q => selectedIds.has(q.id));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = somePageSelected && !allPageSelected;
    }
  }, [somePageSelected, allPageSelected]);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allPageSelected) {
        paginatedQuotes.forEach(q => next.delete(q.id));
      } else {
        paginatedQuotes.forEach(q => next.add(q.id));
      }
      return next;
    });
  }, [allPageSelected, paginatedQuotes]);

  const toggleSelect = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null);
        setSortDirection('desc');
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 group-hover/th:text-gray-500 opacity-0 group-hover/th:opacity-100 transition-opacity" />;
    if (sortDirection === 'asc') return <ArrowUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />;
    return <ArrowDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />;
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    try {
      const ids: string[] = [...selectedIds];
      const CHUNK = 490;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const batch = writeBatch(db);
        ids.slice(i, i + CHUNK).forEach(id => batch.delete(doc(db, 'quotes', id)));
        await batch.commit();
      }
      toast.success(`${selectedIds.size}件の見積を削除しました`);
      setSelectedIds(new Set());
    } catch {
      toast.error('削除に失敗しました');
    } finally {
      setIsBulkDeleting(false);
      setBulkDeleteConfirm(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    toast.loading('インポート中...', { id: 'import' });

    try {
      const totalCount = await importCsvToFirestore(file, 'quotes', (row) => {
        const subject = row['件名'] || row['subject'];
        const customerName = row['宛名'] || row['customerName'];

        if (!subject || !customerName) return null;

        return {
          quoteNumber: row['見積番号'] || row['quoteNumber'] || generateQuoteNumber(),
          subject,
          customerName,
          issueDate: row['発行日'] || row['issueDate'] || new Date().toISOString().split('T')[0],
          expiryDate: row['有効期限'] || row['expiryDate'] || '',
          subtotal: Number(row['小計'] || row['subtotal']) || 0,
          tax: Number(row['消費税'] || row['tax']) || 0,
          total: Number(row['合計'] || row['total']) || 0,
          note: row['備考'] || row['note'] || '',
          items: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

      if (totalCount > 0) {
        toast.success(`${totalCount}件の見積をインポートしました`, { id: 'import' });
      } else {
        toast.error('有効なデータが見つかりませんでした', { id: 'import' });
      }
    } catch {
      toast.error('インポート中にエラーが発生しました', { id: 'import' });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExportClick = () => {
    if (filteredQuotes.length === 0) {
      toast.error('エクスポートするデータがありません');
      return;
    }
    try {
      downloadCsvWithBom(
        filteredQuotes.map(q => ({
          '見積番号': q.quoteNumber || '',
          '件名': q.subject || '',
          '宛名': q.customerName || '',
          '発行日': q.issueDate || '',
          '有効期限': q.expiryDate || '',
          '小計': q.subtotal || 0,
          '消費税': q.tax || 0,
          '合計': q.total || 0,
          '備考': q.note || '',
        })),
        `quotes_${new Date().toISOString().split('T')[0]}.csv`
      );
      toast.success('CSVをエクスポートしました');
    } catch {
      toast.error('エクスポートに失敗しました');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'quotes', deleteId));
      toast.success('見積を削除しました');
    } catch {
      toast.error('見積の削除に失敗しました');
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">見積管理</h1>
          <p className="page-subtitle">
            見積書の作成・管理
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Settings dropdown */}
          <div className="relative settings-dropdown-container">
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="btn-secondary p-2.5"
              aria-label="設定"
            >
              <Settings className="w-4 h-4" />
            </button>
            {isSettingsOpen && (
              <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-48 rounded-xl shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black/5 z-50 border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="py-1" role="menu">
                  <button
                    onClick={() => { setIsSettingsOpen(false); handleImportClick(); }}
                    disabled={isImporting}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    role="menuitem"
                  >
                    <Upload className="w-4 h-4 text-gray-400" />
                    CSVインポート
                  </button>
                  <button
                    onClick={() => { setIsSettingsOpen(false); handleExportClick(); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2.5 transition-colors"
                    role="menuitem"
                  >
                    <Download className="w-4 h-4 text-gray-400" />
                    CSVエクスポート
                  </button>
                </div>
              </div>
            )}
          </div>

          <Link
            to="/quotes/new"
            className="btn-primary flex-1 sm:flex-none"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">見積作成</span>
            <span className="sm:hidden">作成</span>
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="stat-card">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">見積件数</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{quotes.length}<span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">件</span></p>
            </div>
          </div>
          <div className="stat-card">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">見積総額</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">¥{totalAmount.toLocaleString()}</p>
            </div>
          </div>
          <div className="stat-card col-span-2 sm:col-span-1">
            <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
              <CalendarDays className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">今月の見積</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{thisMonthQuotes.length}<span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">件</span></p>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="見積番号・件名・宛名で検索..."
              className="input-base pl-9 pr-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {search && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">フィルター:</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
              検索: {search}
              <button onClick={() => setSearch('')} className="hover:text-indigo-900 dark:hover:text-indigo-100"><X className="w-3 h-3" /></button>
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {filteredQuotes.length}件 / 全{quotes.length}件
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{selectedIds.size}件選択中</span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-200 underline"
            >
              選択解除
            </button>
          </div>
          <button
            onClick={() => setBulkDeleteConfirm(true)}
            className="btn-danger text-xs px-3 py-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            一括削除
          </button>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-visible">
        {/* Desktop Table View */}
        <div className="hidden md:block">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 group/header">
                <th className="pl-4 pr-2 py-3 rounded-tl-xl w-10">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={toggleSelectAll}
                    disabled={paginatedQuotes.length === 0}
                    className={`w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:cursor-default transition-opacity duration-150 ${somePageSelected ? 'opacity-100' : 'opacity-0 group-hover/header:opacity-100'}`}
                  />
                </th>
                <th
                  className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer group/th hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors select-none"
                  onClick={() => handleSort('quoteNumber')}
                >
                  <div className="flex items-center gap-1.5">
                    見積番号
                    <SortIcon column="quoteNumber" />
                  </div>
                </th>
                <th
                  className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer group/th hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors select-none"
                  onClick={() => handleSort('subject')}
                >
                  <div className="flex items-center gap-1.5">
                    件名
                    <SortIcon column="subject" />
                  </div>
                </th>
                <th
                  className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer group/th hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors select-none"
                  onClick={() => handleSort('customerName')}
                >
                  <div className="flex items-center gap-1.5">
                    宛名
                    <SortIcon column="customerName" />
                  </div>
                </th>
                <th
                  className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer group/th hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors select-none"
                  onClick={() => handleSort('issueDate')}
                >
                  <div className="flex items-center gap-1.5">
                    発行日
                    <SortIcon column="issueDate" />
                  </div>
                </th>
                <th
                  className="px-5 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer group/th hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors select-none"
                  onClick={() => handleSort('total')}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <SortIcon column="total" />
                    合計金額
                  </div>
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider rounded-tr-xl">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <div className="flex justify-center">
                      <Spinner />
                    </div>
                  </td>
                </tr>
              ) : filteredQuotes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <FileText className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {search ? '条件に合う見積が見つかりません' : '見積が登録されていません'}
                    </p>
                    {!search && (
                      <Link to="/quotes/new" className="mt-3 inline-block text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                        最初の見積を作成する →
                      </Link>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedQuotes.map((quote) => (
                  <tr
                    key={quote.id}
                    className={`hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer group ${selectedIds.has(quote.id) ? 'bg-indigo-50/60 dark:bg-indigo-950/30' : ''}`}
                    onClick={() => navigate(`/quotes/${quote.id}`)}
                  >
                    <td className="pl-4 pr-2 py-3.5 whitespace-nowrap cursor-pointer" onClick={(e) => toggleSelect(quote.id, e)}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(quote.id)}
                        onChange={() => {}}
                        className={`w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer transition-opacity duration-150 ${selectedIds.has(quote.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                      />
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="text-xs font-mono font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md">
                        {quote.quoteNumber}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">{quote.subject}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{quote.customerName}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(quote.issueDate).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white text-right">
                      ¥{quote.total.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-right text-sm relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setOpenDropdownId(openDropdownId === quote.id ? null : quote.id)}
                        className="dropdown-trigger text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {openDropdownId === quote.id && (
                        <div className="dropdown-container absolute right-8 top-10 w-44 rounded-xl shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black/5 z-50 border border-gray-200 dark:border-gray-700 overflow-hidden">
                          <div className="py-1" role="menu">
                            <Link
                              to={`/quotes/${quote.id}`}
                              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                              role="menuitem"
                              onClick={() => setOpenDropdownId(null)}
                            >
                              <Eye className="w-4 h-4 text-gray-400" />
                              詳細を見る
                            </Link>
                            <Link
                              to={`/quotes/${quote.id}/edit`}
                              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                              role="menuitem"
                              onClick={() => setOpenDropdownId(null)}
                            >
                              <Edit className="w-4 h-4 text-gray-400" />
                              編集
                            </Link>
                            <button
                              onClick={() => { setDeleteId(quote.id); setOpenDropdownId(null); }}
                              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              role="menuitem"
                            >
                              <Trash2 className="w-4 h-4" />
                              削除
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="block md:hidden">
          {loading ? (
            <div className="p-10 text-center">
              <div className="flex justify-center">
                <Spinner />
              </div>
            </div>
          ) : filteredQuotes.length === 0 ? (
            <div className="p-10 text-center">
              <FileText className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {search ? '条件に合う見積が見つかりません' : '見積が登録されていません'}
              </p>
              {!search && (
                <Link to="/quotes/new" className="mt-3 inline-block text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                  最初の見積を作成する →
                </Link>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {paginatedQuotes.map((quote) => (
                <div
                  key={quote.id}
                  className={`p-4 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer relative ${selectedIds.has(quote.id) ? 'bg-indigo-50/60 dark:bg-indigo-950/30' : ''}`}
                  onClick={() => navigate(`/quotes/${quote.id}`)}
                >
                  <div className="flex justify-between items-start mb-1.5">
                    <div className="flex items-start gap-2.5 pr-8 flex-1 min-w-0">
                      <div
                        onClick={(e) => toggleSelect(quote.id, e)}
                        className="pt-0.5 shrink-0 w-5 h-5 flex items-center justify-center"
                      >
                        {selectedIds.has(quote.id) ? (
                          <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-mono text-indigo-600 dark:text-indigo-400 mb-0.5">{quote.quoteNumber}</div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{quote.subject}</div>
                      </div>
                    </div>
                    <div className="absolute top-4 right-4" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setOpenDropdownId(openDropdownId === quote.id ? null : quote.id)}
                        className="dropdown-trigger text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {openDropdownId === quote.id && (
                        <div className="dropdown-container absolute right-0 top-8 w-44 rounded-xl shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black/5 z-50 border border-gray-200 dark:border-gray-700 overflow-hidden">
                          <div className="py-1" role="menu">
                            <Link
                              to={`/quotes/${quote.id}`}
                              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                              role="menuitem"
                              onClick={() => setOpenDropdownId(null)}
                            >
                              <Eye className="w-4 h-4 text-gray-400" />
                              詳細を見る
                            </Link>
                            <Link
                              to={`/quotes/${quote.id}/edit`}
                              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                              role="menuitem"
                              onClick={() => setOpenDropdownId(null)}
                            >
                              <Edit className="w-4 h-4 text-gray-400" />
                              編集
                            </Link>
                            <button
                              onClick={() => { setDeleteId(quote.id); setOpenDropdownId(null); }}
                              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              role="menuitem"
                            >
                              <Trash2 className="w-4 h-4" />
                              削除
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 pl-7">{quote.customerName}</div>
                  <div className="flex justify-between items-end pl-7">
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(quote.issueDate).toLocaleDateString('ja-JP')}
                    </div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">¥{quote.total.toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {!loading && filteredQuotes.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={sortedQuotes.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      <ConfirmModal
        isOpen={deleteId !== null}
        title="見積の削除"
        message="本当にこの見積を削除しますか？この操作は取り消せません。"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />

      <ConfirmModal
        isOpen={bulkDeleteConfirm}
        title="一括削除の確認"
        message={`選択した${selectedIds.size}件の見積を削除しますか？この操作は取り消せません。`}
        onConfirm={handleBulkDelete}
        onCancel={() => !isBulkDeleting && setBulkDeleteConfirm(false)}
      />
    </div>
  );
}
