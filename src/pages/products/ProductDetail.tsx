import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { ArrowLeft, Edit, Trash2, Package, Tag, FileText, DollarSign, Boxes } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Spinner from '../../components/Spinner';
import ConfirmModal from '../../components/ConfirmModal';

type Product = {
  id: string;
  code: string | null;
  name: string;
  manufacturer: string | null;
  price: number;
  stock: number;
  unit: string | null;
  tags: string[];
  note: string | null;
};

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'products', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setProduct({ id: docSnap.id, ...docSnap.data() } as Product);
        } else {
          setError('商品が見つかりません');
        }
      } catch (err) {
        console.error("Firestore Error:", err);
        setError('商品の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteDoc(doc(db, 'products', id));
      toast.success('商品を削除しました');
      navigate('/products');
    } catch {
      toast.error('商品の削除に失敗しました');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-5">
        <p className="text-sm text-red-700 dark:text-red-400 font-medium">{error || '商品が見つかりません'}</p>
        <Link to="/products" className="mt-2 inline-block text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
          一覧に戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/products"
            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">商品詳細</h1>
            {product.code && (
              <p className="text-xs font-mono text-gray-400 dark:text-gray-500 mt-0.5">{product.code}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/products/${product.id}/edit`}
            className="btn-secondary"
          >
            <Edit className="w-4 h-4" />
            <span className="hidden sm:inline">編集</span>
          </Link>
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 active:bg-red-800 shadow-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">削除</span>
          </button>
        </div>
      </div>

      {/* Product name card */}
      <div className="card px-6 py-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
          <Package className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-snug">{product.name}</h2>
          {product.manufacturer && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{product.manufacturer}</p>
          )}
        </div>
      </div>

      {/* Price + Stock highlight row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card px-5 py-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">単価</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            ¥{product.price.toLocaleString()}
          </p>
        </div>
        <div className="card px-5 py-4">
          <div className="flex items-center gap-2 mb-1">
            <Boxes className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">在庫数</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {product.stock.toLocaleString()}
            {product.unit && <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">{product.unit}</span>}
          </p>
        </div>
      </div>

      {/* Details card */}
      <div className="card divide-y divide-gray-100 dark:divide-gray-700/60">
        {/* Tags */}
        <div className="px-6 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">タグ</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {product.tags && product.tags.length > 0 ? (
              product.tags.map((tag) => (
                <span key={tag} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                  {tag}
                </span>
              ))
            ) : (
              <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
            )}
          </div>
        </div>

        {/* Note */}
        <div className="px-6 py-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">備考</span>
          </div>
          {product.note ? (
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{product.note}</p>
          ) : (
            <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="商品の削除"
        message="本当にこの商品を削除しますか？この操作は取り消せません。"
        onConfirm={handleDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
      />
    </div>
  );
}
