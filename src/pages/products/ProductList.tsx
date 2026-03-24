import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, Search, Edit, Trash2, MoreVertical, Upload, Download,
  Settings, Package, TrendingUp, Layers, X, Copy, ArrowUpDown, ArrowUp, ArrowDown, FolderOpen
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { collection, query, onSnapshot, doc, deleteDoc, orderBy, writeBatch, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import Spinner from '../../components/Spinner';
import ConfirmModal from '../../components/ConfirmModal';
import Pagination from '../../components/Pagination';
import { ITEMS_PER_PAGE } from '../../config/constants';
import { importCsvToFirestore, downloadCsvWithBom } from '../../lib/csv';
import { useOutsideClick } from '../../hooks/useOutsideClick';
import GroupManageModal from '../../components/GroupManageModal';
import type { Product, ProductGroup } from '../../types/models';

export default function ProductList() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
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

  type SortColumn = 'code' | 'name' | 'manufacturer' | 'tags' | 'price' | 'stock' | null;
  type SortDirection = 'asc' | 'desc';
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);

  useOutsideClick([
    { selector: ['.dropdown-container', '.dropdown-trigger'], onOutside: () => setOpenDropdownId(null) },
    { selector: '.settings-dropdown-container', onOutside: () => setIsSettingsOpen(false) },
  ]);

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[]);
      setLoading(false);
    }, () => {
      setError('商品の取得に失敗しました');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q2 = query(collection(db, 'productGroups'), orderBy('order', 'asc'));
    const unsub = onSnapshot(q2, (snap) => {
      setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() })) as ProductGroup[]);
    });
    return () => unsub();
  }, []);

  const tags = useMemo(() => {
    const allTags = new Set<string>();
    products.forEach(p => p.tags?.forEach(t => allTags.add(t)));
    return Array.from(allTags).sort();
  }, [products]);

  const filteredProducts = useMemo(() => products.filter(p => {
    const matchSearch = search ? p.name.toLowerCase().includes(search.toLowerCase()) : true;
    const matchManufacturer = manufacturer ? (p.manufacturer || '').toLowerCase().includes(manufacturer.toLowerCase()) : true;
    const matchTag = selectedTag ? (p.tags || []).includes(selectedTag) : true;
    const matchGroup = selectedGroupId === 'all' ? true
      : selectedGroupId === 'ungrouped' ? (!p.groupId || p.groupId === '')
      : p.groupId === selectedGroupId;
    return matchSearch && matchManufacturer && matchTag && matchGroup;
  }), [products, search, manufacturer, selectedTag, selectedGroupId]);

  const sortedProducts = useMemo(() => {
    if (!sortColumn) return filteredProducts;
    
    return [...filteredProducts].sort((a, b) => {
      let aVal: any = a[sortColumn];
      let bVal: any = b[sortColumn];

      if (sortColumn === 'tags') {
        aVal = (a.tags || []).join(', ');
        bVal = (b.tags || []).join(', ');
      } else if (aVal === undefined || aVal === null) {
        aVal = '';
      } else if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
      }
      
      if (bVal === undefined || bVal === null) {
        bVal = '';
      } else if (typeof bVal === 'string') {
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredProducts, sortColumn, sortDirection]);

  const totalValue = useMemo(() => products.reduce((sum, p) => sum + p.price * p.stock, 0), [products]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [search, manufacturer, selectedTag, sortColumn, sortDirection, selectedGroupId]);

  const totalPages = Math.ceil(sortedProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = sortedProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const isFiltered = search || manufacturer || selectedTag;

  const allPageSelected = paginatedProducts.length > 0 && paginatedProducts.every(p => selectedIds.has(p.id));
  const somePageSelected = paginatedProducts.some(p => selectedIds.has(p.id));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = somePageSelected && !allPageSelected;
    }
  }, [somePageSelected, allPageSelected]);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allPageSelected) {
        paginatedProducts.forEach(p => next.delete(p.id));
      } else {
        paginatedProducts.forEach(p => next.add(p.id));
      }
      return next;
    });
  }, [allPageSelected, paginatedProducts]);

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
        ids.slice(i, i + CHUNK).forEach(id => batch.delete(doc(db, 'products', id)));
        await batch.commit();
      }
      toast.success(`${selectedIds.size}件の商品を削除しました`);
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
      const totalCount = await importCsvToFirestore(file, 'products', (row) => {
        const name = row['商品名'] || row['name'];
        const priceStr = row['単価'] || row['price'];
        const stockStr = row['在庫数'] || row['stock'];

        if (!name || priceStr === undefined || stockStr === undefined) return null;

        const price = Number(priceStr);
        const stock = Number(stockStr);

        if (isNaN(price) || isNaN(stock) || price < 0 || stock < 0 || price > 99_999_999) return null;

        return {
          code: row['商品コード'] || row['code'] || '',
          name,
          manufacturer: row['メーカー'] || row['manufacturer'] || '',
          price,
          stock,
          unit: row['単位'] || row['unit'] || '',
          tags: (row['タグ'] || row['tags'] || '').split(',').map((t: string) => t.trim()).filter(Boolean),
          note: row['備考'] || row['note'] || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

      if (totalCount > 0) {
        toast.success(`${totalCount}件の商品をインポートしました`, { id: 'import' });
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
    if (filteredProducts.length === 0) {
      toast.error('エクスポートするデータがありません');
      return;
    }
    try {
      downloadCsvWithBom(
        filteredProducts.map(p => ({
          '商品コード': p.code || '',
          '商品名': p.name,
          'メーカー': p.manufacturer || '',
          '単価': p.price,
          '在庫数': p.stock,
          '単位': p.unit || '',
          'タグ': p.tags ? p.tags.join(', ') : '',
          '備考': p.note || '',
        })),
        `products_${new Date().toISOString().split('T')[0]}.csv`
      );
      toast.success('CSVをエクスポートしました');
    } catch {
      toast.error('エクスポートに失敗しました');
    }
  };

  const handleCopy = async (product: Product) => {
    try {
      const { id, ...rest } = product;
      await addDoc(collection(db, 'products'), {
        ...rest,
        name: `${product.name} (コピー)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      toast.success('商品をコピーしました');
    } catch {
      toast.error('商品のコピーに失敗しました');
    } finally {
      setOpenDropdownId(null);
    }
  };

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

          <button
            onClick={() => setIsGroupModalOpen(true)}
            className="btn-secondary p-2"
            aria-label="グループ管理"
            title="グループ管理"
          >
            <FolderOpen className="w-4 h-4" />
          </button>

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

      {/* Group Tabs */}
      {groups.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setSelectedGroupId('all')}
            className={`shrink-0 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
              selectedGroupId === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            すべて
          </button>
          {groups.map(g => (
            <button
              key={g.id}
              onClick={() => setSelectedGroupId(g.id)}
              className={`shrink-0 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                selectedGroupId === g.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {g.name}
            </button>
          ))}
          <button
            onClick={() => setSelectedGroupId('ungrouped')}
            className={`shrink-0 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
              selectedGroupId === 'ungrouped'
                ? 'bg-gray-600 text-white shadow-sm'
                : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            未分類
          </button>
        </div>
      )
      }

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

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">{selectedIds.size}件選択中</span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-200 underline"
            >
              選択解除
            </button>
          </div>
          <button
            onClick={() => setBulkDeleteConfirm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
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
                    disabled={paginatedProducts.length === 0}
                    className={`w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:cursor-default transition-opacity duration-150 ${somePageSelected ? 'opacity-100' : 'opacity-0 group-hover/header:opacity-100'}`}
                  />
                </th>
                <th 
                  className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer group/th hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors select-none"
                  onClick={() => handleSort('code')}
                >
                  <div className="flex items-center gap-1.5">
                    コード
                    <SortIcon column="code" />
                  </div>
                </th>
                <th 
                  className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer group/th hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors select-none"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1.5">
                    商品名
                    <SortIcon column="name" />
                  </div>
                </th>
                <th 
                  className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer group/th hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors select-none"
                  onClick={() => handleSort('manufacturer')}
                >
                  <div className="flex items-center gap-1.5">
                    メーカー
                    <SortIcon column="manufacturer" />
                  </div>
                </th>
                <th 
                  className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer group/th hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors select-none"
                  onClick={() => handleSort('tags')}
                >
                  <div className="flex items-center gap-1.5">
                    タグ
                    <SortIcon column="tags" />
                  </div>
                </th>
                <th 
                  className="px-5 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer group/th hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors select-none"
                  onClick={() => handleSort('price')}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <SortIcon column="price" />
                    単価
                  </div>
                </th>
                <th 
                  className="px-5 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer group/th hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors select-none"
                  onClick={() => handleSort('stock')}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <SortIcon column="stock" />
                    在庫数
                  </div>
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider rounded-tr-xl">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <div className="flex justify-center">
                      <Spinner />
                    </div>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
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
                    className={`hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer group ${selectedIds.has(product.id) ? 'bg-indigo-50/60 dark:bg-indigo-950/30' : ''}`}
                    onClick={() => navigate(`/products/${product.id}`)}
                  >
                    <td className="pl-4 pr-2 py-3.5 whitespace-nowrap cursor-pointer" onClick={(e) => toggleSelect(product.id, e)}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(product.id)}
                        onChange={() => {}}
                        className={`w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer transition-opacity duration-150 ${selectedIds.has(product.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                      />
                    </td>
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
                              onClick={() => handleCopy(product)}
                              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                              role="menuitem"
                            >
                              <Copy className="w-4 h-4 text-gray-400" />
                              コピー
                            </button>
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
                  className={`p-4 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer relative ${selectedIds.has(product.id) ? 'bg-indigo-50/60 dark:bg-indigo-950/30' : ''}`}
                  onClick={() => navigate(`/products/${product.id}`)}
                >
                  <div className="flex justify-between items-start mb-1.5">
                    <div className="flex items-start gap-2.5 pr-8 flex-1 min-w-0">
                      <div
                        onClick={(e) => toggleSelect(product.id, e)}
                        className="pt-0.5 shrink-0 w-5 h-5 flex items-center justify-center"
                      >
                        {selectedIds.has(product.id) ? (
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
                      {product.code && <div className="text-xs text-gray-400 dark:text-gray-500 font-mono mb-0.5">{product.code}</div>}
                      <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{product.name}</div>
                      </div>
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
                              onClick={() => handleCopy(product)}
                              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                              role="menuitem"
                            >
                              <Copy className="w-4 h-4 text-gray-400" />
                              コピー
                            </button>
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
            itemsPerPage={ITEMS_PER_PAGE}
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

      <ConfirmModal
        isOpen={bulkDeleteConfirm}
        title="商品の一括削除"
        message={`選択した${selectedIds.size}件の商品を削除しますか？この操作は取り消せません。`}
        onConfirm={handleBulkDelete}
        onCancel={() => !isBulkDeleting && setBulkDeleteConfirm(false)}
      />

      <GroupManageModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
      />
    </div>
  );
}
