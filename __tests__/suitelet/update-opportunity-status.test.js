import suitelet from 'SuiteScripts/suitelet/update-opportunity-status';
import record from 'N/record';
import runtime from 'N/runtime';

describe('update-opportunity-status suitelet', () => {
    const writeMock = jest.fn();
    const setHeaderMock = jest.fn();

    beforeEach(() => {
        jest.restoreAllMocks();
        writeMock.mockClear();
        setHeaderMock.mockClear();
        jest.spyOn(runtime, 'getCurrentUser').mockReturnValue({ id: 42 });
        jest.spyOn(record, 'load').mockReturnValue({
            getValue: jest.fn((opts) => (opts.fieldId === 'salesrep' ? 42 : '6')),
            getText: jest.fn(() => 'Proposal')
        });
        jest.spyOn(record, 'submitFields').mockImplementation(() => {});
    });

    function runPost(body) {
        const response = { write: writeMock, setHeader: setHeaderMock };
        suitelet.onRequest({
            request: { method: 'POST', body: JSON.stringify(body) },
            response
        });
        return JSON.parse(writeMock.mock.calls[0][0].output);
    }

    it('updates entitystatus for owned opportunity', () => {
        const result = runPost({ opportunityId: '100', entitystatus: '7', fromStatusId: '6' });
        expect(result.ok).toBe(true);
        expect(record.submitFields).toHaveBeenCalledWith(
            expect.objectContaining({ id: '100', values: { entitystatus: '7' } })
        );
    });

    it('rejects updates for opportunities not owned by user', () => {
        record.load.mockReturnValue({
            getValue: jest.fn((opts) => (opts.fieldId === 'salesrep' ? 99 : '6')),
            getText: jest.fn(() => 'Proposal')
        });
        const result = runPost({ opportunityId: '100', entitystatus: '7' });
        expect(result.ok).toBe(false);
        expect(record.submitFields).not.toHaveBeenCalled();
    });

    it('rejects non-POST methods', () => {
        const response = { write: writeMock, setHeader: setHeaderMock };
        suitelet.onRequest({ request: { method: 'GET' }, response });
        const result = JSON.parse(writeMock.mock.calls[0][0].output);
        expect(result.ok).toBe(false);
    });
});
