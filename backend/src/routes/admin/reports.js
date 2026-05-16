/**
 * routes/admin/reports.js
 *
 * GET /admin/reports/revenue?period=YYYY-MM | from=&to=   — admin only
 */

import { revenueQuerySchema } from '../../schemas/admin.js';
import { revenueReport } from '../../services/admin.js';

export default async function adminReportRoutes(fastify) {
  fastify.get('/reports/revenue', {
    preHandler: [fastify.authenticate, fastify.requireRole('admin')]
  }, async (req) => {
    const f = revenueQuerySchema.parse(req.query);
    return { data: await revenueReport(f) };
  });
}
