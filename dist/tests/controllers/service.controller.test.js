"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const service_controller_1 = require("../../controllers/service.controller");
const setup_1 = require("../setup");
describe('ServiceController', () => {
    let controller;
    let mockReq;
    let mockRes;
    let mockJson;
    let mockStatus;
    let mockQueryBuilder;
    beforeEach(() => {
        controller = new service_controller_1.ServiceController();
        mockJson = jest.fn();
        mockStatus = jest.fn().mockReturnThis();
        mockQueryBuilder = (0, setup_1.createMockQueryBuilder)();
        mockRes = {
            json: mockJson,
            status: mockStatus
        };
        mockReq = {
            supabase: setup_1.mockSupabaseClient,
            tenant: {
                company_id: '123e4567-e89b-12d3-a456-426614174000' // UUID válido para testes
            },
            query: {},
            user: {
                role: 'admin',
                auth_user_id: 'test-user-id',
                company_id: '123e4567-e89b-12d3-a456-426614174000',
                profile_id: 'test-profile-id',
                name: 'Test User',
                email: 'test@example.com'
            }
        };
        // Reset e configurar mock do Supabase
        jest.clearAllMocks();
        setup_1.mockSupabaseClient.from.mockReturnValue(mockQueryBuilder);
    });
    describe('list', () => {
        it('should list active services by default', async () => {
            const mockServices = [
                { id: '1', name: 'Service 1', active: true },
                { id: '2', name: 'Service 2', active: true }
            ];
            mockQueryBuilder.order.mockResolvedValue({ data: mockServices, error: null });
            await controller.list(mockReq, mockRes);
            expect(setup_1.mockSupabaseClient.from).toHaveBeenCalledWith('services');
            expect(mockQueryBuilder.eq).toHaveBeenCalledWith('company_id', mockReq.tenant.company_id);
            expect(mockQueryBuilder.eq).toHaveBeenCalledWith('active', true);
            expect(mockJson).toHaveBeenCalledWith(mockServices);
        });
        it('should include inactive services when requested', async () => {
            mockReq.query = { includeInactive: 'true' };
            const mockServices = [
                { id: '1', name: 'Service 1', active: true },
                { id: '2', name: 'Service 2', active: false }
            ];
            mockQueryBuilder.order.mockResolvedValue({ data: mockServices, error: null });
            await controller.list(mockReq, mockRes);
            expect(setup_1.mockSupabaseClient.from).toHaveBeenCalledWith('services');
            expect(mockQueryBuilder.eq).toHaveBeenCalledWith('company_id', mockReq.tenant.company_id);
            expect(mockJson).toHaveBeenCalledWith(mockServices);
        });
    });
    describe('create', () => {
        it('should create a service', async () => {
            const mockService = {
                name: 'New Service',
                duration: 60,
                price: 100,
                description: 'Test service'
            };
            const mockResponse = {
                ...mockService,
                id: '1',
                company_id: mockReq.tenant.company_id,
                active: true
            };
            mockReq.body = mockService;
            mockQueryBuilder.single.mockResolvedValue({ data: mockResponse, error: null });
            await controller.create(mockReq, mockRes);
            expect(setup_1.mockSupabaseClient.from).toHaveBeenCalledWith('services');
            expect(mockQueryBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
                ...mockService,
                company_id: mockReq.tenant.company_id
            }));
            expect(mockJson).toHaveBeenCalledWith(mockResponse);
        });
        it('should validate service data', async () => {
            mockReq.body = { name: '', duration: -1 }; // Dados inválidos
            await controller.create(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Validation error'
            }));
        });
    });
});
