import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { doc, getDoc, updateDoc, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import ProductForm from './ProductForm';
import { ProductFormValues } from '../../lib/validations';
import Spinner from '../../components/Spinner';
import { ArrowLeft, Edit } from 'lucide-react';
import type { ProductGroup } from '../../types/models';

export default function ProductEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<Partial<ProductFormValues> | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [groups, setGroups] = useState<ProductGroup[]>([]);

  useEffect(() => {
    getDocs(query(collection(db, 'productGroups'), orderBy('order', 'asc')))
      .then(snap => setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() })) as ProductGroup[]))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'products', id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) throw new Error('商品の取得に失敗しました');
        const data = docSnap.data();
        setCreatedAt(data.createdAt);
        setInitialData({
          code: data.code || '',
          name: data.name,
          manufacturer: data.manufacturer || '',
          price: data.price,
          stock: data.stock,
          unit: data.unit || '',
          note: data.note || '',
          tags: data.tags || [],
          groupId: data.groupId || '',
        });
      } catch (err: any) {
        console.error("Firestore Error:", err);
        toast.error('商品の取得に失敗しました');
        setError('商品の取得に失敗しました');
      }
    };
    fetchProduct();
  }, [id]);

  const handleSubmit = async (data: ProductFormValues) => {
    if (!id) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const docRef = doc(db, 'products', id);
      await updateDoc(docRef, {
        ...data,
        createdAt: createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      toast.success('商品を更新しました');
      navigate('/products');
    } catch (err: any) {
      console.error("Firestore Error:", err);
      toast.error('商品の更新に失敗しました');
      setError('商品の更新に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (error && !initialData) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-5">
          <p className="text-sm text-red-700 dark:text-red-400 font-medium">{error}</p>
          <Link to="/products" className="mt-2 inline-block text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
            一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  if (!initialData) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner label="読み込み中..." />
      </div>
    );
  }

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
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
            <Edit className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="page-title">商品編集</h1>
            <p className="page-subtitle">商品情報を更新します</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <ProductForm defaultValues={initialData} onSubmit={handleSubmit} isSubmitting={isSubmitting} groups={groups} />
    </div>
  );
}
