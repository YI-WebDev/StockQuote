import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Printer, Download, FileSpreadsheet } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import Spinner from '../../components/Spinner';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

type QuoteDetail = {
  id: string;
  quoteNumber: string;
  subject: string;
  customerName: string;
  issueDate: string;
  expiryDate: string | null;
  note: string | null;
  subtotal: number;
  tax: number;
  total: number;
  items: {
    productId: string;
    productName: string;
    manufacturer: string | null;
    price: number;
    quantity: number;
    amount: number;
  }[];
};

export default function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuote = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'quotes', id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) throw new Error('見積の取得に失敗しました');
        setQuote({ id: docSnap.id, ...docSnap.data() } as QuoteDetail);
      } catch (err: any) {
        console.error("Firestore Error:", err);
        toast.error('見積の取得に失敗しました');
        setError('見積の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    fetchQuote();
  }, [id]);

  const handlePdfDownload = async () => {
    const element = document.getElementById('quote-document');
    if (!element || !quote) return;
    
    toast.loading('PDFを生成中...', { id: 'pdf-loading' });
    try {
      // 一時的にダークモードを解除して白背景でキャプチャする
      const isDark = document.documentElement.classList.contains('dark');
      if (isDark) {
        document.documentElement.classList.remove('dark');
        await new Promise(resolve => setTimeout(resolve, 100)); // スタイル適用待ち
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      if (isDark) {
        document.documentElement.classList.add('dark');
      }
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`quote_${quote.quoteNumber}.pdf`);
      
      toast.success('PDFをダウンロードしました', { id: 'pdf-loading' });
    } catch (error) {
      console.error(error);
      toast.error('PDFの生成に失敗しました', { id: 'pdf-loading' });
    }
  };

  const handleExcelDownload = async () => {
    if (!quote) return;
    toast.loading('Excelを生成中...', { id: 'excel-loading' });
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("見積書");

      worksheet.columns = [
        { header: "商品名", key: "productName", width: 30 },
        { header: "メーカー", key: "manufacturer", width: 20 },
        { header: "単価", key: "price", width: 15 },
        { header: "数量", key: "quantity", width: 10 },
        { header: "金額", key: "amount", width: 15 },
      ];

      worksheet.insertRow(1, ["見積書"]);
      worksheet.insertRow(2, [`見積番号: ${quote.quoteNumber}`]);
      worksheet.insertRow(3, [`件名: ${quote.subject}`]);
      worksheet.insertRow(4, [`宛名: ${quote.customerName} 御中`]);
      worksheet.insertRow(5, []);

      worksheet.getRow(6).values = ["商品名", "メーカー", "単価", "数量", "金額"];

      quote.items.forEach((item) => {
        worksheet.addRow({
          productName: item.productName,
          manufacturer: item.manufacturer || "",
          price: item.price,
          quantity: item.quantity,
          amount: item.amount,
        });
      });

      worksheet.addRow([]);
      worksheet.addRow(["", "", "", "小計", quote.subtotal]);
      worksheet.addRow(["", "", "", "消費税(10%)", quote.tax]);
      worksheet.addRow(["", "", "", "合計", quote.total]);

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(blob, `quote_${quote.quoteNumber}.xlsx`);
      toast.success('Excelをダウンロードしました', { id: 'excel-loading' });
    } catch (error) {
      console.error(error);
      toast.error('Excelの生成に失敗しました', { id: 'excel-loading' });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner />
      </div>
    );
  }
  if (error || !quote) return <div className="text-red-600 dark:text-red-400">{error || 'Quote not found'}</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <button
          onClick={() => navigate('/quotes')}
          className="inline-flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          戻る
        </button>
        <div className="space-x-3 flex">
          <button
            onClick={handleExcelDownload}
            className="inline-flex items-center px-4 py-2 border border-green-600 dark:border-green-500 shadow-sm text-sm font-medium rounded-md text-green-700 dark:text-green-400 bg-white dark:bg-gray-800 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Excel
          </button>
          <button
            onClick={handlePdfDownload}
            className="inline-flex items-center px-4 py-2 border border-red-600 dark:border-red-500 shadow-sm text-sm font-medium rounded-md text-red-700 dark:text-red-400 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            PDF
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Printer className="w-4 h-4 mr-2" />
            印刷
          </button>
          <Link
            to={`/quotes/${quote.id}/edit`}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
          >
            <Edit className="w-4 h-4 mr-2" />
            編集
          </Link>
        </div>
      </div>

      <div id="quote-document" className="bg-white dark:bg-gray-800 p-10 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 print:shadow-none print:border-none print:p-0 print:bg-white transition-colors">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white print:text-gray-900 tracking-wider">御 見 積 書</h1>
        </div>

        <div className="flex justify-between mb-8">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white print:text-gray-900 border-b border-gray-900 dark:border-gray-100 print:border-gray-900 pb-1 mb-4 inline-block min-w-[200px]">
              {quote.customerName} 御中
            </h2>
            <div className="mt-4 space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600">
                <span className="inline-block w-20">件名:</span>
                <span className="font-medium text-gray-900 dark:text-white print:text-gray-900">{quote.subject}</span>
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600">
                <span className="inline-block w-20">有効期限:</span>
                <span className="text-gray-900 dark:text-white print:text-gray-900">
                  {quote.expiryDate ? new Date(quote.expiryDate).toLocaleDateString('ja-JP') : '設定なし'}
                </span>
              </p>
            </div>
          </div>
          <div className="text-right space-y-1">
            <p className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600">
              見積番号: <span className="font-medium text-gray-900 dark:text-white print:text-gray-900">{quote.quoteNumber}</span>
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600">
              作成日: <span className="text-gray-900 dark:text-white print:text-gray-900">{new Date(quote.issueDate).toLocaleDateString('ja-JP')}</span>
            </p>
          </div>
        </div>

        <div className="mb-8">
          <p className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600 mb-2">下記の通り御見積申し上げます。</p>
          <div className="text-2xl font-bold text-gray-900 dark:text-white print:text-gray-900 border-b-2 border-gray-900 dark:border-gray-100 print:border-gray-900 pb-2 inline-block">
            御見積合計金額: ¥{quote.total.toLocaleString()} <span className="text-sm font-normal text-gray-600 dark:text-gray-400 print:text-gray-600">(税込)</span>
          </div>
        </div>

        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 print:divide-gray-200 border border-gray-200 dark:border-gray-700 print:border-gray-200 mb-8">
          <thead className="bg-gray-50 dark:bg-gray-900/50 print:bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 print:text-gray-500 uppercase tracking-wider border-r dark:border-gray-700 print:border-gray-200">商品名</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 print:text-gray-500 uppercase tracking-wider border-r dark:border-gray-700 print:border-gray-200">メーカー</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 print:text-gray-500 uppercase tracking-wider border-r dark:border-gray-700 print:border-gray-200">単価</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 print:text-gray-500 uppercase tracking-wider border-r dark:border-gray-700 print:border-gray-200">数量</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 print:text-gray-500 uppercase tracking-wider">金額</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 print:bg-white divide-y divide-gray-200 dark:divide-gray-700 print:divide-gray-200">
            {quote.items.map((item, index) => (
              <tr key={index}>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-white print:text-gray-900 border-r dark:border-gray-700 print:border-gray-200">{item.productName}</td>
                <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 print:text-gray-500 border-r dark:border-gray-700 print:border-gray-200">{item.manufacturer || '-'}</td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-white print:text-gray-900 text-right border-r dark:border-gray-700 print:border-gray-200">¥{item.price.toLocaleString()}</td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-white print:text-gray-900 text-right border-r dark:border-gray-700 print:border-gray-200">{item.quantity.toLocaleString()}</td>
                <td className="px-4 py-2 text-sm text-gray-900 dark:text-white print:text-gray-900 text-right">¥{item.amount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mb-8">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400 print:text-gray-600">小計</span>
              <span className="text-gray-900 dark:text-white print:text-gray-900">¥{quote.subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400 print:text-gray-600">消費税 (10%)</span>
              <span className="text-gray-900 dark:text-white print:text-gray-900">¥{quote.tax.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-base font-bold border-t border-gray-200 dark:border-gray-700 print:border-gray-200 pt-2">
              <span className="text-gray-900 dark:text-white print:text-gray-900">合計</span>
              <span className="text-gray-900 dark:text-white print:text-gray-900">¥{quote.total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {quote.note && (
          <div className="border-t border-gray-200 dark:border-gray-700 print:border-gray-200 pt-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 print:text-gray-700 mb-2">備考</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600 whitespace-pre-wrap">{quote.note}</p>
          </div>
        )}
      </div>
    </div>
  );
}
