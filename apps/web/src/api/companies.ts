import { apiGet } from "./client";
import type { Detail, Company } from "../types";

export function listCompanies(): Promise<Company[]> {
  return apiGet<Company[]>("/api/companies");
}

export function getCompany(id: number): Promise<Detail> {
  return apiGet<Detail>(`/api/companies/${id}`);
}
