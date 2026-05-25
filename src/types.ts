export interface SalesData {
  otsuka: number;    // 大塚
  takumi: number;    // 匠
  butsudan: number;  // 仏壇
  ippanten: number;  // 一般店
  showroom: number;  // ショールーム
  bukken: number;    // 物件
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
}

export type YearStore = {
  [year: number]: {
    [month: number]: MonthData;
  };
};

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
