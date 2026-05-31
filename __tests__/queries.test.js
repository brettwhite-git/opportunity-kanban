import queries from 'SuiteScripts/lib/queries';
import search from 'N/search';
import query from 'N/query';

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

function mockSuiteQLStatusNames(rows) {
    jest.spyOn(query, 'runSuiteQL').mockReturnValue({
        asMappedResults: () => rows
    });
}

function mockOpportunityStatusGroupSearch(statusRows) {
    jest.spyOn(search, 'create').mockReturnValue({
        run: () => ({
            each: (callback) => {
                statusRows.forEach(({ id, name }) => {
                    callback({
                        getValue: jest.fn((opts) => (
                            opts.name === 'entitystatus' && opts.summary === search.Summary.GROUP
                                ? id
                                : ''
                        )),
                        getText: jest.fn((opts) => (
                            opts.name === 'entitystatus' && opts.summary === search.Summary.GROUP
                                ? name
                                : ''
                        ))
                    });
                });
                return true;
            }
        })
    });
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


describe('loadEntityStatusNames', () => {
    it('loads names from SuiteQL entitystatus rows', () => {
        mockSuiteQLStatusNames([
            { key: '7', name: 'Negotiation' },
            { key: '8', name: 'In Discussion' }
        ]);
        const names = queries.loadEntityStatusNames(['8', '7']);

        expect(query.runSuiteQL).toHaveBeenCalled();
        expect(names).toEqual({ '7': 'Negotiation', '8': 'In Discussion' });
    });

    it('falls back to grouped opportunity search when SuiteQL fails', () => {
        jest.spyOn(query, 'runSuiteQL').mockImplementation(() => {
            throw new Error('SuiteQL unavailable');
        });
        mockOpportunityStatusGroupSearch([
            { id: '9', name: 'Closed Won' },
            { id: '10', name: 'Closed Lost' }
        ]);

        const names = queries.loadEntityStatusNames(['9', '10']);

        expect(search.create).toHaveBeenCalledWith(
            expect.objectContaining({
                type: search.Type.OPPORTUNITY,
                filters: [['entitystatus', 'anyof', ['9', '10']]]
            })
        );
        expect(names).toEqual({ '9': 'Closed Won', '10': 'Closed Lost' });
    });

    it('returns an empty object when no status IDs are provided', () => {
        const suiteQlSpy = jest.spyOn(query, 'runSuiteQL');
        expect(queries.loadEntityStatusNames([])).toEqual({});
        expect(suiteQlSpy).not.toHaveBeenCalled();
    });

    it('fills remaining ids from grouped opportunity search after partial SuiteQL', () => {
        mockSuiteQLStatusNames([{ key: '9', name: 'Closed Won' }]);
        mockOpportunityStatusGroupSearch([{ id: '10', name: 'Closed Lost' }]);

        const names = queries.loadEntityStatusNames(['9', '10']);

        expect(names).toEqual({ '9': 'Closed Won', '10': 'Closed Lost' });
    });
});

describe('buildStatusColumns', () => {
    it('returns param-driven columns including empty statuses', () => {
        mockSuiteQLStatusNames([
            { key: '7', name: 'Negotiation' },
            { key: '8', name: 'In Discussion' }
        ]);

        const opps = [
            { entitystatus: '6', entitystatusText: 'Proposal' }
        ];
        const columns = queries.buildStatusColumns(['8', '6', '7'], opps);
        expect(columns.map((c) => c.id)).toEqual(['6', '7', '8']);
        expect(columns.find((c) => c.id === '7').name).toBe('Negotiation');
        expect(columns.find((c) => c.id === '8').name).toBe('In Discussion');
        expect(columns.find((c) => c.id === '6').name).toBe('Proposal');
    });

    it('uses entitystatus names when the rep has no opportunities in those statuses', () => {
        mockSuiteQLStatusNames([
            { key: '9', name: 'Closed Won' },
            { key: '10', name: 'Closed Lost' }
        ]);

        const columns = queries.buildStatusColumns(['9', '10'], []);

        expect(columns).toEqual([
            { id: '9', name: 'Closed Won' },
            { id: '10', name: 'Closed Lost' }
        ]);
    });

    it('falls back to deriveStatusColumns when param is empty', () => {
        const opps = [{ entitystatus: '6', entitystatusText: 'Proposal' }];
        expect(queries.buildStatusColumns([], opps)).toEqual(queries.deriveStatusColumns(opps));
    });
});

describe('normalizeStatusIds', () => {
    it('parses comma-separated status IDs', () => {
        expect(queries.normalizeStatusIds('6,7,8')).toEqual(['6', '7', '8']);
    });

    it('parses whitespace and newline separated status IDs', () => {
        expect(queries.normalizeStatusIds('6 7\n8')).toEqual(['6', '7', '8']);
    });

    it('ignores invalid tokens and duplicate IDs', () => {
        expect(queries.normalizeStatusIds('6, abc, 7, 6, -1, 8x')).toEqual(['6', '7']);
    });

    it('returns an empty array for blank values', () => {
        expect(queries.normalizeStatusIds('')).toEqual([]);
        expect(queries.normalizeStatusIds(null)).toEqual([]);
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

    it('adds an entitystatus filter when valid status IDs are provided', () => {
        mockSearchRun([]);

        queries.getOpportunitiesByUser(42, ['6', '7']);

        expect(search.create).toHaveBeenCalledWith(
            expect.objectContaining({
                filters: [
                    ['salesrep', 'anyof', 42],
                    'AND',
                    ['entitystatus', 'anyof', ['6', '7']]
                ]
            })
        );
    });

    it('does not add an entitystatus filter when no valid status IDs are provided', () => {
        mockSearchRun([]);

        queries.getOpportunitiesByUser(42, ['abc', '']);

        expect(search.create).toHaveBeenCalledWith(
            expect.objectContaining({
                filters: [['salesrep', 'anyof', 42]]
            })
        );
    });
});

describe('getCloseDatePeriodFilters', () => {
    it('splits accounting periods into month and quarter lists', () => {
        mockSearchRun([
            makeResult('10', {
                periodname: 'Jan 2026',
                startdate: '1/1/2026',
                enddate: '1/31/2026',
                isquarter: 'F',
                isyear: 'F',
                closed: 'F'
            }),
            makeResult('20', {
                periodname: 'Q1 2026',
                startdate: '1/1/2026',
                enddate: '3/31/2026',
                isquarter: 'T',
                isyear: 'F',
                closed: 'F'
            })
        ]);

        const filters = queries.getCloseDatePeriodFilters();

        expect(filters.accountingPeriods).toHaveLength(1);
        expect(filters.accountingPeriods[0].name).toBe('Jan 2026');
        expect(filters.accountingPeriods[0].startIso).toBe('2026-01-01');
        expect(filters.accountingPeriods[0].closed).toBe(false);
        expect(filters.quarterPeriods).toHaveLength(1);
        expect(filters.quarterPeriods[0].name).toBe('Q1 2026');
    });

    it('exposes default range ISO from current accounting period', () => {
        mockSearchRun([
            makeResult('10', {
                periodname: 'Mar 2026',
                startdate: '3/1/2026',
                enddate: '3/31/2026',
                isquarter: 'F',
                isyear: 'F',
                closed: 'F'
            })
        ]);

        const realDate = Date;
        const mockDate = new Date('2026-03-15T12:00:00Z');
        global.Date = jest.fn(() => mockDate);
        global.Date.UTC = realDate.UTC;
        global.Date.parse = realDate.parse;

        const filters = queries.getCloseDatePeriodFilters();
        global.Date = realDate;

        expect(filters.defaultRangeStartIso).toBe('2026-03-01');
        expect(filters.defaultRangeEndIso).toBe('2026-03-31');
    });

    it('builds closedAccountingRanges from closed month periods', () => {
        mockSearchRun([
            makeResult('10', {
                periodname: 'Jan 2026',
                startdate: '1/1/2026',
                enddate: '1/31/2026',
                isquarter: 'F',
                isyear: 'F',
                closed: 'T'
            }),
            makeResult('11', {
                periodname: 'Feb 2026',
                startdate: '2/1/2026',
                enddate: '2/28/2026',
                isquarter: 'F',
                isyear: 'F',
                closed: 'F'
            })
        ]);

        const filters = queries.getCloseDatePeriodFilters();
        expect(filters.closedAccountingRanges).toEqual([
            { startIso: '2026-01-01', endIso: '2026-01-31' }
        ]);
    });
});

describe('parseClosedAccountingRanges', () => {
    it('accepts valid ISO date ranges from the request body', () => {
        const ranges = queries.parseClosedAccountingRanges([
            { startIso: '2026-01-01', endIso: '2026-01-31' },
            { startIso: '2026-02-01', endIso: '2026-02-28' }
        ]);
        expect(ranges).toHaveLength(2);
        expect(ranges[0].startIso).toBe('2026-01-01');
    });

    it('rejects invalid shapes and reversed dates', () => {
        expect(queries.parseClosedAccountingRanges(null)).toEqual([]);
        expect(queries.parseClosedAccountingRanges([
            { startIso: 'not-a-date', endIso: '2026-01-31' },
            { startIso: '2026-03-01', endIso: '2026-02-01' },
            'bad'
        ])).toEqual([]);
    });
});

describe('isCloseDateInClosedPeriod', () => {
    it('returns true when close date falls in a closed range', () => {
        const ranges = [{ startIso: '2026-01-01', endIso: '2026-01-31' }];
        expect(queries.isCloseDateInClosedPeriod('2026-01-15', ranges)).toBe(true);
        expect(queries.isCloseDateInClosedPeriod('2026-02-01', ranges)).toBe(false);
    });
});

describe('markOpportunitiesInClosedPeriods', () => {
    it('sets isInClosedPeriod on opportunities', () => {
        const opps = [
            { expectedclosedate: '1/15/2026' },
            { expectedclosedate: '2/15/2026' }
        ];
        queries.markOpportunitiesInClosedPeriods(opps, [
            { startIso: '2026-01-01', endIso: '2026-01-31' }
        ]);
        expect(opps[0].isInClosedPeriod).toBe(true);
        expect(opps[1].isInClosedPeriod).toBe(false);
    });
});
