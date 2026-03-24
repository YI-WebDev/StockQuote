import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, MoreVertical, Upload, Download, Settings } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { collection, query, onSnapshot, doc, deleteDoc, orderBy, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import Spinner from '../../components/Spinner';
import ConfirmModal from '../../components/ConfirmModal';
import Pagination from '../../components/Pagination';
import Papa from 'papaparse';

type Product = {
  id: string;
  code: string | null;
  name: string;
  manufacturer: string | null;
  price: number;
  stock: number;
  unit: string | null;
  tags: string[];
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
  const itemsPerPage = 10;
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

          for (const row of results.data as any[]) {
            const name = row['商品名'] || row['name'];
            const priceStr = row['単価'] || row['price'];
            const stockStr = row['在庫数'] || row['stock'];
            
            if (!name || priceStr === undefined || stockStr === undefined) {
              continue;
            }

            const price = Number(priceStr);
            const stock = Number(stockStr);

            if (isNaN(price) || isNaN(stock)) {
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

            if (count === 490) {
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
        } catch (error) {
          console.error('Import error:', error);
          toast.error('インポート中にエラーが発生しました', { id: 'import' });
        } finally {
          setIsImporting(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      },
      error: (error) => {
        console.error('Parse error:', error);
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
        '備考': (p as any).note || ''
      }));

      const csv = Papa.unparse(exportData);
      
      // BOMを追加してExcelでの文字化けを防ぐ
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
    } catch (error) {
      console.error('Export error:', error);
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
      
      // Extract unique tags
      const allTags = new Set<string>();
      productsData.forEach(p => {
        if (p.tags) {
          p.tags.forEach(t => allTags.add(t));
        }
      });
      setTags(Array.from(allTags).sort());
      
      setLoading(false);
    }, (err) => {
      console.error("Firestore Error:", err);
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
    } catch (err: any) {
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

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, manufacturer, selectedTag]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">商品マスタ</h1>
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
            to="/products/new"
            className="flex-1 sm:flex-none inline-flex justify-center items-center px-3 sm:px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">商品登録</span>
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-wrap gap-4 transition-colors">
        <div className="flex-1 min-w-[200px] relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="商品名で検索..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="メーカーで絞り込み..."
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-64">
          <select
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
          >
            <option value="">すべてのタグ</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-visible transition-colors">
        {/* Desktop Table View */}
        <div className="hidden md:block">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider rounded-tl-lg">コード</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">商品名</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">メーカー</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">タグ</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">単価</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">在庫数</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider rounded-tr-lg">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex justify-center">
                      <Spinner />
                    </div>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    商品が見つかりません
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((product) => (
                  <tr 
                    key={product.id} 
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/products/${product.id}`)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 group-last:rounded-bl-lg">{product.code || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{product.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{product.manufacturer || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex flex-wrap gap-1">
                        {product.tags?.map((tag) => (
                          <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">
                      ¥{product.price.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">
                      {product.stock.toLocaleString()} {product.unit || ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium relative group-last:rounded-br-lg" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setOpenDropdownId(openDropdownId === product.id ? null : product.id)}
                        className="dropdown-trigger text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>
                      
                      {openDropdownId === product.id && (
                        <div 
                          className="dropdown-container absolute right-8 top-10 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-50 border border-gray-200 dark:border-gray-700"
                        >
                          <div className="py-1" role="menu" aria-orientation="vertical">
                            <Link
                              to={`/products/${product.id}/edit`}
                              className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              role="menuitem"
                              onClick={() => setOpenDropdownId(null)}
                            >
                              <Edit className="w-4 h-4 mr-3 text-gray-400" />
                              編集
                            </Link>
                            <button
                              onClick={() => {
                                setDeleteId(product.id);
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
          ) : filteredProducts.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
              商品が見つかりません
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedProducts.map((product) => (
                <div 
                  key={product.id}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer relative"
                  onClick={() => navigate(`/products/${product.id}`)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="pr-8">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{product.code || '-'}</div>
                      <div className="text-base font-medium text-gray-900 dark:text-white">{product.name}</div>
                    </div>
                    <div className="absolute top-4 right-4" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setOpenDropdownId(openDropdownId === product.id ? null : product.id)}
                        className="dropdown-trigger text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>
                      
                      {openDropdownId === product.id && (
                        <div 
                          className="dropdown-container absolute right-0 top-8 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-50 border border-gray-200 dark:border-gray-700"
                        >
                          <div className="py-1" role="menu" aria-orientation="vertical">
                            <Link
                              to={`/products/${product.id}/edit`}
                              className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              role="menuitem"
                              onClick={() => setOpenDropdownId(null)}
                            >
                              <Edit className="w-4 h-4 mr-3 text-gray-400" />
                              編集
                            </Link>
                            <button
                              onClick={() => {
                                setDeleteId(product.id);
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
                    {product.manufacturer || '-'}
                  </div>
                  <div className="flex justify-between items-end mt-2">
                    <div className="flex flex-wrap gap-1 max-w-[60%]">
                      {product.tags?.map((tag) => (
                        <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">¥{product.price.toLocaleString()}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">在庫: {product.stock.toLocaleString()} {product.unit || ''}</div>
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
