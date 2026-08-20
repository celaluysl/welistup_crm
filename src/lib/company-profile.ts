export const companyProfile = {
  legalName: process.env.COMPANY_LEGAL_NAME || "—",
  taxOffice: process.env.COMPANY_TAX_OFFICE || "—",
  taxNumber: process.env.COMPANY_TAX_NUMBER || "—",
  address: process.env.COMPANY_ADDRESS || "—",
} as const;
