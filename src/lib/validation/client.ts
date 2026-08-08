import { z } from "zod";
export const clientSchema = z.object({
  company_name: z.string().trim().min(2, "Şirket adı en az 2 karakter olmalı."),
  short_name: z.string().trim().optional(),
  legal_name: z
    .string()
    .trim()
    .min(2, "Şirket ünvanı en az 2 karakter olmalı."),
  client_type: z.enum(["direct", "agency", "partner", "other"]),
  contact_name: z.string().trim().optional(),
  email: z
    .union([z.literal(""), z.string().email("Geçerli bir e-posta girin.")])
    .optional(),
  phone: z.string().trim().optional(),
  tax_office: z.string().trim().optional(),
  tax_number: z.string().trim().optional(),
  address: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});
