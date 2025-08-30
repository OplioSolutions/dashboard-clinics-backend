"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const integration_controller_1 = require("../../controllers/integration.controller");
describe('IntegrationController', () => {
    let controller;
    beforeAll(() => {
        // Criar mock mais simples
        const simpleMock = {
            from: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({ data: null, error: null })
                    })
                })
            })
        };
        controller = new integration_controller_1.IntegrationController(simpleMock);
    });
    describe('Controller instantiation', () => {
        it('should create integration controller instance', () => {
            expect(controller).toBeInstanceOf(integration_controller_1.IntegrationController);
        });
        it('should have all required methods', () => {
            expect(typeof controller.listIntegrations).toBe('function');
            expect(typeof controller.createIntegration).toBe('function');
            expect(typeof controller.getIntegration).toBe('function');
            expect(typeof controller.updateIntegration).toBe('function');
            expect(typeof controller.updateIntegrationStatus).toBe('function');
            expect(typeof controller.rotateWebhookSecret).toBe('function');
            expect(typeof controller.deleteIntegration).toBe('function');
            expect(typeof controller.testIntegration).toBe('function');
            expect(typeof controller.getAvailableChannels).toBe('function');
        });
    });
});
