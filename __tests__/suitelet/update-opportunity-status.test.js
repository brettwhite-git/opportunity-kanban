import suitelet from 'SuiteScripts/suitelet/update-opportunity-status';
import record from 'N/record';
import runtime from 'N/runtime';

jest.mock('SuiteScripts/lib/queries', () => ({
    parseClosedAccountingRanges: jest.fn(),
    isCloseDateInClosedPeriod: jest.fn()
}));

const queries = require('SuiteScripts/lib/queries');

function mockResponse() {
    const headers = {};
    let body = '';
    return {
        setHeader: jest.fn((opts) => { headers[opts.name] = opts.value; }),
        write: jest.fn((opts) => { body = opts.output; }),
        getBody: () => body,
        getHeaders: () => headers
    };
}

function mockRequest(method, bodyObj) {
    return {
        method: method,
        body: JSON.stringify(bodyObj)
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(runtime, 'getCurrentUser').mockReturnValue({ id: 42 });
    jest.spyOn(record, 'load');
    jest.spyOn(record, 'submitFields').mockImplementation(() => {});
    queries.parseClosedAccountingRanges.mockReturnValue([
        { startIso: '2026-01-01', endIso: '2026-01-31' }
    ]);
    queries.isCloseDateInClosedPeriod.mockReturnValue(false);
});

describe('update-opportunity-status suitelet', () => {
    it('rejects updates when close date is in a closed accounting period', () => {
        queries.isCloseDateInClosedPeriod.mockReturnValue(true);

        const mockOpp = {
            getValue: jest.fn((opts) => {
                if (opts.fieldId === 'salesrep') return 42;
                if (opts.fieldId === 'expectedclosedate') return '1/15/2026';
                if (opts.fieldId === 'entitystatus') return '6';
                return '';
            }),
            getText: jest.fn(() => 'Proposal')
        };
        record.load.mockReturnValue(mockOpp);

        const response = mockResponse();
        suitelet.onRequest({
            request: mockRequest('POST', {
                opportunityId: '100',
                entitystatus: '7',
                fromStatusId: '6',
                closedAccountingRanges: [{ startIso: '2026-01-01', endIso: '2026-01-31' }]
            }),
            response: response
        });

        const payload = JSON.parse(response.getBody());
        expect(payload.ok).toBe(false);
        expect(queries.parseClosedAccountingRanges).toHaveBeenCalled();
        expect(payload.error).toContain('closed accounting period');
        expect(record.submitFields).not.toHaveBeenCalled();
    });

    it('allows update when close date is not in a closed period', () => {
        const mockOpp = {
            getValue: jest.fn((opts) => {
                if (opts.fieldId === 'salesrep') return 42;
                if (opts.fieldId === 'expectedclosedate') return '3/15/2026';
                if (opts.fieldId === 'entitystatus') return '6';
                return '';
            }),
            getText: jest.fn(() => 'Proposal')
        };
        record.load
            .mockReturnValueOnce(mockOpp)
            .mockReturnValueOnce({
                getValue: jest.fn(() => '50'),
                getText: jest.fn(() => 'Negotiation')
            });

        const response = mockResponse();
        suitelet.onRequest({
            request: mockRequest('POST', {
                opportunityId: '100',
                entitystatus: '7',
                fromStatusId: '6'
            }),
            response: response
        });

        const payload = JSON.parse(response.getBody());
        expect(payload.ok).toBe(true);
        expect(record.submitFields).toHaveBeenCalled();
    });
});
