"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const outbound_message_service_1 = require("../../services/outbound-message.service");
const integration_helper_1 = require("../../lib/integration-helper");
const message_1 = require("../../schemas/message");
// Mock do IntegrationHelper
jest.mock('../../lib/integration-helper');
// Mock do fetch global
global.fetch = jest.fn();
describe('OutboundMessageService', () => {
    let service;
    let mockIntegrationHelper;
    beforeEach(() => {
        service = new outbound_message_service_1.OutboundMessageService();
        mockIntegrationHelper = new integration_helper_1.IntegrationHelper(undefined);
        mockIntegrationHelper.getCompanyCredentials = jest.fn();
        service.integrationHelper = mockIntegrationHelper;
        // Reset dos mocks
        jest.clearAllMocks();
        // Setup de env vars de teste
        process.env.N8N_OUTBOUND_WEBHOOK_URL = 'http://localhost:5678/webhook/send-message';
        process.env.N8N_AUTH_TOKEN = 'test-token';
    });
    describe('sendMessage', () => {
        const mockPayload = {
            companyId: 'test-company',
            channel: message_1.Channel.WHATSAPP,
            clientContact: '+5511999999999',
            message: 'Hello, world!',
            interactionId: 123
        };
        const mockCredentials = {
            webhookSecret: 'secret123',
            apiKey: 'api-key-123'
        };
        beforeEach(() => {
            mockIntegrationHelper.getCompanyCredentials.mockResolvedValue(mockCredentials);
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                text: jest.fn().mockResolvedValue('OK')
            });
        });
        it('should send message successfully', async () => {
            await service.sendMessage(mockPayload);
            expect(mockIntegrationHelper.getCompanyCredentials).toHaveBeenCalledWith('test-company', message_1.Channel.WHATSAPP);
            expect(global.fetch).toHaveBeenCalledWith('http://localhost:5678/webhook/send-message', expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'Content-Type': 'application/json',
                    'x-webhook-source': 'dashboard-backend',
                    'Authorization': 'Bearer test-token'
                }),
                body: expect.stringContaining('test-company')
            }));
        });
        it('should throw error if no credentials found', async () => {
            mockIntegrationHelper.getCompanyCredentials.mockResolvedValue(null);
            await expect(service.sendMessage(mockPayload)).rejects.toThrow('No credentials found for company test-company and channel whatsapp');
        });
        it('should throw error if n8n request fails', async () => {
            ;
            global.fetch.mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                text: jest.fn().mockResolvedValue('Error details')
            });
            await expect(service.sendMessage(mockPayload)).rejects.toThrow('n8n webhook failed: 500 Internal Server Error - Error details');
        });
        it('should include correct payload structure', async () => {
            await service.sendMessage(mockPayload);
            const fetchCall = global.fetch.mock.calls[0];
            const requestBody = JSON.parse(fetchCall[1].body);
            expect(requestBody).toEqual({
                company_id: 'test-company',
                channel: 'whatsapp',
                client_contact: '+5511999999999',
                message: 'Hello, world!',
                interaction_id: 123,
                timestamp: expect.any(String),
                metadata: {
                    api_key: 'api-key-123'
                }
            });
        });
        it('should handle different channels correctly', async () => {
            const instagramPayload = {
                ...mockPayload,
                channel: message_1.Channel.INSTAGRAM,
                clientContact: '@johndoe'
            };
            await service.sendMessage(instagramPayload);
            expect(mockIntegrationHelper.getCompanyCredentials).toHaveBeenCalledWith('test-company', message_1.Channel.INSTAGRAM);
            const fetchCall = global.fetch.mock.calls[0];
            const requestBody = JSON.parse(fetchCall[1].body);
            expect(requestBody.channel).toBe('instagram');
            expect(requestBody.client_contact).toBe('@johndoe');
        });
    });
    describe('testConnection', () => {
        it('should return true if connection test succeeds', async () => {
            ;
            global.fetch.mockResolvedValue({
                ok: true
            });
            const result = await service.testConnection();
            expect(result).toBe(true);
            expect(global.fetch).toHaveBeenCalledWith('http://localhost:5678/webhook/health', expect.objectContaining({
                method: 'GET'
            }));
        });
        it('should return false if connection test fails', async () => {
            ;
            global.fetch.mockResolvedValue({
                ok: false
            });
            const result = await service.testConnection();
            expect(result).toBe(false);
        });
        it('should return false if connection throws error', async () => {
            ;
            global.fetch.mockRejectedValue(new Error('Network error'));
            const result = await service.testConnection();
            expect(result).toBe(false);
        });
    });
});
