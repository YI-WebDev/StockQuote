import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, Eye, Upload, Download, Settings, MoreVertical } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { collection, query, onSnapshot, doc, deleteDoc, orderBy, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import Spinner from '../../components/Spinner';
import ConfirmModal from '../../components/ConfirmModal';
import Pagination from '../../components/Pagination';
import Papa from 'papaparse';
import { ITEMS_PER_PAGE, BATCH_COMMIT_SIZE } from '../../config/constants';

type Quote = {
  id: string;
  quoteNumber: string;
  subject: string;
  customerName: string;
  issueDate: string;
  expiryDate: string | null;
  subtotal: number;
  tax: number;
  total: number;
  note: string | null;
};

function generateQuoteNumber(): string {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const randomPart = Array.from(crypto.getRandomValues(new Uint8Array(3)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
    .slice(0, 4);
  return `EST-${datePart}-${randomPart}`;
}

export default function QuoteList() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = ITEMS_PER_PAGE;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-container') && !target.closest('.dropdown-trigger')) {
        setOpenDropdownId(null);
      }
      if (!target.closest('.settings-dropdown-container')) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    toast.loading('インポート中...', { id: 'import' });

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          let batch = writeBatch(db);
          let count = 0;
          let totalCount = 0;

          for (const row of results.data as Record<string, string>[]) {
            const quoteNumber = row['見積番号'] || row['quoteNumber'];
            const subject = row['件名'] || row['subject'];
            const customerName = row['宛名'] || row['customerName'];
            
            if (!subject || !customerName) {
              continue;
            }

            const newDocRef = doc(collection(db, 'quotes'));
            batch.set(newDocRef, {
              quoteNumber: quoteNumber || generateQuoteNumber(),
              subject: subject,
              customerName: customerName,
              issueDate: row['発行日'] || row['issueDate'] || new Date().toISOString().split('T')[0],
              expiryDate: row['有効期限'] || row['expiryDate'] || '',
              subtotal: Number(row['小計'] || row['subtotal']) || 0,
              tax: Number(row['消費税'] || row['tax']) || 0,
              total: Number(row['合計'] || row['total']) || 0,
              note: row['備考'] || row['note'] || '',
              items: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
            
            count++;
            totalCount++;

            if (count === BATCH_COMMIT_SIZE) {
              await batch.commit();
              batch = writeBatch(db);
              count = 0;
            }
          }

          if (count > 0) {
            await batch.commit();
          }
          
          if (totalCount > 0) {
            toast.success(`${totalCount}件の見積をインポートしました`, { id: 'import' });
          } else {
            toast.error('有効なデータが見つかりませんでした', { id: 'import' });
          }
        } catch {
          toast.error('インポート中にエラーが発生しました', { id: 'import' });
        } finally {
          setIsImporting(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      },
      error: () => {
        toast.error('CSVの読み込みに失敗しました', { id: 'import' });
        setIsImporting(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    });
  };

  const handleExportClick = () => {
    if (filteredQuotes.length === 0) {
      toast.error('エクスポートするデータがありません');
      return;
    }

    try {
      const exportData = filteredQuotes.map(q => ({
        '見積番号': q.quoteNumber || '',
        '件名': q.subject || '',
        '宛名': q.customerName || '',
        '発行日': q.issueDate || '',
        '有効期限': q.expiryDate || '',
        '小計': q.subtotal || 0,
        '消費税': q.tax || 0,
        '合計': q.total || 0,
        '備考': q.note || ''
      }));

      const csv = Papa.unparse(exportData);
      
      const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
      const blob = new Blob([bom, csv], { type: 'text/csv;charset=utf-8;' });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `quotes_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('CSVをエクスポートしました');
    } catch {
      toast.error('エクスポートに失敗しました');
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'quotes'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const quotesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Quote[];
      setQuotes(quotesData);
      setLoading(false);
    }, () => {
      setError("見積の取得に失敗しました");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'quotes', deleteId));
      toast.success('見積を削除しました');
    } catch (err: any) {
      toast.error('見積の削除に失敗しました');
    } finally {
      setDeleteId(null);
    }
  };

  const filteredQuotes = quotes.filter(q => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      q.quoteNumber.toLowerCase().includes(s) ||
      q.subject.toLowerCase().includes(s) ||
      q.customerName.toLowerCase().includes(s)
    );
  });

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const totalPages = Math.ceil(filteredQuotes.length / itemsPerPage);
  const paginatedQuotes = filteredQuotes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">見積管理</h1>
        <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          
          <div className="relative settings-dropdown-container">
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="inline-flex justify-center items-center p-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              aria-label="設定"
            >
              <Settings className="w-5 h-5" />
            </button>

            {isSettingsOpen && (
              <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-50 border border-gray-200 dark:border-gray-700">
                <div className="py-1" role="menu" aria-orientation="vertical">
                  <button
                    onClick={() => {
                      setIsSettingsOpen(false);
                      handleImportClick();
                    }}
                    disabled={isImporting}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    role="menuitem"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    CSVインポート
                  </button>
                  <button
                    onClick={() => {
                      setIsSettingsOpen(false);
                      handleExportClick();
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center transition-colors"
                    role="menuitem"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    CSVエクスポート
                  </button>
                </div>
              </div>
            )}
          </div>

          <Link
            to="/quotes/new"
            className="flex-1 sm:flex-none inline-flex justify-center items-center px-3 sm:px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">見積作成</span>
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="見積番号、件名、宛名で検索..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-400 p-4">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">見積番号</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">件名</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">宛名</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">作成日</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">合計金額</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex justify-center">
                      <Spinner />
                    </div>
                  </td>
                </tr>
              ) : filteredQuotes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    見積が見つかりません
                  </td>
                </tr>
              ) : (
                paginatedQuotes.map((quote) => (
                  <tr 
                    key={quote.id} 
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/quotes/${quote.id}`)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white group-last:rounded-bl-lg">{quote.quoteNumber}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{quote.subject}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{quote.customerName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(quote.issueDate).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">
                      ¥{quote.total.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium relative group-last:rounded-br-lg" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setOpenDropdownId(openDropdownId === quote.id ? null : quote.id)}
                        className="dropdown-trigger text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>
                      
                      {openDropdownId === quote.id && (
                        <div className="dropdown-container absolute right-8 top-10 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-50 border border-gray-200 dark:border-gray-700">
                          <div className="py-1" role="menu" aria-orientation="vertical">
                            <Link
                              to={`/quotes/${quote.id}`}
                              className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              role="menuitem"
                              onClick={() => setOpenDropdownId(null)}
                            >
                              <Eye className="w-4 h-4 mr-3 text-gray-400" />
                              詳細を見る
                            </Link>
                            <Link
                              to={`/quotes/${quote.id}/edit`}
                              className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              role="menuitem"
                              onClick={() => setOpenDropdownId(null)}
                            >
                              <Edit className="w-4 h-4 mr-3 text-gray-400" />
                              編集
                            </Link>
                            <button
                              onClick={() => {
                                setDeleteId(quote.id);
                                setOpenDropdownId(null);
                              }}
                              className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              role="menuitem"
                            >
                              <Trash2 className="w-4 h-4 mr-3 text-red-400" />
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
            <div className="p-8 text-center">
              <div className="flex justify-center">
                <Spinner />
              </div>
            </div>
          ) : filteredQuotes.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
              見積が見つかりません
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedQuotes.map((quote) => (
                <div 
                  key={quote.id} 
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer relative"
                  onClick={() => navigate(`/quotes/${quote.id}`)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{quote.quoteNumber}</div>
                      <div className="text-base font-medium text-gray-900 dark:text-white">{quote.subject}</div>
                    </div>
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setOpenDropdownId(openDropdownId === quote.id ? null : quote.id)}
                        className="dropdown-trigger text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>
                      
                      {openDropdownId === quote.id && (
                        <div className="dropdown-container absolute right-0 top-8 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-50 border border-gray-200 dark:border-gray-700">
                          <div className="py-1" role="menu" aria-orientation="vertical">
                            <Link
                              to={`/quotes/${quote.id}`}
                              className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              role="menuitem"
                              onClick={() => setOpenDropdownId(null)}
                            >
                              <Eye className="w-4 h-4 mr-3 text-gray-400" />
                              詳細を見る
                            </Link>
                            <Link
                              to={`/quotes/${quote.id}/edit`}
                              className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              role="menuitem"
                              onClick={() => setOpenDropdownId(null)}
                            >
                              <Edit className="w-4 h-4 mr-3 text-gray-400" />
                              編集
                            </Link>
                            <button
                              onClick={() => {
                                setDeleteId(quote.id);
                                setOpenDropdownId(null);
                              }}
                              className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              role="menuitem"
                            >
                              <Trash2 className="w-4 h-4 mr-3 text-red-400" />
                              削除
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                    {quote.customerName}
                  </div>
                  <div className="flex justify-between items-end mt-2">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      作成日: {new Date(quote.issueDate).toLocaleDateString('ja-JP')}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">¥{quote.total.toLocaleString()}</div>
                    </div>
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
            itemsPerPage={itemsPerPage}
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
