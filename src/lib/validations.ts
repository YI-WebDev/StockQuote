import { z } from "zod";

export const productSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(1, "商品名は必須です"),
  manufacturer: z.string().optional(),
  price: z.coerce.number().min(0, "単価は0以上で入力してください"),
  stock: z.coerce.number().min(0, "在庫数は0以上で入力してください"),
  unit: z.string().optional(),
  note: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
});

export type ProductFormValues = z.infer<typeof productSchema>;

export const quoteItemSchema = z.object({
  productId: z.string().nullable().optional(),
  productName: z.string().min(1, "商品名は必須です"),
  manufacturer: z.string().optional().nullable(),
  price: z.coerce.number().min(0, "単価は0以上で入力してください"),
  quantity: z.coerce.number().min(1, "数量は1以上で入力してください"),
  amount: z.coerce.number(),
});

export const quoteSchema = z.object({
  quoteNumber: z.string().min(1, "見積番号は必須です"),
  subject: z.string().min(1, "件名は必須です"),
  customerName: z.string().min(1, "宛名は必須です"),
  issueDate: z.string().min(1, "作成日は必須です"),
  expiryDate: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  subtotal: z.coerce.number(),
  tax: z.coerce.number(),
  total: z.coerce.number(),
  items: z.array(quoteItemSchema).min(1, "最低1つの明細が必要です"),
});

export type QuoteItemFormValues = z.infer<typeof quoteItemSchema>;
export type QuoteFormValues = z.infer<typeof quoteSchema>;
