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
        enterprise?: import('@/types/enterpriseFeasibilityReport').EnterpriseFeasibilityReport;
        pdfUrl: string;
        tender?: import('@/types').Tender;
      };
    }>(`/tenders/${tenderId}/report`, { token }),

  mdFeasibilityAction: (
    token: string,
    tenderId: string,
    action: import('@/types/enterpriseFeasibilityReport').MdFeasibilityAction,
    comments?: string
  ) =>
    request<{ data: unknown }>(`/tenders/${tenderId}/feasibility/md-action`, {
      method: 'POST',
      token,
      body: JSON.stringify({ action, comments }),
    }),

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

  previewAliasMapping: (token: string, label: string) =>
    request<{
      data: {
        parameter: string;
        originalLabel: string;
        canonicalKey: string;
        mapped: boolean;
      };
    }>('/debug/alias-mapping/preview', {
      method: 'POST',
      token,
      body: JSON.stringify({ label }),
    }),

  getAliasMapping: (token: string, documentId: string) =>
    request<{ data: import('@/types/tenderParameterAlias').TenderParameterAliasMappingResult }>(
      `/debug/${documentId}/alias-mapping`,
      { token }
    ),

  getServiceClassification: (token: string, documentId: string, refresh = false) =>
    request<{ data: import('@/types/tenderServiceClassification').TenderServiceClassificationRecord }>(
      `/debug/${documentId}/service-classification${refresh ? '?refresh=true' : ''}`,
      { token }
    ),

  getTenderIntelligence: (token: string, documentId: string, refresh = false) =>
    request<{ data: import('@/types/tenderIntelligenceLayer').TenderIntelligenceLayerResult }>(
      `/debug/${documentId}/tender-intelligence${refresh ? '?refresh=true' : ''}`,
      { token }
    ),

  getDynamicMasterDataset: (token: string, documentId: string, refresh = false) =>
    request<{ data: import('@/types/dynamicMasterDataset').DynamicMasterDatasetResult }>(
      `/debug/${documentId}/dynamic-master-dataset${refresh ? '?refresh=true' : ''}`,
      { token }
    ),

  getTenderDynamicMasterDataset: (token: string, tenderId: string, refresh = false) =>
    request<{ data: import('@/types/dynamicMasterDataset').DynamicMasterDatasetResult }>(
      `/tender/${tenderId}/dynamic-master-dataset${refresh ? '?refresh=true' : ''}`,
      { token }
    ),

  getAliasValidation: (token: string, documentId: string, refresh = false) =>
    request<{ data: import('@/types/enterpriseAliasValidation').EnterpriseAliasValidationResult }>(
      `/debug/${documentId}/alias-validation${refresh ? '?refresh=true' : ''}`,
      { token }
    ),

  getTenderAliasValidation: (token: string, tenderId: string, refresh = false) =>
    request<{ data: import('@/types/enterpriseAliasValidation').EnterpriseAliasValidationResult }>(
      `/tender/${tenderId}/alias-validation${refresh ? '?refresh=true' : ''}`,
      { token }
    ),

  getDynamicParameterExtraction: (token: string, documentId: string, refresh = false) =>
    request<{ data: import('@/types/enterpriseDynamicParameterExtraction').EnterpriseDynamicParameterExtractionResult }>(
      `/debug/${documentId}/dynamic-parameter-extraction${refresh ? '?refresh=true' : ''}`,
      { token }
    ),

  getTenderDynamicParameterExtraction: (token: string, tenderId: string, refresh = false) =>
    request<{ data: import('@/types/enterpriseDynamicParameterExtraction').EnterpriseDynamicParameterExtractionResult }>(
      `/tender/${tenderId}/dynamic-parameter-extraction${refresh ? '?refresh=true' : ''}`,
      { token }
    ),

  getTenderTenderIntelligence: (token: string, tenderId: string, refresh = false) =>
    request<{ data: import('@/types/tenderIntelligenceLayer').TenderIntelligenceLayerResult }>(
      `/tender/${tenderId}/tender-intelligence${refresh ? '?refresh=true' : ''}`,
      { token }
    ),

  getTenderServiceClassification: (token: string, tenderId: string, refresh = false) =>
    request<{ data: import('@/types/tenderServiceClassification').TenderServiceClassificationRecord }>(
      `/tender/${tenderId}/service-classification${refresh ? '?refresh=true' : ''}`,
      { token }
    ),

  getDynamicChecklist: (token: string, documentId: string, refresh = false) =>
    request<{ data: import('@/types/dynamicChecklist').DynamicChecklistResult }>(
      `/debug/${documentId}/dynamic-checklist${refresh ? '?refresh=true' : ''}`,
      { token }
    ),

  getTenderDynamicChecklist: (token: string, tenderId: string, refresh = false) =>
    request<{ data: import('@/types/dynamicChecklist').DynamicChecklistResult }>(
      `/tender/${tenderId}/dynamic-checklist${refresh ? '?refresh=true' : ''}`,
      { token }
    ),

  updateChecklistItem: (
    token: string,
    tenderId: string,
    itemId: string,
    body: { action: string; note?: string; documentId?: string }
  ) =>
    request<{ data: import('@/types/dynamicChecklist').DynamicChecklistResult }>(
      `/tender/${tenderId}/dynamic-checklist/items/${itemId}`,
      { token, method: 'PATCH', body: JSON.stringify(body) }
    ),

  getValidatedMasterDataset: (token: string, documentId: string, refresh = false) =>
    request<{ data: import('@/types/enterpriseMasterDataset').EnterpriseMasterDatasetResult }>(
      `/debug/${documentId}/master-dataset${refresh ? '?refresh=true' : ''}`,
      { token }
    ),

  getEnterpriseMasterDatasetDebug: (token: string, documentId: string, refresh = false) =>
    request<{ data: import('@/types/enterpriseMasterDataset').EnterpriseMasterDatasetResult }>(
      `/debug/${documentId}/master-dataset-debug${refresh ? '?refresh=true' : ''}`,
      { token }
    ),

  getDocumentMasterDataset: (token: string, documentId: string, refresh = false) =>
    request<{ data: import('@/types/enterpriseMasterDataset').EnterpriseMasterDatasetResult }>(
      `/documents/${documentId}/master-dataset${refresh ? '?refresh=true' : ''}`,
      { token }
    ),

  getTenderValidatedMasterDataset: (token: string, tenderId: string, refresh = false) =>
    request<{ data: import('@/types/validatedMasterDataset').ValidatedMasterDatasetResult }>(
      `/tender/${tenderId}/validated-master-dataset${refresh ? '?refresh=true' : ''}`,
      { token }
    ),

  getTenderEnterpriseMasterDataset: (token: string, tenderId: string, refresh = false) =>
    request<{ data: import('@/types/enterpriseMasterDataset').EnterpriseMasterDatasetResult }>(
      `/tender/${tenderId}/master-dataset${refresh ? '?refresh=true' : ''}`,
      { token }
    ),

  getRequirements: (token: string, documentId: string, refresh = false) =>
    request<{ data: import('@/types/requirementDiscovery').RequirementDiscoveryResult }>(
      `/debug/${documentId}/requirements${refresh ? '?refresh=true' : ''}`,
      { token }
    ),

  getTenderRequirements: (token: string, tenderId: string, refresh = false) =>
    request<{ data: import('@/types/requirementDiscovery').RequirementDiscoveryResult }>(
      `/tender/${tenderId}/requirements${refresh ? '?refresh=true' : ''}`,
      { token }
    ),

  getParameterCandidates: (token: string, documentId: string, refresh = false) =>
    request<{ data: import('@/types/tenderParameterCandidate').TenderParameterCandidateExtractionResult }>(
      `/debug/${documentId}/parameter-candidates${refresh ? '?refresh=true' : ''}`,
      { token }
    ),

  getTenderParameterCandidates: (token: string, tenderId: string, refresh = false) =>
    request<{ data: import('@/types/tenderParameterCandidate').TenderParameterCandidateExtractionResult }>(
      `/tender/${tenderId}/parameter-candidates${refresh ? '?refresh=true' : ''}`,
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

  getPreparationDocuments: (token: string, tenderId: string) =>
    request<{ data: import('@/types/documentPreparation').PreparationDocumentListResult }>(
      `/tender/${tenderId}/document-preparation/documents`,
      { token }
    ),

  uploadPreparationDocuments: (token: string, tenderId: string, files: File[]) => {
    const form = new FormData();
    if (files.length === 1) {
      form.append('file', files[0]);
    } else {
      files.forEach((f) => form.append('files', f));
    }
    return request<{ data: import('@/types/documentPreparation').PreparationDocumentRecord[] }>(
      `/tender/${tenderId}/document-preparation/documents`,
      { token, method: 'POST', body: form }
    );
  },

  deletePreparationDocument: (token: string, tenderId: string, documentId: string) =>
    request<{ data: { deleted: boolean } }>(
      `/tender/${tenderId}/document-preparation/documents/${documentId}`,
      { token, method: 'DELETE' }
    ),

  renamePreparationDocument: (
    token: string,
    tenderId: string,
    documentId: string,
    displayName: string
  ) =>
    request<{ data: import('@/types/documentPreparation').PreparationDocumentRecord }>(
      `/tender/${tenderId}/document-preparation/documents/${documentId}/rename`,
      { token, method: 'PATCH', body: JSON.stringify({ displayName }) }
    ),

  bulkRenamePreparationDocuments: (
    token: string,
    tenderId: string,
    items: import('@/types/documentPreparation').BulkRenameItem[]
  ) =>
    request<{ data: import('@/types/documentPreparation').PreparationDocumentRecord[] }>(
      `/tender/${tenderId}/document-preparation/documents/bulk-rename`,
      { token, method: 'PATCH', body: JSON.stringify({ items }) }
    ),

  mergePreparationPdfs: (
    token: string,
    tenderId: string,
    body: import('@/types/documentPreparation').PdfMergeRequest
  ) =>
    request<{ data: import('@/types/documentPreparation').PreparationDocumentRecord }>(
      `/tender/${tenderId}/document-preparation/pdf/merge`,
      { token, method: 'POST', body: JSON.stringify(body) }
    ),

  splitPreparationPdf: (
    token: string,
    tenderId: string,
    body: import('@/types/documentPreparation').PdfSplitRequest
  ) =>
    request<{ data: import('@/types/documentPreparation').PreparationDocumentRecord[] }>(
      `/tender/${tenderId}/document-preparation/pdf/split`,
      { token, method: 'POST', body: JSON.stringify(body) }
    ),

  compressPreparationPdf: (
    token: string,
    tenderId: string,
    body: import('@/types/documentPreparation').PdfCompressRequest
  ) =>
    request<{ data: import('@/types/documentPreparation').PreparationDocumentRecord }>(
      `/tender/${tenderId}/document-preparation/pdf/compress`,
      { token, method: 'POST', body: JSON.stringify(body) }
    ),

  rotatePreparationPdf: (
    token: string,
    tenderId: string,
    body: import('@/types/documentPreparation').PdfRotateRequest
  ) =>
    request<{ data: import('@/types/documentPreparation').PreparationDocumentRecord }>(
      `/tender/${tenderId}/document-preparation/pdf/rotate`,
      { token, method: 'POST', body: JSON.stringify(body) }
    ),

  runPreparationDocumentOcr: (token: string, tenderId: string, documentId: string) =>
    request<{ data: import('@/types/documentPreparation').PreparationOcrResult }>(
      `/tender/${tenderId}/document-preparation/documents/${documentId}/ocr`,
      { token, method: 'POST' }
    ),

  getPreparationDocumentOcr: (token: string, tenderId: string, documentId: string) =>
    requestNullable<{ data: import('@/types/documentPreparation').PreparationOcrResult }>(
      `/tender/${tenderId}/document-preparation/documents/${documentId}/ocr`,
      { token }
    ),

  getCompanyTemplateData: (token: string, tenderId: string) =>
    request<{ data: import('@/types/documentPreparation').CompanyTemplateData }>(
      `/tender/${tenderId}/document-preparation/template-data`,
      { token }
    ),

  updateCompanyTemplateData: (
    token: string,
    tenderId: string,
    body: Partial<import('@/types/documentPreparation').CompanyTemplateData>
  ) =>
    request<{ data: import('@/types/documentPreparation').CompanyTemplateData }>(
      `/tender/${tenderId}/document-preparation/template-data`,
      { token, method: 'PUT', body: JSON.stringify(body) }
    ),

  addPreparationHeaderFooter: (
    token: string,
    tenderId: string,
    body: import('@/types/documentPreparation').PdfHeaderFooterRequest
  ) =>
    request<{ data: import('@/types/documentPreparation').PreparationDocumentRecord }>(
      `/tender/${tenderId}/document-preparation/pdf/header-footer`,
      { token, method: 'POST', body: JSON.stringify(body) }
    ),

  addPreparationWatermark: (
    token: string,
    tenderId: string,
    body: import('@/types/documentPreparation').PdfWatermarkRequest
  ) =>
    request<{ data: import('@/types/documentPreparation').PreparationDocumentRecord }>(
      `/tender/${tenderId}/document-preparation/pdf/watermark`,
      { token, method: 'POST', body: JSON.stringify(body) }
    ),

  addPreparationPageNumbers: (
    token: string,
    tenderId: string,
    body: import('@/types/documentPreparation').PdfPageNumbersRequest
  ) =>
    request<{ data: import('@/types/documentPreparation').PreparationDocumentRecord }>(
      `/tender/${tenderId}/document-preparation/pdf/page-numbers`,
      { token, method: 'POST', body: JSON.stringify(body) }
    ),

  autoFillPreparationTemplate: (
    token: string,
    tenderId: string,
    body: import('@/types/documentPreparation').PdfAutoFillTemplateRequest
  ) =>
    request<{ data: import('@/types/documentPreparation').AutoFillTemplateResult }>(
      `/tender/${tenderId}/document-preparation/pdf/auto-fill`,
      { token, method: 'POST', body: JSON.stringify(body) }
    ),

  getPreparationValidationDashboard: (token: string, tenderId: string) =>
    request<{ data: import('@/types/documentPreparation').ValidationDashboard }>(
      `/tender/${tenderId}/document-preparation/validation/dashboard`,
      { token }
    ),

  validatePreparationDocument: (token: string, tenderId: string, documentId: string) =>
    request<{ data: import('@/types/documentPreparation').DocumentValidation }>(
      `/tender/${tenderId}/document-preparation/documents/${documentId}/validate`,
      { token, method: 'POST' }
    ),

  validatePreparationPackage: (token: string, tenderId: string) =>
    request<{ data: import('@/types/documentPreparation').ValidationDashboard }>(
      `/tender/${tenderId}/document-preparation/validation/package`,
      { token, method: 'POST' }
    ),

  getPreparationDocumentValidation: (token: string, tenderId: string, documentId: string) =>
    request<{ data: import('@/types/documentPreparation').DocumentValidation | null }>(
      `/tender/${tenderId}/document-preparation/documents/${documentId}/validation`,
      { token }
    ),

  detectPreparationExpiry: (token: string, tenderId: string, documentId: string) =>
    request<{ data: { validation: import('@/types/documentPreparation').DocumentValidation; findings: import('@/types/documentPreparation').CertificateFinding[] } }>(
      `/tender/${tenderId}/document-preparation/documents/${documentId}/validation/detect-expiry`,
      { token, method: 'POST' }
    ),

  detectPreparationBlankPages: (token: string, tenderId: string, documentId: string) =>
    request<{ data: { validation: import('@/types/documentPreparation').DocumentValidation; blankPages: number[] } }>(
      `/tender/${tenderId}/document-preparation/documents/${documentId}/validation/detect-blank-pages`,
      { token, method: 'POST' }
    ),

  detectPreparationSignature: (token: string, tenderId: string, documentId: string) =>
    request<{ data: { validation: import('@/types/documentPreparation').DocumentValidation; hasSignature: boolean } }>(
      `/tender/${tenderId}/document-preparation/documents/${documentId}/validation/detect-signature`,
      { token, method: 'POST' }
    ),

  unlockPreparationPdf: (
    token: string,
    tenderId: string,
    body: import('@/types/documentPreparation').PdfUnlockRequest
  ) =>
    request<{ data: import('@/types/documentPreparation').PreparationDocumentRecord }>(
      `/tender/${tenderId}/document-preparation/pdf/unlock`,
      { token, method: 'POST', body: JSON.stringify(body) }
    ),

  applyPreparationMarkup: (
    token: string,
    tenderId: string,
    body: import('@/types/documentPreparation').PdfMarkupRequest
  ) =>
    request<{ data: import('@/types/documentPreparation').PreparationDocumentRecord }>(
      `/tender/${tenderId}/document-preparation/pdf/markup`,
      { token, method: 'POST', body: JSON.stringify(body) }
    ),

  listPreparationSigningWorkflows: (token: string, tenderId: string, documentId?: string) =>
    request<{ data: import('@/types/documentPreparation').SigningWorkflow[] }>(
      `/tender/${tenderId}/document-preparation/signing/workflows${documentId ? `?documentId=${documentId}` : ''}`,
      { token }
    ),

  createPreparationSigningWorkflow: (
    token: string,
    tenderId: string,
    body: { documentId: string; title?: string }
  ) =>
    request<{ data: import('@/types/documentPreparation').SigningWorkflow }>(
      `/tender/${tenderId}/document-preparation/signing/workflows`,
      { token, method: 'POST', body: JSON.stringify(body) }
    ),

  getPreparationSigningWorkflow: (token: string, tenderId: string, workflowId: string) =>
    request<{ data: import('@/types/documentPreparation').SigningWorkflow }>(
      `/tender/${tenderId}/document-preparation/signing/workflows/${workflowId}`,
      { token }
    ),

  startPreparationSigningWorkflow: (token: string, tenderId: string, workflowId: string) =>
    request<{ data: import('@/types/documentPreparation').SigningWorkflow }>(
      `/tender/${tenderId}/document-preparation/signing/workflows/${workflowId}/start`,
      { token, method: 'POST' }
    ),

  cancelPreparationSigningWorkflow: (token: string, tenderId: string, workflowId: string) =>
    request<{ data: import('@/types/documentPreparation').SigningWorkflow }>(
      `/tender/${tenderId}/document-preparation/signing/workflows/${workflowId}/cancel`,
      { token, method: 'POST' }
    ),

  applyPreparationElectronicSign: (
    token: string,
    tenderId: string,
    workflowId: string,
    body: {
      signatureImageBase64: string;
      pageNumber?: number;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
    }
  ) =>
    request<{
      data: {
        workflow: import('@/types/documentPreparation').SigningWorkflow;
        signedDocument: import('@/types/documentPreparation').PreparationDocumentRecord;
      };
    }>(`/tender/${tenderId}/document-preparation/signing/workflows/${workflowId}/esign`, {
      token,
      method: 'POST',
      body: JSON.stringify(body),
    }),

  applyPreparationDscSign: (
    token: string,
    tenderId: string,
    workflowId: string,
    body: {
      certificatePem: string;
      signatureBase64: string;
      dscTokenId?: string;
      documentHashBase64?: string;
      signedPdfBase64?: string;
    }
  ) =>
    request<{
      data: {
        workflow: import('@/types/documentPreparation').SigningWorkflow;
        signedDocument: import('@/types/documentPreparation').PreparationDocumentRecord;
        verification: Record<string, unknown>;
      };
    }>(`/tender/${tenderId}/document-preparation/signing/workflows/${workflowId}/dsc-sign`, {
      token,
      method: 'POST',
      body: JSON.stringify(body),
    }),

  verifyPreparationDsc: (
    token: string,
    tenderId: string,
    documentId: string,
    certificatePem: string
  ) =>
    request<{ data: Record<string, unknown> }>(
      `/tender/${tenderId}/document-preparation/signing/documents/${documentId}/verify-dsc`,
      { token, method: 'POST', body: JSON.stringify({ certificatePem }) }
    ),

  getPreparationSignatureHistory: (token: string, tenderId: string, documentId: string) =>
    request<{ data: import('@/types/documentPreparation').SignatureHistoryItem[] }>(
      `/tender/${tenderId}/document-preparation/signing/documents/${documentId}/history`,
      { token }
    ),

  getPreparationAuditLogs: (
    token: string,
    tenderId: string,
    params?: { documentId?: string; page?: number; limit?: number }
  ) => {
    const qs = new URLSearchParams();
    if (params?.documentId) qs.set('documentId', params.documentId);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString();
    return request<{ data: { logs: import('@/types/documentPreparation').PreparationAuditLogItem[] } }>(
      `/tender/${tenderId}/document-preparation/audit-logs${query ? `?${query}` : ''}`,
      { token }
    );
  },

  getSubmissionTrackingDashboard: (token: string, tenderId: string) =>
    request<{ data: import('@/types/submissionTracking').SubmissionTrackingDashboard }>(
      `/tenders/${tenderId}/submission-tracking`,
      { token }
    ),

  markSubmissionReady: (token: string, tenderId: string) =>
    request<{ data: import('@/types/submissionTracking').SubmissionTrackingDashboard }>(
      `/tenders/${tenderId}/submission-tracking/ready`,
      { token, method: 'POST' }
    ),

  lockSubmission: (token: string, tenderId: string) =>
    request<{ data: import('@/types/submissionTracking').SubmissionTrackingDashboard }>(
      `/tenders/${tenderId}/submission-tracking/lock`,
      { token, method: 'POST' }
    ),

  markSubmissionSubmitted: (token: string, tenderId: string, notes?: string) =>
    request<{ data: import('@/types/submissionTracking').SubmissionTrackingDashboard }>(
      `/tenders/${tenderId}/submission-tracking/submit`,
      { token, method: 'POST', body: JSON.stringify({ notes }) }
    ),

  uploadSubmissionScreenshot: (token: string, tenderId: string, file: File, caption?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (caption) form.append('caption', caption);
    return request<{ data: import('@/types/submissionTracking').SubmissionScreenshot }>(
      `/tenders/${tenderId}/submission-tracking/screenshots`,
      { token, method: 'POST', body: form }
    );
  },

  getSubmissionTimeline: (token: string, tenderId: string, limit = 50) =>
    request<{ data: import('@/types/submissionTracking').SubmissionLogEntry[] }>(
      `/tenders/${tenderId}/submission-tracking/timeline?limit=${limit}`,
      { token }
    ),

  getTenderFinanceDashboard: (
    token: string,
    tenderId: string,
    params?: {
      page?: number;
      limit?: number;
      search?: string;
      recordType?: string;
      status?: string;
      sortBy?: string;
      sortOrder?: string;
    }
  ) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.search) qs.set('search', params.search);
    if (params?.recordType) qs.set('recordType', params.recordType);
    if (params?.status) qs.set('status', params.status);
    if (params?.sortBy) qs.set('sortBy', params.sortBy);
    if (params?.sortOrder) qs.set('sortOrder', params.sortOrder);
    const query = qs.toString();
    return request<{ data: import('@/types/financeTracking').FinanceDashboard }>(
      `/tenders/${tenderId}/finance${query ? `?${query}` : ''}`,
      { token }
    );
  },

  createFinanceRecord: (
    token: string,
    tenderId: string,
    body: import('@/types/financeTracking').CreateFinanceRecordInput
  ) =>
    request<{ data: import('@/types/financeTracking').FinanceRecord }>(
      `/tenders/${tenderId}/finance/records`,
      { token, method: 'POST', body: JSON.stringify(body) }
    ),

  updateFinanceRecord: (
    token: string,
    tenderId: string,
    recordId: string,
    body: Partial<import('@/types/financeTracking').CreateFinanceRecordInput>
  ) =>
    request<{ data: import('@/types/financeTracking').FinanceRecord }>(
      `/tenders/${tenderId}/finance/records/${recordId}`,
      { token, method: 'PUT', body: JSON.stringify(body) }
    ),

  deleteFinanceRecord: (token: string, tenderId: string, recordId: string) =>
    request<{ data: { deleted: boolean } }>(`/tenders/${tenderId}/finance/records/${recordId}`, {
      token,
      method: 'DELETE',
    }),

  uploadFinanceDocument: (
    token: string,
    tenderId: string,
    file: File,
    documentType: string,
    financeRecordId?: string
  ) => {
    const form = new FormData();
    form.append('file', file);
    form.append('documentType', documentType);
    if (financeRecordId) form.append('financeRecordId', financeRecordId);
    return request<{ data: import('@/types/financeTracking').FinanceDocument }>(
      `/tenders/${tenderId}/finance/documents`,
      { token, method: 'POST', body: form }
    );
  },

  deleteFinanceDocument: (token: string, tenderId: string, documentId: string) =>
    request<{ data: { deleted: boolean } }>(`/tenders/${tenderId}/finance/documents/${documentId}`, {
      token,
      method: 'DELETE',
    }),

  updateFinanceRefundStatus: (
    token: string,
    tenderId: string,
    body: {
      refundRecordId?: string;
      financeRecordId?: string;
      status: import('@/types/financeTracking').RefundStatus;
      note?: string;
    }
  ) =>
    request<{ data: import('@/types/financeTracking').RefundRecord }>(
      `/tenders/${tenderId}/finance/refund-status`,
      { token, method: 'POST', body: JSON.stringify(body) }
    ),

  getFinanceRefundReport: (token: string, tenderId: string) =>
    request<{
      data: {
        items: import('@/types/financeTracking').RefundReportItem[];
        totalPendingAmount: number;
      };
    }>(`/tenders/${tenderId}/finance/refund-report`, { token }),

  getFinanceAlerts: (token: string, tenderId: string) =>
    request<{ data: import('@/types/financeTracking').FinanceAlert[] }>(
      `/tenders/${tenderId}/finance/alerts`,
      { token }
    ),

  getFinanceActivityLog: (token: string, tenderId: string, limit = 50) =>
    request<{ data: import('@/types/financeTracking').FinanceLogEntry[] }>(
      `/tenders/${tenderId}/finance/activity-log?limit=${limit}`,
      { token }
    ),

  getFinanceApprovalDashboard: (token: string) =>
    request<{ data: import('@/types/financeWorkflow').FinanceApprovalDashboard }>(
      '/finance/dashboard',
      { token }
    ),

  listFinanceWorkflowRequests: (
    token: string,
    params?: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
      requestType?: string;
      tenderId?: string;
      sortBy?: string;
      sortOrder?: string;
    }
  ) => {
    const qs = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v != null && v !== '') qs.set(k, String(v));
    });
    const query = qs.toString();
    return request<{
      data: {
        items: import('@/types/financeWorkflow').FinanceWorkflowRequest[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    }>(`/finance/request/list${query ? `?${query}` : ''}`, { token });
  },

  approveFinanceWorkflowRequest: (
    token: string,
    requestId: string,
    body?: { comments?: string }
  ) =>
    request<{ data: import('@/types/financeWorkflow').FinanceWorkflowRequest }>(
      `/finance/request/approve/${requestId}`,
      { token, method: 'POST', body: JSON.stringify(body || {}) }
    ),

  rejectFinanceWorkflowRequest: (
    token: string,
    requestId: string,
    body: { rejectionReason?: string; comments?: string }
  ) =>
    request<{ data: import('@/types/financeWorkflow').FinanceWorkflowRequest }>(
      `/finance/request/reject/${requestId}`,
      { token, method: 'POST', body: JSON.stringify(body) }
    ),

  listFinanceRefundRequests: (token: string, params?: { status?: string }) => {
    const qs = params?.status ? `?status=${params.status}` : '';
    return request<{
      data: {
        items: import('@/types/financeWorkflow').FinanceWorkflowRequest[];
        total: number;
      };
    }>(`/finance/refund/list${qs}`, { token });
  },

  listFinanceTasks: (
    token: string,
    params?: { tenderId?: string; status?: string; assignedTo?: string }
  ) => {
    const qs = new URLSearchParams();
    if (params?.tenderId) qs.set('tenderId', params.tenderId);
    if (params?.status) qs.set('status', params.status);
    if (params?.assignedTo) qs.set('assignedTo', params.assignedTo);
    const query = qs.toString();
    return request<{ data: import('@/types/financeWorkflow').FinanceTask[] }>(
      `/finance/task/list${query ? `?${query}` : ''}`,
      { token }
    );
  },

  updateFinanceTaskStatus: (
    token: string,
    taskId: string,
    status: 'pending' | 'in_progress' | 'completed'
  ) =>
    request<{ data: { id: string; status: string } }>(`/finance/task/${taskId}/status`, {
      token,
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  getFinanceWorkflowNotifications: (token: string, limit = 50) =>
    request<{ data: import('@/types/financeWorkflow').FinanceWorkflowNotification[] }>(
      `/finance/notifications?limit=${limit}`,
      { token }
    ),

  getFinanceWorkflowAuditLogs: (
    token: string,
    params?: { tenderId?: string; limit?: number }
  ) => {
    const qs = new URLSearchParams();
    if (params?.tenderId) qs.set('tenderId', params.tenderId);
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString();
    return request<{ data: import('@/types/financeWorkflow').FinanceWorkflowAuditEntry[] }>(
      `/finance/audit-logs${query ? `?${query}` : ''}`,
      { token }
    );
  },

  getFinanceRequestComments: (token: string, requestId: string) =>
    request<{ data: import('@/types/financeWorkflow').FinanceWorkflowComment[] }>(
      `/finance/request/${requestId}/comments`,
      { token }
    ),

  createTenderFinanceRequest: (
    token: string,
    tenderId: string,
    body: {
      requestType: string;
      amount: number;
      remarks?: string;
      financeRecordId?: string;
      submit?: boolean;
    }
  ) =>
    request<{ data: import('@/types/financeWorkflow').FinanceWorkflowRequest }>(
      `/tenders/${tenderId}/finance/request/create`,
      { token, method: 'POST', body: JSON.stringify(body) }
    ),

  createTenderRefundRequest: (
    token: string,
    tenderId: string,
    body: {
      refundType: 'REFUND_EMD' | 'REFUND_SECURITY_DEPOSIT' | 'PBG_RELEASE';
      amount: number;
      remarks?: string;
      refundRecordId?: string;
      financeRecordId?: string;
      submit?: boolean;
    }
  ) =>
    request<{ data: import('@/types/financeWorkflow').FinanceWorkflowRequest }>(
      `/tenders/${tenderId}/finance/refund/request`,
      { token, method: 'POST', body: JSON.stringify(body) }
    ),

  createTenderRenewalRequest: (
    token: string,
    tenderId: string,
    body: {
      renewalType: 'BG_RENEWAL' | 'PBG_RENEWAL';
      financeRecordId: string;
      renewalDate?: string;
      newExpiryDate?: string;
      amount?: number;
      remarks?: string;
      submit?: boolean;
    }
  ) =>
    request<{ data: import('@/types/financeWorkflow').FinanceWorkflowRequest }>(
      `/tenders/${tenderId}/finance/renewal/request`,
      { token, method: 'POST', body: JSON.stringify(body) }
    ),

  listTenderFinanceRequests: (token: string, tenderId: string, params?: { status?: string }) => {
    const qs = params?.status ? `?status=${params.status}` : '';
    return request<{
      data: {
        items: import('@/types/financeWorkflow').FinanceWorkflowRequest[];
        total: number;
      };
    }>(`/tenders/${tenderId}/finance/request/list${qs}`, { token });
  },

  addTenderFinanceComment: (
    token: string,
    tenderId: string,
    body: { requestId: string; commentType: string; content: string }
  ) =>
    request<{ data: import('@/types/financeWorkflow').FinanceWorkflowComment }>(
      `/tenders/${tenderId}/finance/comment/add`,
      { token, method: 'POST', body: JSON.stringify(body) }
    ),

  syncTenderFinanceWorkflow: (token: string, tenderId: string) =>
    request<{ data: { synced: boolean } }>(`/tenders/${tenderId}/finance/workflow/sync`, {
      token,
      method: 'POST',
    }),
};
