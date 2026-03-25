import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import QuoteForm from './QuoteForm';
import { QuoteFormValues } from '../../lib/validations';
import Spinner from '../../components/Spinner';
import { ArrowLeft, Edit } from 'lucide-react';

export default function QuoteEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<Partial<QuoteFormValues> | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuote = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'quotes', id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) throw new Error('見積の取得に失敗しました');
        const data = docSnap.data();
        setCreatedAt(data.createdAt);

        setInitialData({
          quoteNumber: data.quoteNumber,
          subject: data.subject,
          customerName: data.customerName,
          issueDate: new Date(data.issueDate).toISOString().split('T')[0],
          expiryDate: data.expiryDate ? new Date(data.expiryDate).toISOString().split('T')[0] : '',
          note: data.note || '',
          subtotal: data.subtotal,
          tax: data.tax,
          total: data.total,
          items: data.items.map((item: any) => ({
            productId: item.productId,
            productName: item.productName,
            manufacturer: item.manufacturer || '',
            price: item.price,
            quantity: item.quantity,
            amount: item.amount,
          })),
        });
      } catch (err: any) {
        console.error("Firestore Error:", err);
        toast.error('見積の取得に失敗しました');
        setError('見積の取得に失敗しました');
      }
    };
    fetchQuote();
  }, [id]);

  const handleSubmit = async (data: QuoteFormValues) => {
    if (!id) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const docRef = doc(db, 'quotes', id);
      await updateDoc(docRef, {
        ...data,
        createdAt: createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      toast.success('見積を更新しました');
      navigate(`/quotes/${id}`);
    } catch (err: any) {
      console.error("Firestore Error:", err);
      toast.error('見積の更新に失敗しました');
      setError('見積の更新に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (error && !initialData) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-5">
          <p className="text-sm text-red-700 dark:text-red-400 font-medium">{error}</p>
          <Link to="/quotes" className="mt-2 inline-block text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
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
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/quotes"
          className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-150"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
            <Edit className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="page-title">見積編集</h1>
            <p className="page-subtitle">見積書を更新します</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <QuoteForm defaultValues={initialData} onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </div>
  );
}
