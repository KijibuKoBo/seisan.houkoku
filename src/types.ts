export type Role = 'admin' | 'viewer';

export interface User {
  id: string;
  passwordHash: string;
  displayName: string;
  role: Role;
}

export interface AuthSession {
  userId: string;
  displayName: string;
  role: Role;
}

export interface SalesData {
  otsuka: number;
  takumi: number;
  butsudan: number;
  ippanten: number;
  showroom: number;
  bukken: number;
}

export interface SectionData {
  amount: number;
  count: number;
}

export interface MonthData {
  month: number;
  sales: SalesData;
  kiji: SectionData;
  tosou: SectionData;
  matome: SectionData;
  salesMemo?: Partial<Record<keyof SalesData, string>>;
}

export type YearStore = {
  [year: number]: {
    [month: number]: MonthData;
  };
};

// 木地部個別アイテム（PDFから抽出）
export interface KijiItem {
  year: number;
  month: number;
  code: string;
  category: string;
  name: string;
  count: number;
  unitPrice: number;
  amount: number;
  excluded: boolean;
}

export const emptySales = (): SalesData => ({
  otsuka: 0, takumi: 0, butsudan: 0,
  ippanten: 0, showroom: 0, bukken: 0,
});

export const emptySection = (): SectionData => ({ amount: 0, count: 0 });

export const emptyMonth = (month: number): MonthData => ({
  month,
  sales: emptySales(),
  kiji: emptySection(),
  tosou: emptySection(),
  matome: emptySection(),
});
