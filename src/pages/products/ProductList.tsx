import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, Search, Edit, Trash2, MoreVertical, Upload, Download,
  Settings, Package, TrendingUp, Layers, X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { collection, query, onSnapshot, doc, deleteDoc, orderBy, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import Spinner from '../../components/Spinner';
import ConfirmModal from '../../components/ConfirmModal';
import Pagination from '../../components/Pagination';
import Papa from 'papaparse';
import { ITEMS_PER_PAGE, BATCH_COMMIT_SIZE } from '../../config/constants';

type Product = {
  id: string;
  code: string | null;
  name: string;
  manufacturer: string | null;
  price: number;
  stock: number;
  unit: string | null;
  tags: string[];
  note?: string;
};

export default function ProductList() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = ITEMS_PER_PAGE;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
            const name = row['商品名'] || row['name'];
            const priceStr = row['単価'] || row['price'];
            const stockStr = row['在庫数'] || row['stock'];

            if (!name || priceStr === undefined || stockStr === undefined) {
              continue;
            }

            const price = Number(priceStr);
            const stock = Number(stockStr);

            if (isNaN(price) || isNaN(stock) || price < 0 || stock < 0 || price > 99_999_999) {
              continue;
            }

            const newDocRef = doc(collection(db, 'products'));
            batch.set(newDocRef, {
              code: row['商品コード'] || row['code'] || '',
              name: name,
              manufacturer: row['メーカー'] || row['manufacturer'] || '',
              price: price,
              stock: stock,
              unit: row['単位'] || row['unit'] || '',
              tags: (row['タグ'] || row['tags'] || '').split(',').map((t: string) => t.trim()).filter(Boolean),
              note: row['備考'] || row['note'] || '',
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
            toast.success(`${totalCount}件の商品をインポートしました`, { id: 'import' });
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
    if (filteredProducts.length === 0) {
      toast.error('エクスポートするデータがありません');
      return;
    }

    try {
      const exportData = filteredProducts.map(p => ({
        '商品コード': p.code || '',
        '商品名': p.name,
        'メーカー': p.manufacturer || '',
        '単価': p.price,
        '在庫数': p.stock,
        '単位': p.unit || '',
        'タグ': p.tags ? p.tags.join(', ') : '',
        '備考': p.note || ''
      }));

      const csv = Papa.unparse(exportData);
      const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
      const blob = new Blob([bom, csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `products_${new Date().toISOString().split('T')[0]}.csv`);
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

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];

      setProducts(productsData);

      const allTags = new Set<string>();
      productsData.forEach(p => {
        if (p.tags) {
          p.tags.forEach(t => allTags.add(t));
        }
      });
      setTags(Array.from(allTags).sort());

      setLoading(false);
    }, () => {
      setError("商品の取得に失敗しました");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'products', deleteId));
      toast.success('商品を削除しました');
    } catch {
      toast.error('商品の削除に失敗しました');
    } finally {
      setDeleteId(null);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchSearch = search ? p.name.toLowerCase().includes(search.toLowerCase()) : true;
    const matchManufacturer = manufacturer ? (p.manufacturer || '').toLowerCase().includes(manufacturer.toLowerCase()) : true;
    const matchTag = selectedTag ? (p.tags || []).includes(selectedTag) : true;
    return matchSearch && matchManufacturer && matchTag;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [search, manufacturer, selectedTag]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalValue = products.reduce((sum, p) => sum + p.price * p.stock, 0);
  const isFiltered = search || manufacturer || selectedTag;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">商品マスタ</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            登録商品の一覧・管理
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
            to="/products/new"
            className="btn-primary flex-1 sm:flex-none"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">商品登録</span>
            <span className="sm:hidden">登録</span>
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="stat-card">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">登録商品数</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{products.length}<span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">件</span></p>
            </div>
          </div>
          <div className="stat-card">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">在庫総額</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">¥{totalValue.toLocaleString()}</p>
            </div>
          </div>
          <div className="stat-card col-span-2 sm:col-span-1">
            <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">タグ種類数</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{tags.length}<span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">種</span></p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="商品名で検索..."
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
          {/* Manufacturer */}
          <div className="sm:w-56 relative">
            <input
              type="text"
              placeholder="メーカーで絞り込み..."
              className="input-base pr-8"
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
            />
            {manufacturer && (
              <button
                onClick={() => setManufacturer('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {/* Tag */}
          <div className="sm:w-48">
            <select
              className="input-base"
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
            >
              <option value="">すべてのタグ</option>
              {tags.map((tag) => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Active filter chips */}
        {isFiltered && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">フィルター:</span>
            {search && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                名称: {search}
                <button onClick={() => setSearch('')} className="hover:text-indigo-900 dark:hover:text-indigo-100"><X className="w-3 h-3" /></button>
              </span>
            )}
            {manufacturer && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                メーカー: {manufacturer}
                <button onClick={() => setManufacturer('')} className="hover:text-indigo-900 dark:hover:text-indigo-100"><X className="w-3 h-3" /></button>
              </span>
            )}
            {selectedTag && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                タグ: {selectedTag}
                <button onClick={() => setSelectedTag('')} className="hover:text-indigo-900 dark:hover:text-indigo-100"><X className="w-3 h-3" /></button>
              </span>
            )}
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {filteredProducts.length}件 / 全{products.length}件
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-visible">
        {/* Desktop Table View */}
        <div className="hidden md:block">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider rounded-tl-xl">コード</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">商品名</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">メーカー</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">タグ</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">単価</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">在庫数</th>
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
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <Package className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {isFiltered ? '条件に合う商品が見つかりません' : '商品が登録されていません'}
                    </p>
                    {!isFiltered && (
                      <Link to="/products/new" className="mt-3 inline-block text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                        最初の商品を登録する →
                      </Link>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((product) => (
                  <tr
                    key={product.id}
                    className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/products/${product.id}`)}
                  >
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs text-gray-400 dark:text-gray-500 font-mono">{product.code || '—'}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">{product.name}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{product.manufacturer || '—'}</td>
                    <td className="px-5 py-3.5 text-sm">
                      <div className="flex flex-wrap gap-1">
                        {product.tags?.map((tag) => (
                          <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white text-right">
                      ¥{product.price.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 text-right">
                      {product.stock.toLocaleString()}{product.unit ? <span className="text-xs text-gray-400 ml-1">{product.unit}</span> : ''}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-right text-sm relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setOpenDropdownId(openDropdownId === product.id ? null : product.id)}
                        className="dropdown-trigger text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {openDropdownId === product.id && (
                        <div className="dropdown-container absolute right-8 top-10 w-44 rounded-xl shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black/5 z-50 border border-gray-200 dark:border-gray-700 overflow-hidden">
                          <div className="py-1" role="menu">
                            <Link
                              to={`/products/${product.id}/edit`}
                              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                              role="menuitem"
                              onClick={() => setOpenDropdownId(null)}
                            >
                              <Edit className="w-4 h-4 text-gray-400" />
                              編集
                            </Link>
                            <button
                              onClick={() => { setDeleteId(product.id); setOpenDropdownId(null); }}
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
          ) : filteredProducts.length === 0 ? (
            <div className="p-10 text-center">
              <Package className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {isFiltered ? '条件に合う商品が見つかりません' : '商品が登録されていません'}
              </p>
              {!isFiltered && (
                <Link to="/products/new" className="mt-3 inline-block text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                  最初の商品を登録する →
                </Link>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {paginatedProducts.map((product) => (
                <div
                  key={product.id}
                  className="p-4 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer relative"
                  onClick={() => navigate(`/products/${product.id}`)}
                >
                  <div className="flex justify-between items-start mb-1.5">
                    <div className="pr-8 flex-1 min-w-0">
                      {product.code && <div className="text-xs text-gray-400 dark:text-gray-500 font-mono mb-0.5">{product.code}</div>}
                      <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{product.name}</div>
                    </div>
                    <div className="absolute top-4 right-4" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setOpenDropdownId(openDropdownId === product.id ? null : product.id)}
                        className="dropdown-trigger text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {openDropdownId === product.id && (
                        <div className="dropdown-container absolute right-0 top-8 w-44 rounded-xl shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black/5 z-50 border border-gray-200 dark:border-gray-700 overflow-hidden">
                          <div className="py-1" role="menu">
                            <Link
                              to={`/products/${product.id}/edit`}
                              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                              role="menuitem"
                              onClick={() => setOpenDropdownId(null)}
                            >
                              <Edit className="w-4 h-4 text-gray-400" />
                              編集
                            </Link>
                            <button
                              onClick={() => { setDeleteId(product.id); setOpenDropdownId(null); }}
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
                  {product.manufacturer && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">{product.manufacturer}</div>
                  )}
                  <div className="flex justify-between items-end mt-2">
                    <div className="flex flex-wrap gap-1 max-w-[55%]">
                      {product.tags?.map((tag) => (
                        <span key={tag} className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">¥{product.price.toLocaleString()}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">在庫: {product.stock.toLocaleString()} {product.unit || ''}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {!loading && filteredProducts.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredProducts.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      <ConfirmModal
        isOpen={deleteId !== null}
        title="商品の削除"
        message="本当にこの商品を削除しますか？この操作は取り消せません。"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
