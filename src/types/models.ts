export type Product = {
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

export type QuoteItem = {
  productId: string;
  productName: string;
  manufacturer: string | null;
  price: number;
  quantity: number;
  amount: number;
};

export type Quote = {
  id: string;
  quoteNumber: string;
  subject: string;
  customerName: string;
  issueDate: string;
  expiryDate: string | null;
  subtotal: number;
  tax: number;
  total: number;
  note: string | null;
};

export type QuoteDetail = Quote & {
  items: QuoteItem[];
};

export type ProductForSelect = {
  id: string;
  name: string;
  manufacturer: string | null;
  price: number;
};
