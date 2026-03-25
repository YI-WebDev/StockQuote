import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { collection, addDoc, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import ProductForm from './ProductForm';
import { ProductFormValues } from '../../lib/validations';
import { ArrowLeft, Plus } from 'lucide-react';
import type { ProductGroup } from '../../types/models';

export default function ProductCreate() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<ProductGroup[]>([]);

  useEffect(() => {
    getDocs(query(collection(db, 'productGroups'), orderBy('order', 'asc')))
      .then(snap => setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() })) as ProductGroup[]))
      .catch(() => {});
  }, []);

  const handleSubmit = async (data: ProductFormValues) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await addDoc(collection(db, 'products'), {
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      toast.success('商品を登録しました');
      navigate('/products');
    } catch (err: any) {
      console.error("Firestore Error:", err);
      toast.error('商品の登録に失敗しました');
      setError('商品の登録に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/products"
          className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-150"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
            <Plus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="page-title">商品登録</h1>
            <p className="page-subtitle">新しい商品を登録します</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <ProductForm onSubmit={handleSubmit} isSubmitting={isSubmitting} groups={groups} />
    </div>
  );
}
