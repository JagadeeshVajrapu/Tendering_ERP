const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

interface ApiOptions extends RequestInit {
  token?: string;
}

async function request<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;
  const headers: HeadersInit = {
    ...(fetchOptions.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  };
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${endpoint}`, { ...fetchOptions, headers });
  } catch {
    throw new Error(
      `Cannot reach the API server at ${API_URL}. Start the backend: cd backend && npm run dev`
    );
  }

  let data: { message?: string; success?: boolean };
  try {
    data = await res.json();
  } catch {
    throw new Error(`Invalid response from server (${res.status})`);
  }

  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data as T;
}

async function requestNullable<T>(endpoint: string, options: ApiOptions = {}): Promise<T | null> {
  const { token, ...fetchOptions } = options;
  const headers: HeadersInit = {
    ...(fetchOptions.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  };
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${endpoint}`, { ...fetchOptions, headers });
  } catch {
    throw new Error(
      `Cannot reach the API server at ${API_URL}. Start the backend: cd backend && npm run dev`
    );
  }

  if (res.status === 404) return null;

  let data: { message?: string; success?: boolean };
  try {
    data = await res.json();
  } catch {
    throw new Error(`Invalid response from server (${res.status})`);
  }

  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ data: { token: string; user: import('@/types').User } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  getProfile: (token: string) =>
    request<{ data: import('@/types').User }>('/auth/profile', { token }),

  getDashboardStats: (token: string) =>
    request<{ data: Record<string, unknown> }>('/tenders/dashboard/stats', { token }),

  getMdDashboard: (token: string) =>
    request<{ data: Record<string, unknown> }>('/tenders/dashboard/md', { token }),

  getFinanceDashboard: (token: string) =>
    request<{ data: Record<string, unknown> }>('/tenders/dashboard/finance', { token }),

  getManagerDashboard: (token: string) =>
    request<{ data: Record<string, unknown> }>('/tenders/dashboard/manager', { token }),

  getTenders: (token: string, params?: { status?: string; page?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.page) q.set('page', String(params.page));
    return request<{ data: import('@/types').Tender[]; pagination: { total: number } }>(
      `/tenders?${q}`,
      { token }
    );
  },

  getTender: (token: string, id: string) =>
    request<{ data: import('@/types').Tender }>(`/tenders/${id}`, { token }),

  createTender: (token: string, body: { title: string }) =>
    request<{ data: import('@/types').Tender }>('/tenders', {
      method: 'POST',
      token,
      body: JSON.stringify(body),
    }),

  uploadDocument: (token: string, tenderId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<{ data: unknown }>(`/tenders/${tenderId}/documents`, {
      method: 'POST',
      token,
      body: form,
    });
  },

  uploadTender: (token: string, file: File, options?: { title?: string; tenderId?: string }) => {
    const form = new FormData();
    form.append('file', file);
    if (options?.title) form.append('title', options.title);
    if (options?.tenderId) form.append('tenderId', options.tenderId);
    return request<{
      data: {
        tender: import('@/types').Tender;
        document: { id: string; originalName: string; pageCount?: number };
        job: import('@/types').IntelligenceJob;
        intelligence: import('@/types').TenderIntelligence;
      };
    }>('/tenders/upload', { method: 'POST', token, body: form });
  },

  uploadTenderExtraction: (token: string, file: File, options?: { title?: string; tenderId?: string }) => {
    const form = new FormData();
    form.append('file', file);
    if (options?.title) form.append('title', options.title);
    if (options?.tenderId) form.append('tenderId', options.tenderId);
    return request<{
      data: {
        tender: import('@/types').Tender;
        document: { id: string; originalName: string; mimeType: string };
        extraction: { id: string; status: string; progress: number };
        queueJobId: string;
      };
    }>('/tender/upload', { method: 'POST', token, body: form });
  },

  getTenderExtraction: async (token: string, tenderId: string) => {
    const res = await requestNullable<{ data: { extraction: import('@/types').TenderExtraction } }>(
      `/tender/${tenderId}`,
      { token }
    );
    if (!res) return { data: { extraction: null } };
    return res;
  },

  getTenderAnalysis: (token: string, tenderId: string) =>
    request<{
      data: {
        analysis: import('@/types').TenderAnalysis | null;
        tender: import('@/types').Tender | null;
        report: import('@/types').FeasibilityReport | null;
        intelligence: import('@/types').TenderIntelligence | null;
        job: import('@/types').IntelligenceJob | null;
      };
    }>(`/tenders/${tenderId}/analysis`, { token }),

  getIntelligenceJob: (token: string, tenderId: string) =>
    request<{ data: { job: import('@/types').IntelligenceJob } }>(
      `/tenders/${tenderId}/intelligence/job`,
      { token }
    ),

  reanalyzeTender: (token: string, tenderId: string) =>
    request<{ data: { analysis: import('@/types').TenderAnalysis } }>(
      `/tenders/${tenderId}/reanalyze`,
      { method: 'POST', token }
    ),

  generateFeasibilityReport: (token: string, tenderId: string) =>
    request<{ data: { report: import('@/types').FeasibilityReport; pdfUrl: string } }>(
      `/tenders/${tenderId}/report`,
      { method: 'POST', token }
    ),

  getFeasibilityReport: (token: string, tenderId: string) =>
    request<{
      data: {
        report: import('@/types').FeasibilityReport;
        pdfUrl: string;
        tender?: import('@/types').Tender;
      };
    }>(`/tenders/${tenderId}/report`, { token }),

  mdTenderDecision: (token: string, tenderId: string, decision: 'APPROVED' | 'REJECTED', remarks?: string) =>
    request<{ data: { tender: import('@/types').Tender; decision: import('@/types').MdDecision } }>(
      `/tenders/${tenderId}/decision`,
      { method: 'POST', token, body: JSON.stringify({ decision, remarks }) }
    ),

  analyzeNit: (token: string, tenderId: string, documentId: string) =>
    request<{ data: unknown }>(`/tenders/${tenderId}/analyze`, {
      method: 'POST',
      token,
      body: JSON.stringify({ documentId }),
    }),

  getNitAnalysis: (token: string, tenderId: string) =>
    request<{ data: { nitAnalysis: import('@/types').NitAnalysis; eligibility: import('@/types').EligibilityResult } }>(
      `/tenders/${tenderId}/nit-analysis`,
      { token }
    ),

  generateSummary: (token: string, tenderId: string) =>
    request<{ data: import('@/types').TenderSummary }>(`/tenders/${tenderId}/summary`, {
      method: 'POST',
      token,
    }),

  getSummary: (token: string, tenderId: string) =>
    request<{ data: { summary: import('@/types').TenderSummary; eligibility: import('@/types').EligibilityResult } }>(
      `/tenders/${tenderId}/summary`,
      { token }
    ),

  submitToMd: (token: string, tenderId: string) =>
    request<{ data: unknown }>(`/tenders/${tenderId}/submit-md`, { method: 'POST', token }),

  mdApprove: (token: string, tenderId: string, approved: boolean, comments?: string) =>
    request<{ data: unknown }>(`/approvals/md/${tenderId}`, {
      method: 'POST',
      token,
      body: JSON.stringify({ approved, comments }),
    }),

  createFinanceRequest: (token: string, tenderId: string, requestType: string, amount: number) =>
    request<{ data: unknown }>(`/approvals/finance/${tenderId}`, {
      method: 'POST',
      token,
      body: JSON.stringify({ requestType, amount }),
    }),

  financeDecision: (token: string, requestId: string, approved: boolean, comments?: string) =>
    request<{ data: unknown }>(`/approvals/finance/${requestId}/decision`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ approved, comments }),
    }),

  createComplianceRequest: (token: string, tenderId: string, documentTypes: string[]) =>
    request<{ data: unknown }>(`/approvals/compliance/${tenderId}`, {
      method: 'POST',
      token,
      body: JSON.stringify({ documentTypes }),
    }),

  approveCompliance: (token: string, requestId: string) =>
    request<{ data: unknown }>(`/approvals/compliance/${requestId}/approve`, {
      method: 'POST',
      token,
    }),

  uploadComplianceDocument: (token: string, requestId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<{ data: unknown }>(`/approvals/compliance/${requestId}/documents`, {
      method: 'POST',
      token,
      body: form,
    });
  },

  recordFinancePayment: (
    token: string,
    requestId: string,
    body: { utrNumber?: string; transactionId?: string; bankDetails?: string }
  ) =>
    request<{ data: import('@/types').FinanceRequestRecord }>(`/approvals/finance/${requestId}/payment`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(body),
    }),

  getFinanceRequests: (token: string, params?: { status?: string; tenderId?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.tenderId) q.set('tenderId', params.tenderId);
    return request<{ data: import('@/types').FinanceRequestRecord[] }>(`/approvals/finance?${q}`, { token });
  },

  getComplianceRequests: (token: string, params?: { status?: string; tenderId?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.tenderId) q.set('tenderId', params.tenderId);
    return request<{ data: import('@/types').ComplianceRequestRecord[] }>(`/approvals/compliance?${q}`, { token });
  },

  getTenderWorkflow: (token: string, tenderId: string) =>
    request<{
      data: {
        financeRequests: import('@/types').FinanceRequestRecord[];
        complianceRequests: import('@/types').ComplianceRequestRecord[];
        mdApprovals: import('@/types').MdApprovalRecord[];
      };
    }>(`/tenders/${tenderId}/workflow`, { token }),

  getNotifications: (token: string) =>
    request<{ data: import('@/types').Notification[] }>('/notifications', { token }),

  markNotificationRead: (token: string, id: string) =>
    request(`/notifications/${id}/read`, { method: 'PATCH', token }),

  getTenderMasterDataset: (token: string, tenderId: string) =>
    request<{ data: import('@/types/masterDataset').MasterTenderDatasetResponse }>(
      `/tender/${tenderId}/dataset`,
      { token }
    ),

  getTenderDiscoveredParameters: (token: string, tenderId: string, refresh = false) =>
    request<{ data: import('@/types/discoveredParameter').AllDiscoveredParametersResponse }>(
      `/tender/${tenderId}/discovered-parameters${refresh ? '?refresh=true' : ''}`,
      { token }
    ),

  getTenderNitAnalysis: (token: string, tenderId: string, refresh = false) =>
    request<{ data: import('@/types/nitAnalysisReport').NitAnalysisReport }>(
      `/tender/${tenderId}/nit-analysis${refresh ? '?refresh=true' : ''}`,
      { token }
    ),

  getTenderRiskAnalysis: (token: string, tenderId: string) =>
    request<{ data: import('@/types/tenderRiskAnalysis').TenderRiskAnalysisResponse }>(
      `/tender/${tenderId}/risk-analysis`,
      { token }
    ),

  getTenderRecommendation: (token: string, tenderId: string) =>
    request<{ data: import('@/types/executiveRecommendation').ExecutiveRecommendationResponse }>(
      `/tender/${tenderId}/recommendation`,
      { token }
    ),

  getTenderVerifiedSummary: (token: string, tenderId: string) =>
    request<{ data: import('@/types/verifiedSummary').TenderVerifiedSummary }>(
      `/tender/${tenderId}/verified-summary`,
      { token }
    ),

  getDebugDocumentPages: (token: string, documentId: string) =>
    request<{ data: import('@/types/ocrDebug').OcrDebugPagesResponse }>(
      `/debug/${documentId}/pages`,
      { token }
    ),

  getOcrNormalization: (token: string, documentId: string, refresh = false) =>
    request<{ data: import('@/types/ocrNormalization').OcrNormalizationResponse }>(
      `/debug/${documentId}/ocr-normalization${refresh ? '?refresh=true' : ''}`,
      { token }
    ),

  getParameterMappings: (token: string, documentId: string, refresh = false) =>
    request<{ data: import('@/types/parameterMapping').ParameterMappingResult }>(
      `/debug/${documentId}/parameter-mappings${refresh ? '?refresh=true' : ''}`,
      { token }
    ),

  getTenderParameterMappings: (token: string, tenderId: string, refresh = false) =>
    request<{ data: import('@/types/parameterMapping').ParameterMappingResult }>(
      `/tender/${tenderId}/parameter-mappings${refresh ? '?refresh=true' : ''}`,
      { token }
    ),

  getDebugDocumentFields: (token: string, documentId: string) =>
    request<{ data: import('@/types/fieldLocator').FieldLocatorDebugResponse }>(
      `/debug/${documentId}/fields`,
      { token }
    ),

  getDiscoveredParameters: (token: string, documentId: string, refresh = false) =>
    request<{ data: import('@/types/parameterDiscovery').ParameterDiscoveryResult }>(
      `/debug/${documentId}/parameters${refresh ? '?refresh=true' : ''}`,
      { token }
    ),

  getLabelValuePairs: (token: string, documentId: string, refresh = false) =>
    request<{ data: import('@/types/labelValuePair').LabelValueExtractionResult }>(
      `/debug/${documentId}/label-values${refresh ? '?refresh=true' : ''}`,
      { token }
    ),

  getLabelValueMappings: (token: string, documentId: string, refresh = false) =>
    request<{ data: import('@/types/labelValueMapping').LabelValueMappingResult }>(
      `/debug/${documentId}/label-mappings${refresh ? '?refresh=true' : ''}`,
      { token }
    ),
};
