"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_controller_1 = require("../../controllers/client.controller");
const setup_1 = require("../setup");
describe('ClientController', () => {
    let controller;
    let mockReq;
    let mockRes;
    let mockJson;
    let mockStatus;
    let mockQueryBuilder;
    beforeEach(() => {
        controller = new client_controller_1.ClientController();
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
            query: {}
        };
        // Reset e configurar mock do Supabase
        jest.clearAllMocks();
        setup_1.mockSupabaseClient.from.mockReturnValue(mockQueryBuilder);
    });
    describe('list', () => {
        it('should list clients', async () => {
            const mockClients = [
                { id: '1', name: 'Test Client 1' },
                { id: '2', name: 'Test Client 2' }
            ];
            mockQueryBuilder.order.mockResolvedValue({ data: mockClients, error: null });
            await controller.list(mockReq, mockRes);
            expect(setup_1.mockSupabaseClient.from).toHaveBeenCalledWith('clients');
            expect(mockQueryBuilder.eq).toHaveBeenCalledWith('company_id', mockReq.tenant.company_id);
            expect(mockJson).toHaveBeenCalledWith(mockClients);
        });
        it('should handle search query', async () => {
            mockReq.query = { search: 'test' };
            const mockClients = [{ id: '1', name: 'Test Client' }];
            // Configurar o mock para retornar os dados no final da cadeia
            mockQueryBuilder.or.mockReturnThis();
            mockQueryBuilder.order.mockResolvedValue({ data: mockClients, error: null });
            await controller.list(mockReq, mockRes);
            expect(setup_1.mockSupabaseClient.from).toHaveBeenCalledWith('clients');
            expect(mockQueryBuilder.eq).toHaveBeenCalledWith('company_id', mockReq.tenant.company_id);
            expect(mockQueryBuilder.or).toHaveBeenCalledWith(expect.stringContaining('test'));
            expect(mockJson).toHaveBeenCalledWith(mockClients);
        });
    });
    describe('create', () => {
        it('should create a client', async () => {
            const mockClient = {
                name: 'New Client',
                email: 'client@test.com',
                phone: '1234567890'
            };
            const mockResponse = {
                ...mockClient,
                id: '1',
                company_id: mockReq.tenant.company_id
            };
            mockReq.body = mockClient;
            mockQueryBuilder.single.mockResolvedValue({ data: mockResponse, error: null });
            await controller.create(mockReq, mockRes);
            expect(setup_1.mockSupabaseClient.from).toHaveBeenCalledWith('clients');
            expect(mockQueryBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
                ...mockClient,
                company_id: mockReq.tenant.company_id
            }));
            expect(mockJson).toHaveBeenCalledWith(mockResponse);
        });
        it('should validate client data', async () => {
            mockReq.body = { name: '' }; // Nome inválido
            await controller.create(mockReq, mockRes);
            expect(mockStatus).toHaveBeenCalledWith(400);
            expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Validation error'
            }));
        });
    });
});
