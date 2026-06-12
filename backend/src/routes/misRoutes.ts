import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getMisAlerts,
  getMisContracts,
  getMisDashboard,
  getMisExportRegistry,
  getMisFinanceSummary,
  getMisRecentActivity,
  getMisRevenue,
  getMisSearch,
  getMisServiceCategory,
  getMisTenderPerformance,
  getMisTenderValue,
} from '../controllers/misReportingController';

const router = Router();

router.use(authenticate);

const misRead = authorize('mis:read', 'mis:full');
const misFinance = authorize('mis:finance', 'mis:full', 'mis:read');
const misContracts = authorize('mis:contracts', 'mis:full', 'mis:read');
const misExport = authorize('mis:export', 'mis:full');

router.get('/dashboard', misRead, getMisDashboard);
router.get('/tender-performance', misRead, getMisTenderPerformance);
router.get('/tender-value', misRead, getMisTenderValue);
router.get('/service-category', misRead, getMisServiceCategory);
router.get('/finance-summary', misFinance, getMisFinanceSummary);
router.get('/contracts', misContracts, getMisContracts);
router.get('/revenue', misRead, getMisRevenue);
router.get('/alerts', misRead, getMisAlerts);
router.get('/search', misRead, getMisSearch);
router.get('/recent-activity', misRead, getMisRecentActivity);
router.get('/export-registry', misExport, getMisExportRegistry);

export default router;
