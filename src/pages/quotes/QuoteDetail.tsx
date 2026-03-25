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
import type { QuoteDetail } from '../../types/models';

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
      } catch {
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

    const isDark = document.documentElement.classList.contains('dark');

    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.backgroundColor = isDark ? '#111827' : '#ffffff';
    overlay.style.zIndex = '9999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.color = isDark ? '#ffffff' : '#111827';
    overlay.innerHTML = '<div style="font-size: 1.25rem; font-weight: bold;">PDFを生成中...</div>';
    document.body.appendChild(overlay);

    const originalWidth = element.style.width;
    const originalMaxWidth = element.style.maxWidth;
    const originalMargin = element.style.margin;

    try {
      if (isDark) {
        document.documentElement.classList.remove('dark');
      }

      element.style.width = '800px';
      element.style.maxWidth = '800px';
      element.style.margin = '0 auto';

      await new Promise(resolve => setTimeout(resolve, 200));

      const scale = 2;
      const canvas = await html2canvas(element, {
        scale,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfPageHeight = pdf.internal.pageSize.getHeight();

      const imgWidthPx = canvas.width;
      const imgHeightPx = canvas.height;
      const pdfImgHeight = (imgHeightPx * pdfWidth) / imgWidthPx;

      if (pdfImgHeight <= pdfPageHeight) {
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfImgHeight);
      } else {
        const pageCanvasHeight = Math.floor((pdfPageHeight * imgWidthPx) / pdfWidth);
        let remainingHeight = imgHeightPx;
        let srcY = 0;
        let page = 0;

        while (remainingHeight > 0) {
          const sliceHeight = Math.min(pageCanvasHeight, remainingHeight);
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = imgWidthPx;
          pageCanvas.height = sliceHeight;
          const ctx = pageCanvas.getContext('2d');
          if (!ctx) break;

          ctx.drawImage(canvas, 0, srcY, imgWidthPx, sliceHeight, 0, 0, imgWidthPx, sliceHeight);

          const pageImgData = pageCanvas.toDataURL('image/png');
          const slicePdfHeight = (sliceHeight * pdfWidth) / imgWidthPx;

          if (page > 0) pdf.addPage();
          pdf.addImage(pageImgData, 'PNG', 0, 0, pdfWidth, slicePdfHeight);

          srcY += sliceHeight;
          remainingHeight -= sliceHeight;
          page++;
        }
      }

      pdf.save(`quote_${quote.quoteNumber}.pdf`);
      toast.success('PDFをダウンロードしました', { id: 'pdf-loading' });
    } catch {
      toast.error('PDFの生成に失敗しました', { id: 'pdf-loading' });
    } finally {
      element.style.width = originalWidth;
      element.style.maxWidth = originalMaxWidth;
      element.style.margin = originalMargin;

      if (isDark) {
        document.documentElement.classList.add('dark');
      }
      if (overlay.parentNode) {
        document.body.removeChild(overlay);
      }
    }
  };

  const handleExcelDownload = async () => {
    if (!quote) return;
    toast.loading('Excelを生成中...', { id: 'excel-loading' });
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("見積書");

      worksheet.columns = [
        { key: "col1", width: 40 },
        { key: "col2", width: 20 },
        { key: "col3", width: 15 },
        { key: "col4", width: 10 },
        { key: "col5", width: 15 },
      ];

      worksheet.mergeCells('A2:E2');
      const titleCell = worksheet.getCell('A2');
      titleCell.value = "御 見 積 書";
      titleCell.font = { size: 20, bold: true, name: 'ＭＳ ゴシック' };
      titleCell.alignment = { horizontal: 'center' };

      worksheet.getCell('A4').value = `${quote.customerName} 御中`;
      worksheet.getCell('A4').font = { size: 14, bold: true, underline: true, name: 'ＭＳ ゴシック' };

      worksheet.getCell('D4').value = `見積番号: ${quote.quoteNumber}`;
      worksheet.getCell('D4').alignment = { horizontal: 'right' };

      worksheet.getCell('A5').value = `件名: ${quote.subject}`;
      worksheet.getCell('D5').value = `作成日: ${new Date(quote.issueDate).toLocaleDateString('ja-JP')}`;
      worksheet.getCell('D5').alignment = { horizontal: 'right' };

      worksheet.getCell('A6').value = `有効期限: ${quote.expiryDate ? new Date(quote.expiryDate).toLocaleDateString('ja-JP') : '設定なし'}`;

      worksheet.getCell('A8').value = "下記の通り御見積申し上げます。";

      worksheet.mergeCells('A9:C9');
      const totalAmountCell = worksheet.getCell('A9');
      totalAmountCell.value = `御見積合計金額: ¥${quote.total.toLocaleString()} (税込)`;
      totalAmountCell.font = { size: 16, bold: true, name: 'ＭＳ ゴシック' };
      totalAmountCell.border = { bottom: { style: 'medium' } };

      const headerRowIndex = 11;
      const headers = ["商品名", "メーカー", "単価", "数量", "金額"];
      headers.forEach((header, index) => {
        const cell = worksheet.getCell(headerRowIndex, index + 1);
        cell.value = header;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
        };
        cell.font = { bold: true };
        cell.alignment = { horizontal: index >= 2 ? 'right' : 'left', vertical: 'middle' };
      });

      let currentRowIndex = headerRowIndex + 1;
      quote.items.forEach((item) => {
        const row = worksheet.getRow(currentRowIndex);
        row.values = [item.productName, item.manufacturer || "", item.price, item.quantity, item.amount];

        for (let i = 1; i <= 5; i++) {
          const cell = row.getCell(i);
          cell.border = {
            top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
          };
          if (i >= 3) {
            cell.alignment = { horizontal: 'right' };
            cell.numFmt = '"¥"#,##0';
          }
        }
        currentRowIndex++;
      });

      currentRowIndex++;

      const summaryData = [
        { label: "小計", value: quote.subtotal },
        { label: "消費税 (10%)", value: quote.tax },
        { label: "合計", value: quote.total, bold: true }
      ];

      summaryData.forEach((data) => {
        const row = worksheet.getRow(currentRowIndex);
        row.getCell(4).value = data.label;
        row.getCell(5).value = data.value;

        row.getCell(4).alignment = { horizontal: 'left' };
        row.getCell(5).alignment = { horizontal: 'right' };
        row.getCell(5).numFmt = '"¥"#,##0';

        if (data.bold) {
          row.getCell(4).font = { bold: true };
          row.getCell(5).font = { bold: true };
          row.getCell(4).border = { top: { style: 'thin' } };
          row.getCell(5).border = { top: { style: 'thin' } };
        }

        currentRowIndex++;
      });

      if (quote.note) {
        currentRowIndex++;
        worksheet.mergeCells(currentRowIndex, 1, currentRowIndex, 5);
        const noteHeaderCell = worksheet.getCell(currentRowIndex, 1);
        noteHeaderCell.value = "備考";
        noteHeaderCell.font = { bold: true };
        noteHeaderCell.border = { top: { style: 'thin' } };

        currentRowIndex++;
        worksheet.mergeCells(currentRowIndex, 1, currentRowIndex + 3, 5);
        const noteCell = worksheet.getCell(currentRowIndex, 1);
        noteCell.value = quote.note;
        noteCell.alignment = { wrapText: true, vertical: 'top' };
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(blob, `quote_${quote.quoteNumber}.xlsx`);
      toast.success('Excelをダウンロードしました', { id: 'excel-loading' });
    } catch {
      toast.error('Excelの生成に失敗しました', { id: 'excel-loading' });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner label="読み込み中..." />
      </div>
    );
  }
  if (error || !quote) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-5">
          <p className="text-sm text-red-700 dark:text-red-400 font-medium">{error || '見積が見つかりません'}</p>
          <Link to="/quotes" className="mt-2 inline-block text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
            一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <button
          onClick={() => navigate('/quotes')}
          className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 p-2 -ml-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          見積一覧に戻る
        </button>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={handleExcelDownload}
            className="btn-secondary flex-1 sm:flex-none"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">Excel</span>
          </button>
          <button
            onClick={handlePdfDownload}
            className="btn-secondary flex-1 sm:flex-none"
          >
            <Download className="w-4 h-4 text-red-500 dark:text-red-400" />
            <span className="hidden sm:inline">PDF</span>
          </button>
          <button
            onClick={() => window.print()}
            className="btn-secondary flex-1 sm:flex-none"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">印刷</span>
          </button>
          <Link
            to={`/quotes/${quote.id}/edit`}
            className="btn-primary flex-1 sm:flex-none"
          >
            <Edit className="w-4 h-4" />
            <span className="hidden sm:inline">編集</span>
          </Link>
        </div>
      </div>

      {/* Quote Document */}
      <div id="quote-document" className="bg-white dark:bg-gray-800 p-8 sm:p-10 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 print:shadow-none print:border-none print:p-0 print:bg-white transition-colors">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white print:text-gray-900 tracking-wider">御 見 積 書</h1>
        </div>

        <div className="flex justify-between mb-8">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white print:text-gray-900 border-b-2 border-gray-900 dark:border-gray-100 print:border-gray-900 pb-1 mb-4 inline-block min-w-[200px]">
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
          <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white print:text-gray-900 border-b-2 border-gray-900 dark:border-gray-100 print:border-gray-900 pb-2 inline-block">
            御見積合計金額: ¥{quote.total.toLocaleString()} <span className="text-sm font-normal text-gray-600 dark:text-gray-400 print:text-gray-600">(税込)</span>
          </div>
        </div>

        <div className="overflow-x-auto mb-8">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 print:divide-gray-200 border border-gray-200 dark:border-gray-700 print:border-gray-200">
            <thead className="bg-gray-50 dark:bg-gray-900/50 print:bg-gray-50">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 print:text-gray-500 uppercase tracking-wider border-r dark:border-gray-700 print:border-gray-200">商品名</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 print:text-gray-500 uppercase tracking-wider border-r dark:border-gray-700 print:border-gray-200">メーカー</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 print:text-gray-500 uppercase tracking-wider border-r dark:border-gray-700 print:border-gray-200">単価</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 print:text-gray-500 uppercase tracking-wider border-r dark:border-gray-700 print:border-gray-200">数量</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 print:text-gray-500 uppercase tracking-wider">金額</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 print:bg-white divide-y divide-gray-200 dark:divide-gray-700 print:divide-gray-200">
            {quote.items.map((item, index) => (
              <tr key={`${item.productId ?? 'item'}-${index}`}>
                <td className="px-4 py-2.5 text-sm text-gray-900 dark:text-white print:text-gray-900 border-r dark:border-gray-700 print:border-gray-200">{item.productName}</td>
                <td className="px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400 print:text-gray-500 border-r dark:border-gray-700 print:border-gray-200">{item.manufacturer || '-'}</td>
                <td className="px-4 py-2.5 text-sm text-gray-900 dark:text-white print:text-gray-900 text-right border-r dark:border-gray-700 print:border-gray-200">¥{item.price.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-sm text-gray-900 dark:text-white print:text-gray-900 text-right border-r dark:border-gray-700 print:border-gray-200">{item.quantity.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-sm text-gray-900 dark:text-white print:text-gray-900 text-right font-medium">¥{item.amount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <div className="flex justify-end mb-8">
          <div className="w-72 space-y-2">
            <div className="flex justify-between text-sm py-1">
              <span className="text-gray-600 dark:text-gray-400 print:text-gray-600">小計</span>
              <span className="text-gray-900 dark:text-white print:text-gray-900">¥{quote.subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm py-1">
              <span className="text-gray-600 dark:text-gray-400 print:text-gray-600">消費税 (10%)</span>
              <span className="text-gray-900 dark:text-white print:text-gray-900">¥{quote.tax.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-base font-bold border-t border-gray-200 dark:border-gray-700 print:border-gray-200 pt-3">
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
