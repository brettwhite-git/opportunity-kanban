import queries from 'SuiteScripts/lib/queries';
import search from 'N/search';

beforeEach(() => {
    jest.restoreAllMocks();
});

function mockSearchRun(results) {
    const mockResultSet = {
        each: jest.fn((callback) => {
            for (const r of results) {
                if (callback(r) !== true) break;
            }
        })
    };
    const mockSearchObj = { run: jest.fn(() => mockResultSet) };
    jest.spyOn(search, 'create').mockReturnValue(mockSearchObj);
    jest.spyOn(search, 'createColumn').mockImplementation((opts) => opts);
    return mockSearchObj;
}

function makeResult(id, valueMap, textMap) {
    return {
        id: id,
        getValue: jest.fn((opts) => (valueMap[opts.name] || '')),
        getText: jest.fn((opts) => (textMap && textMap[opts.name]) || '')
    };
}

describe('deriveStatusColumns', () => {
    it('extracts unique status columns from opportunities', () => {
        const opps = [
            { entitystatus: '6', entitystatusText: 'Proposal' },
            { entitystatus: '7', entitystatusText: 'Negotiation' },
            { entitystatus: '6', entitystatusText: 'Proposal' }
        ];
        const columns = queries.deriveStatusColumns(opps);
        expect(columns).toHaveLength(2);
        expect(columns.map(c => c.name)).toEqual(['Proposal', 'Negotiation']);
    });

    it('returns empty array when no opportunities', () => {
        const columns = queries.deriveStatusColumns([]);
        expect(columns).toEqual([]);
    });

    it('sorts columns by numeric status ID (pipeline order)', () => {
        const opps = [
            { entitystatus: '9', entitystatusText: 'Closed Won' },
            { entitystatus: '6', entitystatusText: 'Proposal' },
            { entitystatus: '7', entitystatusText: 'Negotiation' }
        ];
        const columns = queries.deriveStatusColumns(opps);
        expect(columns.map(c => c.name)).toEqual(['Proposal', 'Negotiation', 'Closed Won']);
    });

    it('handles missing entitystatusText with fallback', () => {
        const opps = [
            { entitystatus: '6', entitystatusText: '' }
        ];
        const columns = queries.deriveStatusColumns(opps);
        expect(columns[0].name).toBe('Status 6');
    });
});

describe('getOpportunitiesByUser', () => {
    it('creates an opportunity search filtered by salesrep', () => {
        const results = [
            makeResult('12345',
                {
                    tranid: 'OPP-0042',
                    entitystatus: '6',
                    probability: '50',
                    expectedclosedate: '3/15/2026',
                    formulatext: 'THIS_MONTH THIS_QUARTER',
                    projectedtotal: '150000.00',
                    title: 'Big Deal'
                },
                { entity: 'Acme Corp', entitystatus: 'Proposal' }
            )
        ];
        mockSearchRun(results);

        const opps = queries.getOpportunitiesByUser(42);

        expect(search.create).toHaveBeenCalledWith(
            expect.objectContaining({
                type: search.Type.OPPORTUNITY,
                filters: [['salesrep', 'anyof', 42]]
            })
        );
        expect(opps).toHaveLength(1);
        expect(opps[0]).toEqual({
            id: '12345',
            tranid: 'OPP-0042',
            companyname: 'Acme Corp',
            entitystatus: '6',
            entitystatusText: 'Proposal',
            probability: '50',
            expectedclosedate: '3/15/2026',
            closeDateGroup: 'THIS_MONTH THIS_QUARTER',
            projectedtotal: '150000.00',
            title: 'Big Deal'
        });
    });

    it('returns empty array when user has no opportunities', () => {
        mockSearchRun([]);
        const opps = queries.getOpportunitiesByUser(42);
        expect(opps).toEqual([]);
    });

    it('handles multiple opportunities', () => {
        const results = [
            makeResult('100', { tranid: 'OPP-001', entitystatus: '6', probability: '25', expectedclosedate: '1/1/2026', formulatext: 'THIS_QUARTER', projectedtotal: '10000', title: 'Deal A' }, { entity: 'A', entitystatus: 'Proposal' }),
            makeResult('101', { tranid: 'OPP-002', entitystatus: '7', probability: '75', expectedclosedate: '2/1/2026', formulatext: 'THIS_QUARTER', projectedtotal: '50000', title: 'Deal B' }, { entity: 'B', entitystatus: 'Negotiation' })
        ];
        mockSearchRun(results);

        const opps = queries.getOpportunitiesByUser(1);
        expect(opps).toHaveLength(2);
        expect(opps[0].tranid).toBe('OPP-001');
        expect(opps[1].tranid).toBe('OPP-002');
    });
});
