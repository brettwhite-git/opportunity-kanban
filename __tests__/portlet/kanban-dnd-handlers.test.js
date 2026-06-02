/**
 * @jest-environment jsdom
 */

/**
 * Validates inline drag-and-drop handler strings survive portlet HTML serialization.
 * Handlers must use single quotes only — embedded double quotes break ondrop attributes.
 */

const CLIENT_PATH = '../../src/FileCabinet/SuiteApps/com.netsuite.opportunitykanban/portlet/kanban-client.js';

function makeSampleData(overrides) {
    return Object.assign({
        columns: [
            { id: '6', name: 'Proposal', stage: 'OPPORTUNITY', probability: '50' },
            { id: '7', name: "VP's Approval", stage: 'OPPORTUNITY', probability: '75' }
        ],
        opportunities: [
            {
                id: '100', tranid: 'OPP-001', companyname: 'Acme Corporation',
                entitystatus: '6', entitystatusText: 'Proposal', probability: '50',
                expectedclosedate: '3/15/2026', closeDateGroup: 'THIS_MONTH THIS_QUARTER',
                projectedtotal: '150000', title: 'Deal A'
            }
        ],
        userId: 42,
        updateUrl: '/app/site/hosting/scriptlet.nl?script=99&deploy=1',
        allowedStatusIds: ['6', '7'],
        selectedStatusIds: ['6', '7']
    }, overrides);
}

function loadClient() {
    jest.isolateModules(() => {
        require(CLIENT_PATH);
    });
}

function setupDOM() {
    const root = document.createElement('div');
    root.id = 'kanban-board-container';
    document.body.appendChild(root);
}

function teardownDOM() {
    document.body.textContent = '';
}

function assertQuoteSafeHandler(handler, label) {
    expect(handler).toBeTruthy();
    expect(handler).not.toMatch(/"/);
    expect(() => new Function(handler)).not.toThrow();
}

function assertOndropFindsCardByNumericId(ondrop) {
    const container = document.getElementById('kanban-board-container');
    const card = document.querySelector('.kanban-card');
    const numericId = '92868';
    card.setAttribute('data-opp-id', numericId);

    const dropBody = document.querySelector('.kanban-column-body');
    const handler = new Function('event', ondrop);

    handler.call(dropBody, {
        preventDefault() {},
        stopPropagation() {},
        dataTransfer: {
            getData() {
                return numericId;
            }
        }
    });

    expect(card.parentNode).toBe(dropBody);
    expect(container.querySelector('.kanban-card[data-opp-id="' + numericId + '"]')).toBe(card);
}

beforeEach(() => {
    delete window._kanbanInitialized;
    delete window.KANBAN_DATA;
    teardownDOM();
    setupDOM();
});

afterEach(() => {
    delete window._kanbanInitialized;
    delete window.KANBAN_DATA;
    teardownDOM();
});

describe('kanban DnD inline handler strings', () => {
    it('generates quote-safe ondrop that parses and includes fetch', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        const bodies = document.querySelectorAll('.kanban-column-body');
        expect(bodies.length).toBeGreaterThan(0);

        bodies.forEach((body) => {
            const ondrop = body.getAttribute('ondrop');
            assertQuoteSafeHandler(ondrop, 'ondrop');
            expect(ondrop).toContain('fetch(');
            expect(ondrop).toContain('closedAccountingRanges:closedRanges');
            expect(ondrop).toContain("getAttribute('data-closed-ranges')");
            expect(ondrop).toContain("getAttribute('data-opp-id')===oid");
            expect(ondrop).not.toContain('querySelector(\'.kanban-card[data-opp-id');
            expect(ondrop).toContain("kanban-column-body.kanban-drop-hover");
            expect(ondrop).toContain('kanban-card-probability');
            expect(ondrop).toContain('d.probability');
        });
    });

    it('clears drop hover on drag end and drop', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        const card = document.querySelector('.kanban-card');
        const ondragend = card.getAttribute('ondragend');
        assertQuoteSafeHandler(ondragend, 'ondragend');
        expect(ondragend).toContain("classList.remove('kanban-drop-hover')");

        const ondrop = document.querySelector('.kanban-column-body').getAttribute('ondrop');
        expect(ondrop).toContain("classList.remove('kanban-drop-hover')");
    });

    it('generates quote-safe drag and filter handlers', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        const card = document.querySelector('.kanban-card');
        assertQuoteSafeHandler(card.getAttribute('ondragstart'), 'ondragstart');
        assertQuoteSafeHandler(card.getAttribute('ondragend'), 'ondragend');
        assertQuoteSafeHandler(card.getAttribute('onclick'), 'onclick');

        document.querySelectorAll('.kanban-column-body').forEach((body) => {
            assertQuoteSafeHandler(body.getAttribute('ondragover'), 'ondragover');
            assertQuoteSafeHandler(body.getAttribute('ondragleave'), 'ondragleave');
        });

        document.querySelectorAll('.kanban-period-cb').forEach((cb) => {
            assertQuoteSafeHandler(cb.getAttribute('onclick'), 'period checkbox onclick');
        });
        assertQuoteSafeHandler(
            document.getElementById('kanban-date-end').getAttribute('onchange'),
            'date range onchange'
        );
    });

    it('ondrop finds cards by numeric internal id at runtime', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        const ondrop = document.querySelector('.kanban-column-body').getAttribute('ondrop');
        assertOndropFindsCardByNumericId(ondrop);
    });

    it('escapes apostrophes in status labels inside ondrop', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        const approvalBody = Array.from(document.querySelectorAll('.kanban-column-body'))
            .find((body) => body.parentNode.querySelector('.kanban-column-title').textContent === "VP's Approval");

        expect(approvalBody).toBeTruthy();
        const ondrop = approvalBody.getAttribute('ondrop');
        assertQuoteSafeHandler(ondrop, 'ondrop with apostrophe label');
        expect(ondrop).toContain("VP\\'s Approval");
    });
});
