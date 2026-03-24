import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, Search, Edit, Trash2, Eye, Upload, Download,
  Settings, MoreVertical, FileText, DollarSign, CalendarDays, X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { collection, query, onSnapshot, doc, deleteDoc, orderBy } from 'firebase/firestore';
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
  }, [search]);

  const totalPages = Math.ceil(filteredQuotes.length / ITEMS_PER_PAGE);
  const paginatedQuotes = filteredQuotes.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">見積管理</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
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
              className="btn-secondary p-2"
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
      <div className="card p-4">
        <div className="relative max-w-lg">
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
        {search && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {filteredQuotes.length}件 / 全{quotes.length}件
          </p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">見積番号</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">件名</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">宛名</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">発行日</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">合計金額</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <div className="flex justify-center">
                      <Spinner />
                    </div>
                  </td>
                </tr>
              ) : filteredQuotes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
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
                    className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/quotes/${quote.id}`)}
                  >
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
                  className="p-4 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer relative"
                  onClick={() => navigate(`/quotes/${quote.id}`)}
                >
                  <div className="flex justify-between items-start mb-1.5">
                    <div className="flex-1 min-w-0 pr-8">
                      <div className="text-xs font-mono text-indigo-600 dark:text-indigo-400 mb-0.5">{quote.quoteNumber}</div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{quote.subject}</div>
                    </div>
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
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
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">{quote.customerName}</div>
                  <div className="flex justify-between items-end">
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
            totalItems={filteredQuotes.length}
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
    </div>
  );
}
