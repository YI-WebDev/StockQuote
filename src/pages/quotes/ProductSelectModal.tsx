import { useState, useEffect } from 'react';
import { Search, X, Package } from 'lucide-react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import Spinner from '../../components/Spinner';

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

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (product: Product) => void;
};

export default function ProductSelectModal({ isOpen, onClose, onSelect }: Props) {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    const q = query(collection(db, 'products'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setAllProducts(productsData);
      setLoading(false);
    }, () => {
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
    }
  }, [isOpen]);

  const products = search
    ? allProducts.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : allProducts;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="product-select-title">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
              <Package className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 id="product-select-title" className="text-base font-semibold text-gray-900 dark:text-white">商品を選択</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="商品名で検索..."
              className="input-base pl-10 pr-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
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
              {products.length}件の商品が見つかりました
            </p>
          )}
        </div>

        {/* Product list */}
        <div className="flex-1 overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-700/60">
            <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0">
              <tr>
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">商品名</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">メーカー</th>
                <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">タグ</th>
                <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">単価</th>
                <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">在庫</th>
                <th className="px-5 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <div className="flex justify-center">
                      <Spinner />
                    </div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center">
                    <Package className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">商品が見つかりません</p>
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors">
                    <td className="px-5 py-2.5 text-sm font-medium text-gray-900 dark:text-white">{product.name}</td>
                    <td className="px-5 py-2.5 text-sm text-gray-500 dark:text-gray-400">{product.manufacturer || '-'}</td>
                    <td className="px-5 py-2.5 text-sm">
                      <div className="flex flex-wrap gap-1">
                        {product.tags?.map((tag, i) => (
                          <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-2.5 text-sm font-medium text-gray-900 dark:text-white text-right">¥{product.price.toLocaleString()}</td>
                    <td className="px-5 py-2.5 text-sm text-gray-500 dark:text-gray-400 text-right">{product.stock}</td>
                    <td className="px-5 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(product);
                          onClose();
                        }}
                        className="btn-primary px-3 py-1.5 text-xs"
                      >
                        選択
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center shrink-0">
          <span className="text-xs text-gray-500 dark:text-gray-400">{allProducts.length}件の商品</span>
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={onClose}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
