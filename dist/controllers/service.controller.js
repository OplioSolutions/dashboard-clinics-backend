"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceController = void 0;
const base_1 = require("./base");
const schemas_1 = require("../schemas");
const errors_1 = require("../lib/errors");
class ServiceController extends base_1.BaseController {
    constructor() {
        super('services');
    }
    async list(req, res) {
        return this.handleRequest(req, res, async () => {
            const query = this.createQuery(req);
            if (!req.query.includeInactive) {
                query.eq('active', true);
            }
            const { data, error } = await query
                .select('*')
                .order('name');
            if (error)
                throw error;
            return data;
        });
    }
    async create(req, res) {
        return this.handleRequest(req, res, async () => {
            const newService = schemas_1.serviceCreateSchema.parse({
                ...req.body,
                company_id: this.getTenantId(req)
            });
            const { data, error } = await this.getSupabase(req)
                .from(this.tableName)
                .insert(newService)
                .select()
                .single();
            if (error)
                throw error;
            return data;
        });
    }
    async update(req, res) {
        return this.handleRequest(req, res, async () => {
            const { id } = req.params;
            const updates = schemas_1.serviceUpdateSchema.parse(req.body);
            const { data, error } = await this.createQuery(req)
                .update(updates)
                .eq('id', id)
                .select()
                .single();
            if (error)
                throw error;
            if (!data)
                throw new errors_1.AppError(404, 'Service not found');
            return data;
        });
    }
    async getById(req, res) {
        return this.handleRequest(req, res, async () => {
            const { id } = req.params;
            const { data, error } = await this.createQuery(req)
                .select('*')
                .eq('id', id)
                .single();
            if (error)
                throw error;
            if (!data)
                throw new errors_1.AppError(404, 'Service not found');
            return data;
        });
    }
}
exports.ServiceController = ServiceController;
