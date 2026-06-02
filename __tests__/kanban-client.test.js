/**
 * @jest-environment jsdom
 */

/**
 * Tests for kanban-client.js (client-side IIFE).
 *
 * The IIFE executes on require(), so each test uses jest.isolateModules()
 * to force re-evaluation with fresh globals.
 */

const CLIENT_PATH = '../src/FileCabinet/SuiteApps/com.netsuite.opportunitykanban/portlet/kanban-client.js';

function samplePeriodFilters() {
    return {
        accountingPeriods: [
            { id: 'm1', name: 'Feb 2026', startIso: '2026-02-01', endIso: '2026-02-28', closed: false },
            { id: 'm2', name: 'Mar 2026', startIso: '2026-03-01', endIso: '2026-03-31', closed: false },
            { id: 'm3', name: 'Apr 2026', startIso: '2026-04-01', endIso: '2026-04-30', closed: false },
            { id: 'm4', name: 'Jun 2026', startIso: '2026-06-01', endIso: '2026-06-30', closed: false }
        ],
        quarterPeriods: [
            { id: 'q1', name: 'Q1 2026', startIso: '2026-01-01', endIso: '2026-03-31' },
            { id: 'q2', name: 'Q2 2026', startIso: '2026-04-01', endIso: '2026-06-30' }
        ],
        defaultAccountingPeriodIds: ['m2'],
        defaultQuarterPeriodIds: ['q1'],
        defaultRangeStartIso: '2026-03-01',
        defaultRangeEndIso: '2026-03-31',
        closedAccountingRanges: [{ startIso: '2026-01-01', endIso: '2026-01-31' }]
    };
}

function makeSampleData(overrides) {
    return Object.assign({
        columns: [
            { id: '6', name: 'Proposal', stage: 'OPPORTUNITY', probability: '50' },
            { id: '7', name: 'Negotiation', stage: 'OPPORTUNITY', probability: '75' },
            { id: '8', name: 'Closed Won', stage: 'CUSTOMER', probability: '100' },
            { id: '9', name: 'Closed Lost', stage: 'CUSTOMER', probability: '0' }
        ],
        opportunities: [
            {
                id: '100', tranid: 'OPP-001', companyname: 'Acme Corporation',
                entitystatus: '6', entitystatusText: 'Proposal', probability: '50.0%',
                expectedclosedate: '3/15/2026', closeDateGroup: 'THIS_MONTH THIS_QUARTER',
                projectedtotal: '150000', title: 'Deal A'
            },
            {
                id: '101', tranid: 'OPP-002', companyname: 'Global Industries International Corp',
                entitystatus: '7', entitystatusText: 'Negotiation', probability: '75.0%',
                expectedclosedate: '6/1/2026', closeDateGroup: 'NEXT_QUARTER',
                projectedtotal: '2500000', title: 'Deal B'
            },
            {
                id: '102', tranid: 'OPP-003', companyname: 'Won Corp',
                entitystatus: '8', entitystatusText: 'Closed Won', probability: '100.0%',
                expectedclosedate: '3/10/2026', closeDateGroup: 'THIS_MONTH THIS_QUARTER',
                projectedtotal: '75000', title: 'Won Deal'
            },
            {
                id: '103', tranid: 'OPP-004', companyname: 'Lost Inc',
                entitystatus: '9', entitystatusText: 'Closed Lost', probability: '0.0%',
                expectedclosedate: '3/5/2026', closeDateGroup: 'THIS_MONTH THIS_QUARTER',
                projectedtotal: '30000', title: 'Lost Deal'
            }
        ],
        userId: 42,
        ...samplePeriodFilters()
    }, overrides);
}

function loadClient() {
    jest.isolateModules(() => {
        require(CLIENT_PATH);
    });
}

/** True when handler only clicks the hidden apply hook (checkbox, search). */
function firesThroughApplyHookOnly(code) {
    return code.indexOf('kanban-filter-apply-hook') >= 0
        && code.indexOf('kanban-filter-mode') < 0
        && code.indexOf('kanban-period-dropdown') < 0
        && code.indexOf('data-period-id') < 0;
}

/** Fire inline portlet handler (production path). Delegates through apply-hook when present. */
function fireHandler(el, attr, evt) {
    var evtObj = evt || { stopPropagation() {} };
    var code = el.getAttribute(attr);
    if (code) {
        if (firesThroughApplyHookOnly(code)) {
            var hook = document.getElementById('kanban-filter-apply-hook');
            if (hook) {
                var hookCode = hook.getAttribute('onclick');
                if (hookCode) {
                    new Function('event', hookCode).call(hook, evtObj);
                }
            }
            return;
        }
        new Function('event', code).call(el, evtObj);
        return;
    }
    if (attr === 'oninput' && el.oninput) {
        el.oninput.call(el, evtObj);
    } else if (el.onclick) {
        el.onclick.call(el, evtObj);
    }
}

function setupDOM() {
    var root = document.createElement('div');
    root.id = 'kanban-board-container';
    var loading = document.createElement('div');
    loading.id = 'kanban-loading';
    loading.textContent = 'Loading...';
    root.appendChild(loading);
    document.body.appendChild(root);
}

function teardownDOM() {
    document.body.textContent = '';
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

describe('kanban-client initialization', () => {
    it('renders columns and cards from KANBAN_DATA', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        const container = document.getElementById('kanban-board-container');
        const columns = container.querySelectorAll('.kanban-column');
        expect(columns.length).toBe(4); // Proposal, Negotiation, Closed Won, Closed Lost

        const cards = container.querySelectorAll('.kanban-card');
        expect(cards.length).toBe(4);

        expect(container.querySelector('.kanban-card-tranid').textContent).toBe('OPP-001');
    });

    it('does not re-initialize if _kanbanInitialized is set', () => {
        window._kanbanInitialized = true;
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        const container = document.getElementById('kanban-board-container');
        expect(container.querySelector('#kanban-loading')).toBeTruthy();
    });

    it('shows empty message when no opportunities exist', () => {
        window.KANBAN_DATA = makeSampleData({ opportunities: [] });
        loadClient();

        const container = document.getElementById('kanban-board-container');
        expect(container.querySelector('.kanban-empty').textContent).toBe('No opportunities found.');
    });

    it('applies This Month filter by default on load', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        const cards = document.querySelectorAll('.kanban-card');
        // OPP-001, OPP-003, OPP-004 (THIS_MONTH) visible; OPP-002 (NEXT_QUARTER) hidden
        expect(cards[0].style.display).toBe('');
        expect(cards[1].style.display).toBe('none');
        expect(cards[2].style.display).toBe('');
        expect(cards[3].style.display).toBe('');
    });
});

describe('card display', () => {
    it('sets data-cg attribute for close date group (space-separated)', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        const cards = document.querySelectorAll('.kanban-card');
        expect(cards[0].getAttribute('data-cg')).toBe('THIS_MONTH THIS_QUARTER');
        expect(cards[1].getAttribute('data-cg')).toBe('NEXT_QUARTER');
    });

    it('truncates long company names', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        const companies = document.querySelectorAll('.kanban-card-company');
        const longCompany = Array.from(companies).find(el => el.textContent.includes('Global'));
        expect(longCompany.textContent).toContain('\u2026');
        expect(longCompany.textContent.length).toBeLessThanOrEqual(30);
    });

    it('formats currency values', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        const amounts = document.querySelectorAll('.kanban-card-amount');
        expect(amounts[0].textContent).toBe('$150K');
        expect(amounts[1].textContent).toBe('$2.5M');
    });

    it('shows probability percentage', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        const probs = document.querySelectorAll('.kanban-card-probability');
        expect(probs[0].textContent).toBe('50.0%');
    });

    it('shows probability with decimal precision from search value', () => {
        window.KANBAN_DATA = makeSampleData({
            opportunities: [{
                id: '100', tranid: 'OPP-001', companyname: 'Acme',
                entitystatus: '6', entitystatusText: 'Proposal', probability: '90.0%',
                expectedclosedate: '3/15/2026', closeDateGroup: 'THIS_MONTH THIS_QUARTER',
                projectedtotal: '150000', title: 'Deal A'
            }]
        });
        loadClient();

        expect(document.querySelector('.kanban-card-probability').textContent).toBe('90.0%');
    });

    it('shows column counts reflecting active filter', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        const counts = document.querySelectorAll('.kanban-column-count');
        // Default filter is THIS_MONTH: Proposal=1, Negotiation=0, Closed Won=1, Closed Lost=1
        expect(counts[0].textContent).toBe('1');
        expect(counts[1].textContent).toBe('0');
        expect(counts[2].textContent).toBe('1');
        expect(counts[3].textContent).toBe('1');
    });
});

describe('close date filters', () => {
    it('renders a single filter chip with period panel and date inputs', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        expect(document.getElementById('kanban-filter-trigger')).toBeTruthy();
        expect(document.getElementById('kanban-filter-chip-label')).toBeTruthy();
        expect(document.getElementById('kanban-filter-chip-value')).toBeTruthy();
        expect(document.getElementById('kanban-filter-chip-clear')).toBeTruthy();
        expect(document.getElementById('kanban-filter-mode-range')).toBeTruthy();
        expect(document.getElementById('kanban-acct-period-trigger')).toBeNull();
        expect(document.getElementById('kanban-quarter-period-trigger')).toBeNull();
        expect(document.querySelectorAll('.kanban-toolbar-filters .kanban-period-dropdown').length).toBe(1);
        expect(document.querySelectorAll('.kanban-period-cb[data-period-group="acct"]').length).toBe(4);
        expect(document.querySelectorAll('.kanban-period-cb[data-period-group="quarter"]').length).toBe(2);
        expect(document.getElementById('kanban-filter-range-list').contains(document.getElementById('kanban-date-start'))).toBe(true);
        expect(document.querySelector('.kanban-filter-date-section')).toBeNull();
        expect(document.querySelector('.kanban-filter-apply')).toBeNull();
    });

    it('period checkbox onclick triggers hidden apply hook (portlet-safe)', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        const onclick = document.querySelector('.kanban-period-cb').getAttribute('onclick');
        expect(onclick).toContain('kanban-filter-apply-hook');
        const hookOnclick = document.getElementById('kanban-filter-apply-hook').getAttribute('onclick');
        expect(hookOnclick).toContain('data-close-date');
        expect(hookOnclick).toContain('kpi-count');
    });

    it('closes period panels when clicking outside the dropdown', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        const panel = document.getElementById('kanban-filter-panel');
        const container = document.getElementById('kanban-board-container');
        const valueBefore = document.getElementById('kanban-filter-chip-value').textContent;
        panel.style.display = 'block';

        expect(container.getAttribute('onclick')).toContain('kanban-period-dropdown');
        expect(container.getAttribute('onclick')).toContain('kanban-filter-apply-hook');
        fireHandler(container, 'onclick', { target: document.querySelector('.kanban-column') });

        expect(panel.style.display).toBe('none');
        expect(document.getElementById('kanban-filter-chip-value').textContent).toBe(valueBefore);
    });

    it('keeps period panel open when clicking inside the dropdown', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        const panel = document.getElementById('kanban-filter-panel');
        const container = document.getElementById('kanban-board-container');
        panel.style.display = 'block';

        fireHandler(container, 'onclick', {
            target: document.querySelector('.kanban-period-cb')
        });

        expect(panel.style.display).toBe('block');
    });

    it('sets data-close-date on cards', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        const card = document.querySelector('.kanban-card[data-opp-id="100"]');
        expect(card.getAttribute('data-close-date')).toBe('2026-03-15');
    });

    it('defaults to current accounting period in accounting mode', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        const cards = document.querySelectorAll('.kanban-card');
        expect(cards[0].style.display).toBe('');
        expect(cards[1].style.display).toBe('none');
        expect(cards[2].style.display).toBe('');
        expect(cards[3].style.display).toBe('');
        expect(document.getElementById('kpi-count').textContent).toBe('3');
        expect(document.getElementById('kanban-filter-chip-label').textContent).toBe('Accounting');
        expect(document.getElementById('kanban-filter-chip-value').textContent).toBe('Mar 2026');
        expect(document.getElementById('kanban-filter-mode').value).toBe('acct');
    });

    it('uses only quarter periods when quarter mode is selected', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        fireHandler(document.getElementById('kanban-filter-mode-quarter'), 'onclick');

        const cards = document.querySelectorAll('.kanban-card');
        expect(cards[0].style.display).toBe('');
        expect(cards[1].style.display).toBe('none');
        expect(cards[2].style.display).toBe('');
        expect(cards[3].style.display).toBe('');
        expect(document.getElementById('kpi-count').textContent).toBe('3');
    });

    it('filters when accounting period checkboxes change', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        document.querySelectorAll('.kanban-period-cb').forEach((cb) => { cb.checked = false; });
        document.querySelector('.kanban-period-cb[data-period-group="acct"][data-start="2026-02-01"]').checked = true;
        fireHandler(document.querySelector('.kanban-period-cb[data-period-group="acct"][data-start="2026-02-01"]'), 'onclick');

        const cards = document.querySelectorAll('.kanban-card');
        expect(cards[0].style.display).toBe('none');
        expect(cards[1].style.display).toBe('none');
    });

    it('supports multi-select accounting periods (OR)', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        document.querySelector('.kanban-period-cb[data-period-group="acct"][data-start="2026-03-01"]').checked = true;
        document.querySelector('.kanban-period-cb[data-period-group="acct"][data-start="2026-06-01"]').checked = true;
        fireHandler(document.querySelector('.kanban-period-cb[data-period-group="acct"][data-start="2026-06-01"]'), 'onclick');

        const cards = document.querySelectorAll('.kanban-card');
        expect(cards[0].style.display).toBe('');
        expect(cards[1].style.display).toBe('');
    });

    it('filters by close date range in Close date tab when both dates are set', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        fireHandler(document.getElementById('kanban-filter-mode-range'), 'onclick');

        const start = document.getElementById('kanban-date-start');
        const end = document.getElementById('kanban-date-end');
        start.value = '2026-03-01';
        fireHandler(start, 'onchange');
        end.value = '2026-03-31';
        fireHandler(end, 'onchange');

        const cards = document.querySelectorAll('.kanban-card');
        expect(cards[0].style.display).toBe('');
        expect(cards[1].style.display).toBe('none');
        expect(document.getElementById('kpi-count').textContent).toBe('3');
        expect(document.getElementById('kanban-filter-chip-label').textContent).toBe('Close date');
        expect(document.getElementById('kanban-filter-chip-value').textContent).toContain('03/01/2026');
    });

    it('does not apply date range while in Accounting mode (mode-exclusive)', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        document.getElementById('kanban-date-start').value = '2026-06-01';
        document.getElementById('kanban-date-end').value = '2026-06-30';

        expect(document.querySelector('.kanban-card[data-opp-id="101"]').style.display).toBe('none');
    });

    it('clear control resets active tab to defaults', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        document.querySelectorAll('.kanban-period-cb[data-period-group="acct"]').forEach((cb) => { cb.checked = false; });
        document.querySelector('.kanban-period-cb[data-period-group="acct"][data-start="2026-06-01"]').checked = true;
        fireHandler(document.querySelector('.kanban-period-cb[data-period-group="acct"][data-start="2026-06-01"]'), 'onclick');

        fireHandler(document.getElementById('kanban-filter-chip-clear'), 'onclick');

        expect(document.getElementById('kanban-filter-chip-value').textContent).toBe('Mar 2026');
        expect(document.querySelector('.kanban-card[data-opp-id="101"]').style.display).toBe('none');
    });

    it('filter clear onclick is self-contained', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        const onclick = document.getElementById('kanban-filter-chip-clear').getAttribute('onclick');
        expect(onclick).toContain('data-period-id');
        expect(onclick).toContain('kanban-filter-apply-hook');
    });

    it('portlet filter keeps columns visible when status param is set', () => {
        window.KANBAN_DATA = makeSampleData({
            selectedStatusIds: ['6', '7', '8', '9'],
            allowedStatusIds: ['6', '7', '8', '9']
        });
        loadClient();

        const checkbox = document.querySelector('.kanban-period-cb');
        expect(checkbox.getAttribute('onclick')).toContain('kanban-filter-apply-hook');
        fireHandler(checkbox, 'onclick');

        document.querySelectorAll('.kanban-column').forEach((col) => {
            expect(col.style.display).not.toBe('none');
        });
    });

    it('hides columns with no visible cards', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        const cols = document.querySelectorAll('.kanban-column');
        expect(cols[0].style.display).toBe('');
        expect(cols[1].style.display).toBe('none');
        expect(cols[2].style.display).toBe('');
        expect(cols[3].style.display).toBe('');
    });
});

describe('click-through', () => {
    it('renders tranid as an anchor linking to opportunity record', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        const link = document.querySelector('.kanban-card-tranid');
        expect(link.tagName).toBe('A');
        expect(link.href).toContain('/app/accounting/transactions/opprtnty.nl?id=100');
        expect(link.target).toBe('_blank');
    });

    it('card has data-opp-id for click handler', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        const card = document.querySelector('.kanban-card');
        expect(card.getAttribute('data-opp-id')).toBe('100');
    });

    it('card onclick is self-contained with numeric validation', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        const card = document.querySelector('.kanban-card');
        const onclick = card.getAttribute('onclick');
        expect(onclick).toContain('data-opp-id');
        expect(onclick).toContain('/app/accounting/transactions/opprtnty.nl');
        expect(onclick).toContain('\\d+');
        expect(onclick).not.toContain('_kanbanCardClick');
    });
});

describe('KPI cards', () => {
    it('renders KPI row with 4 metrics', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        const kpiRow = document.querySelector('.kanban-kpi-row');
        expect(kpiRow).toBeTruthy();
        expect(kpiRow.querySelectorAll('.kanban-kpi-item').length).toBe(4);
        expect(kpiRow.querySelector('.kanban-kpi-item .kanban-kpi-label').textContent).toBe('Opportunities');
        expect(document.getElementById('kpi-count')).toBeTruthy();
    });

    it('KPI row appears above the filter toolbar', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        const container = document.getElementById('kanban-board-container');
        const children = Array.from(container.children);
        const kpiIndex = children.findIndex(el => el.classList.contains('kanban-kpi-row'));
        const toolbarIndex = children.findIndex(el => el.classList.contains('kanban-toolbar'));
        expect(kpiIndex).toBeLessThan(toolbarIndex);
    });

    it('shows correct KPI values after default THIS_MONTH filter', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        // THIS_MONTH visible: OPP-001 (Proposal, $150,000), OPP-003 (Closed Won, $75,000), OPP-004 (Closed Lost, $30,000)
        expect(document.getElementById('kpi-count').textContent).toBe('3');
        expect(document.getElementById('kpi-open').textContent).toBe('$150,000');
        expect(document.getElementById('kpi-won').textContent).toBe('$75,000');
        expect(document.getElementById('kpi-lost').textContent).toBe('$30,000');
    });

    it('updates KPI values when filter changes', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        document.querySelectorAll('.kanban-period-cb').forEach((cb) => { cb.checked = false; });
        document.querySelector('.kanban-period-cb[data-period-group="acct"][data-start="2026-06-01"]').checked = true;
        fireHandler(document.querySelector('.kanban-period-cb[data-period-group="acct"][data-start="2026-06-01"]'), 'onclick');

        expect(document.getElementById('kpi-count').textContent).toBe('1');
        expect(document.getElementById('kpi-open').textContent).toBe('$2,500,000');
        expect(document.getElementById('kpi-won').textContent).toBe('$0');
        expect(document.getElementById('kpi-lost').textContent).toBe('$0');
    });

    it('sets data-amount and data-status-type on cards', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        const cards = document.querySelectorAll('.kanban-card');
        // OPP-001: Proposal (open), $150000
        expect(cards[0].getAttribute('data-amount')).toBe('150000');
        expect(cards[0].getAttribute('data-status-type')).toBe('open');
        // OPP-002: Negotiation (open), $2500000
        expect(cards[1].getAttribute('data-amount')).toBe('2500000');
        expect(cards[1].getAttribute('data-status-type')).toBe('open');
        // OPP-003: Closed Won, $75000
        expect(cards[2].getAttribute('data-amount')).toBe('75000');
        expect(cards[2].getAttribute('data-status-type')).toBe('won');
        // OPP-004: Closed Lost, $30000
        expect(cards[3].getAttribute('data-amount')).toBe('30000');
        expect(cards[3].getAttribute('data-status-type')).toBe('lost');
    });

    it('classifies status text variations correctly', () => {
        window.KANBAN_DATA = makeSampleData({
            columns: [
                { id: '10', name: 'Closed - Won' },
                { id: '11', name: 'Closed - Lost' }
            ],
            opportunities: [
                {
                    id: '200', tranid: 'OPP-W', companyname: 'A',
                    entitystatus: '10', entitystatusText: 'Closed - Won', probability: '100.0%',
                    expectedclosedate: '3/1/2026', closeDateGroup: 'THIS_MONTH',
                    projectedtotal: '10000', title: 'W'
                },
                {
                    id: '201', tranid: 'OPP-L', companyname: 'B',
                    entitystatus: '11', entitystatusText: 'Closed - Lost', probability: '0.0%',
                    expectedclosedate: '3/1/2026', closeDateGroup: 'THIS_MONTH',
                    projectedtotal: '5000', title: 'L'
                }
            ]
        });
        loadClient();

        const cards = document.querySelectorAll('.kanban-card');
        expect(cards[0].getAttribute('data-status-type')).toBe('won');
        expect(cards[1].getAttribute('data-status-type')).toBe('lost');
    });

    it('period filter applyFilters updates KPI counts', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        document.querySelectorAll('.kanban-period-cb').forEach((cb) => { cb.checked = false; });
        document.querySelector('.kanban-period-cb[data-period-group="acct"][data-start="2026-06-01"]').checked = true;
        fireHandler(document.querySelector('.kanban-period-cb[data-period-group="acct"][data-start="2026-06-01"]'), 'onclick');

        expect(document.getElementById('kpi-count').textContent).toBe('1');
    });
});

describe('expand board', () => {
    it('renders expand button on the filter toolbar (right aligned)', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        const toolbar = document.querySelector('.kanban-toolbar');
        const btn = document.querySelector('.kanban-expand-btn');
        expect(toolbar).toBeTruthy();
        expect(btn).toBeTruthy();
        expect(btn.parentNode).toBe(toolbar);
        expect(toolbar.lastElementChild).toBe(btn);
        expect(document.querySelector('.kanban-chrome-bar')).toBeNull();
        expect(btn.getAttribute('role')).toBe('button');
        expect(btn.textContent).toBe('Expand');
    });

    it('inline expand onclick toggles overlay class and backdrop', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        const container = document.getElementById('kanban-board-container');
        const backdrop = document.getElementById('kanban-board-backdrop');
        const btn = document.querySelector('.kanban-expand-btn');
        const onclick = btn.getAttribute('onclick');

        expect(onclick).not.toMatch(/"/);
        expect(onclick).toContain('kanban-board-expanded');
        expect(onclick).toContain('kanban-board-backdrop');

        new Function('event', onclick).call(btn, {});
        expect(container.classList.contains('kanban-board-expanded')).toBe(true);
        expect(backdrop.style.display).toBe('block');
        expect(btn.textContent).toBe('Close');

        new Function('event', onclick).call(btn, {});
        expect(container.classList.contains('kanban-board-expanded')).toBe(false);
        expect(backdrop.style.display).toBe('none');
        expect(btn.textContent).toBe('Expand');
    });
});

describe('drag and drop attribute strings', () => {
    it('sets draggable and ondrop when updateUrl is present', () => {
        window.KANBAN_DATA = makeSampleData({
            updateUrl: '/app/site/hosting/scriptlet.nl?script=99&deploy=1',
            allowedStatusIds: ['6', '7'],
            selectedStatusIds: ['6', '7']
        });
        loadClient();
        const card = document.querySelector('.kanban-card');
        expect(card.getAttribute('draggable')).toBe('true');
        expect(card.getAttribute('ondragstart')).toContain('dataTransfer');
        const body = document.querySelector('.kanban-column-body');
        expect(body.getAttribute('ondrop')).toContain('fetch(');
        expect(body.getAttribute('ondrop')).not.toContain('window.');
        expect(body.getAttribute('ondrop')).not.toMatch(/"/);
        expect(body.getAttribute('ondrop')).toContain("getAttribute('data-opp-id')===oid");
        expect(card.getAttribute('ondragend')).toContain("kanban-drop-hover");
    });

    it('moves the card to the target column immediately on drop (before save completes)', () => {
        window.KANBAN_DATA = makeSampleData({
            updateUrl: '/app/site/hosting/scriptlet.nl?script=99&deploy=1',
            allowedStatusIds: ['6', '7'],
            selectedStatusIds: ['6', '7']
        });
        loadClient();

        let resolveFetch;
        global.fetch = jest.fn().mockReturnValue(new Promise((resolve) => {
            resolveFetch = resolve;
        }));

        const card = document.querySelector('.kanban-card[data-opp-id="100"]');
        const targetBody = document.querySelector('.kanban-column[data-status="7"] .kanban-column-body');
        const ondrop = targetBody.getAttribute('ondrop');
        new Function('event', ondrop).call(targetBody, {
            preventDefault() {},
            stopPropagation() {},
            dataTransfer: { getData: () => '100' }
        });

        expect(card.parentNode).toBe(targetBody);
        expect(card.getAttribute('data-saving')).toBe('1');

        resolveFetch({ json: () => Promise.resolve({ ok: true, entitystatusText: 'Negotiation' }) });
        delete global.fetch;
    });

    it('ondrop recounts only visible cards for active filter', async () => {
        window.KANBAN_DATA = makeSampleData({
            columns: [
                { id: '6', name: 'Proposal' },
                { id: '7', name: 'Negotiation' }
            ],
            opportunities: [
                {
                    id: '100', tranid: 'OPP-001', companyname: 'Near Corp',
                    entitystatus: '6', entitystatusText: 'Proposal', probability: '50.0%',
                    expectedclosedate: '2/15/2026', closeDateGroup: 'THIS_MONTH THIS_QUARTER',
                    projectedtotal: '10000', title: 'Near'
                },
                {
                    id: '101', tranid: 'OPP-002', companyname: 'Quarter Corp',
                    entitystatus: '6', entitystatusText: 'Proposal', probability: '25.0%',
                    expectedclosedate: '3/15/2026', closeDateGroup: 'THIS_QUARTER',
                    projectedtotal: '50000', title: 'Quarter'
                }
            ],
            selectedStatusIds: ['6', '7'],
            allowedStatusIds: ['6', '7'],
            updateUrl: '/app/site/hosting/scriptlet.nl?script=99&deploy=1'
        });
        loadClient();

        global.fetch = jest.fn().mockResolvedValue({
            json: () => Promise.resolve({ ok: true, entitystatusText: 'Negotiation' })
        });

        const sourceCount = document.querySelector('.kanban-column[data-status="6"] .kanban-column-count');
        expect(sourceCount.textContent).toBe('1');

        const targetBody = document.querySelector('.kanban-column[data-status="7"] .kanban-column-body');
        const ondrop = targetBody.getAttribute('ondrop');
        new Function('event', ondrop).call(targetBody, {
            preventDefault() {},
            stopPropagation() {},
            dataTransfer: { getData: () => '101' }
        });

        await new Promise((resolve) => { setTimeout(resolve, 0); });

        expect(sourceCount.textContent).toBe('0');
        expect(document.querySelector('.kanban-column[data-status="7"] .kanban-column-count').textContent).toBe('1');

        delete global.fetch;
    });

    it('updates card status and probability after drop using preserved format', async () => {
        window.KANBAN_DATA = makeSampleData({
            updateUrl: '/app/site/hosting/scriptlet.nl?script=99&deploy=1',
            allowedStatusIds: ['6', '7', '8'],
            selectedStatusIds: ['6', '7', '8'],
            opportunities: [{
                id: '100', tranid: 'OPP-001', companyname: 'Acme',
                entitystatus: '6', entitystatusText: 'Proposal', probability: '90.0%',
                expectedclosedate: '3/15/2026', closeDateGroup: 'THIS_MONTH THIS_QUARTER',
                projectedtotal: '150000', title: 'Deal A'
            }]
        });
        loadClient();

        const card = document.querySelector('.kanban-card[data-opp-id="100"]');
        expect(card.getAttribute('data-entitystatus')).toBe('6');
        const probEl = card.querySelector('.kanban-card-probability');
        expect(probEl.textContent).toBe('90.0%');

        global.fetch = jest.fn().mockResolvedValue({
            json: () => Promise.resolve({ ok: true, entitystatusText: 'Closed Won', probability: '100.0%' })
        });

        const targetBody = document.querySelector('.kanban-column[data-status="8"] .kanban-column-body');
        const ondrop = targetBody.getAttribute('ondrop');
        new Function('event', ondrop).call(targetBody, {
            preventDefault() {},
            stopPropagation() {},
            dataTransfer: { getData: () => '100' }
        });

        await global.fetch.mock.results[0].value.then(function (r) { return r.json(); });
        await new Promise(function (resolve) { setTimeout(resolve, 0); });

        expect(card.getAttribute('data-entitystatus')).toBe('8');
        expect(card.getAttribute('data-status-type')).toBe('won');
        expect(probEl.textContent).toBe('100.0%');

        delete global.fetch;
    });

    it('leaves probability badge unchanged when save response omits probability', async () => {
        window.KANBAN_DATA = makeSampleData({
            updateUrl: '/app/site/hosting/scriptlet.nl?script=99&deploy=1',
            allowedStatusIds: ['6', '7'],
            selectedStatusIds: ['6', '7']
        });
        loadClient();

        const probEl = document.querySelector('.kanban-card-probability');
        expect(probEl.textContent).toBe('50.0%');

        global.fetch = jest.fn().mockResolvedValue({
            json: () => Promise.resolve({ ok: true, entitystatusText: 'Negotiation' })
        });

        const targetBody = document.querySelector('.kanban-column[data-status="7"] .kanban-column-body');
        new Function('event', targetBody.getAttribute('ondrop')).call(targetBody, {
            preventDefault() {},
            stopPropagation() {},
            dataTransfer: { getData: () => '100' }
        });

        await global.fetch.mock.results[0].value.then(function (r) { return r.json(); });
        await new Promise(function (resolve) { setTimeout(resolve, 0); });

        expect(probEl.textContent).toBe('50.0%');

        delete global.fetch;
    });

    it('ondrop sets probability badge from suitelet display text without reformatting', () => {
        window.KANBAN_DATA = makeSampleData({
            updateUrl: '/app/site/hosting/scriptlet.nl?script=99&deploy=1'
        });
        loadClient();

        const ondrop = document.querySelector('.kanban-column-body').getAttribute('ondrop');
        expect(ondrop).toContain('prEl.textContent=String(d.probability)');
        expect(ondrop).not.toContain("+'%'");
    });

    it('ondrop string includes KPI recalculation', () => {
        window.KANBAN_DATA = makeSampleData({
            updateUrl: '/app/site/hosting/scriptlet.nl?script=99&deploy=1',
            allowedStatusIds: ['6', '7', '8', '9'],
            selectedStatusIds: ['6', '7', '8', '9']
        });
        loadClient();

        const ondrop = document.querySelector('.kanban-column[data-status="8"] .kanban-column-body').getAttribute('ondrop');
        expect(ondrop).toContain('kpi-count');
        expect(ondrop).toContain('kpi-open');
        expect(ondrop).toContain('data-status-type');
        expect(ondrop).not.toMatch(/"/);
    });

    it('updates KPI totals after successful drop save', async () => {
        window.KANBAN_DATA = makeSampleData({
            updateUrl: '/app/site/hosting/scriptlet.nl?script=99&deploy=1',
            allowedStatusIds: ['6', '7', '8', '9'],
            selectedStatusIds: ['6', '7', '8', '9']
        });
        loadClient();

        expect(document.getElementById('kpi-count').textContent).toBe('3');
        expect(document.getElementById('kpi-open').textContent).toBe('$150,000');
        expect(document.getElementById('kpi-won').textContent).toBe('$75,000');
        expect(document.getElementById('kpi-lost').textContent).toBe('$30,000');

        global.fetch = jest.fn().mockResolvedValue({
            json: () => Promise.resolve({ ok: true, entitystatusText: 'Closed Won' })
        });

        const targetBody = document.querySelector('.kanban-column[data-status="8"] .kanban-column-body');
        const ondrop = targetBody.getAttribute('ondrop');
        new Function('event', ondrop).call(targetBody, {
            preventDefault() {},
            stopPropagation() {},
            dataTransfer: { getData: () => '100' }
        });

        await global.fetch.mock.results[0].value.then(function (r) { return r.json(); });
        await new Promise(function (resolve) { setTimeout(resolve, 0); });

        expect(document.getElementById('kpi-count').textContent).toBe('3');
        expect(document.getElementById('kpi-open').textContent).toBe('$0');
        expect(document.getElementById('kpi-won').textContent).toBe('$225,000');
        expect(document.getElementById('kpi-lost').textContent).toBe('$30,000');

        delete global.fetch;
    });

    it('ondrop recalculates KPIs only once on successful save path', () => {
        window.KANBAN_DATA = makeSampleData({
            updateUrl: '/app/site/hosting/scriptlet.nl?script=99&deploy=1',
            allowedStatusIds: ['6', '7', '8', '9'],
            selectedStatusIds: ['6', '7', '8', '9']
        });
        loadClient();

        const ondrop = document.querySelector('.kanban-column[data-status="8"] .kanban-column-body').getAttribute('ondrop');
        const statusTypeIdx = ondrop.indexOf("card.setAttribute('data-status-type',tp);");
        const kpiIdx = ondrop.indexOf('kpi-open');
        expect(statusTypeIdx).toBeGreaterThan(-1);
        expect(kpiIdx).toBeGreaterThan(statusTypeIdx);
        expect((ondrop.match(/kpi-open/g) || []).length).toBe(1);
    });

    it('ondrop blocks cards in closed accounting periods', () => {
        window.KANBAN_DATA = makeSampleData({
            updateUrl: '/app/site/hosting/scriptlet.nl?script=99&deploy=1',
            allowedStatusIds: ['6', '7'],
            selectedStatusIds: ['6', '7'],
            opportunities: [
                {
                    id: '100', tranid: 'OPP-001', companyname: 'Locked Corp',
                    entitystatus: '6', entitystatusText: 'Proposal', probability: '50.0%',
                    expectedclosedate: '1/15/2026', closeDateGroup: 'THIS_MONTH',
                    projectedtotal: '10000', title: 'Locked', isInClosedPeriod: true
                }
            ],
            columns: [
                { id: '6', name: 'Proposal' },
                { id: '7', name: 'Negotiation' }
            ]
        });
        loadClient();

        const card = document.querySelector('.kanban-card');
        expect(card.getAttribute('draggable')).toBeNull();
        expect(card.getAttribute('data-period-locked')).toBe('1');

        global.fetch = jest.fn();
        window.alert = jest.fn();
        const targetBody = document.querySelector('.kanban-column[data-status="7"] .kanban-column-body');
        const ondrop = targetBody.getAttribute('ondrop');
        expect(ondrop).toContain('data-period-locked');
        new Function('event', ondrop).call(targetBody, {
            preventDefault() {},
            stopPropagation() {},
            dataTransfer: { getData: () => '100' }
        });
        expect(global.fetch).not.toHaveBeenCalled();
        delete global.fetch;
        delete window.alert;
    });

    it('renders empty param-driven columns', () => {
        window.KANBAN_DATA = makeSampleData({
            columns: [
                { id: '6', name: 'Proposal' },
                { id: '7', name: 'Negotiation' }
            ],
            opportunities: makeSampleData().opportunities.filter((o) => o.entitystatus === '6'),
            selectedStatusIds: ['6', '7'],
            allowedStatusIds: ['6', '7'],
            updateUrl: '/app/site/hosting/scriptlet.nl?script=99&deploy=1'
        });
        loadClient();
        expect(document.querySelectorAll('.kanban-column')).toHaveLength(2);
    });
});

describe('filter chip UX', () => {
    it('places search input to the right of the period filter chip', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        const filters = document.querySelector('.kanban-toolbar-filters');
        const children = Array.from(filters.children);
        expect(children[0].classList.contains('kanban-period-dropdown')).toBe(true);
        expect(children[1].id).toBe('kanban-search');
    });

    it('chip separator has no pipe character', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();
        const sep = document.getElementById('kanban-filter-chip-sep');
        expect(sep.textContent).toBe('');
    });

    it('renders hidden filter apply hook for portlet-safe handlers', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();
        const hook = document.getElementById('kanban-filter-apply-hook');
        expect(hook).toBeTruthy();
        expect(hook.getAttribute('onclick')).toContain('kanban-filter-chip-value');
    });

    it('filter trigger opens panel via self-contained onclick', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();
        const panel = document.getElementById('kanban-filter-panel');
        expect(panel.style.display).toBe('none');
        fireHandler(document.getElementById('kanban-filter-trigger'), 'onclick');
        expect(panel.style.display).toBe('block');
    });

    it('switching to Close date fills default range when inputs are empty', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();
        fireHandler(document.getElementById('kanban-filter-mode-range'), 'onclick');
        expect(document.getElementById('kanban-date-start').value).toBe('2026-03-01');
        expect(document.getElementById('kanban-date-end').value).toBe('2026-03-31');
    });

    it('search input filters cards by tranid and company', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();
        document.querySelectorAll('.kanban-period-cb').forEach((cb) => { cb.checked = false; });
        const search = document.getElementById('kanban-search');
        search.value = 'acme';
        fireHandler(search, 'oninput');
        const cards = document.querySelectorAll('.kanban-card');
        expect(cards[0].style.display).toBe('');
        expect(cards[1].style.display).toBe('none');
    });

    it('period checkbox onclick filters cards via apply hook', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();
        document.querySelectorAll('.kanban-period-cb').forEach((box) => { box.checked = false; });
        const cb = document.querySelector('.kanban-period-cb[data-period-id="m4"]');
        expect(cb.getAttribute('onclick')).toContain('kanban-filter-apply-hook');
        cb.checked = true;
        fireHandler(cb, 'onclick');
        expect(document.querySelector('.kanban-card[data-opp-id="100"]').style.display).toBe('none');
        expect(document.querySelector('.kanban-card[data-opp-id="101"]').style.display).toBe('');
    });

    it('click-outside dismiss re-applies filters and keeps default period on chip', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        fireHandler(document.getElementById('kanban-filter-trigger'), 'onclick');
        document.getElementById('kanban-filter-panel').style.display = 'block';

        document.querySelectorAll('.kanban-period-cb[data-period-group="acct"]').forEach((cb) => {
            cb.checked = false;
        });

        const container = document.getElementById('kanban-board-container');
        expect(container.getAttribute('onclick')).toContain('kanban-filter-apply-hook');

        fireHandler(container, 'onclick', { target: document.querySelector('.kanban-columns') });

        expect(document.getElementById('kanban-filter-chip-value').textContent).toBe('Mar 2026');
        expect(document.querySelector('.kanban-period-cb[data-period-group="acct"]:checked')).toBeTruthy();
    });

    it('sets checked attribute on default accounting period at build', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();
        const defaultCb = document.querySelector(
            '.kanban-period-cb[data-period-group="acct"][data-period-id="m2"]'
        );
        expect(defaultCb.checked).toBe(true);
        expect(defaultCb.hasAttribute('checked')).toBe(true);
    });

    it('shows checked attribute when filter panel opens on first click', () => {
        jest.useFakeTimers();
        window.KANBAN_DATA = makeSampleData();
        loadClient();
        const defaultCb = document.querySelector(
            '.kanban-period-cb[data-period-group="acct"][data-period-id="m2"]'
        );
        defaultCb.removeAttribute('checked');
        Object.defineProperty(defaultCb, 'clientHeight', {
            configurable: true,
            get() { return 160; }
        });
        const list = document.getElementById('kanban-filter-acct-list');
        Object.defineProperty(list, 'clientHeight', {
            configurable: true,
            get() { return 160; }
        });
        fireHandler(document.getElementById('kanban-filter-trigger'), 'onclick');
        jest.advanceTimersByTime(0);
        expect(defaultCb.hasAttribute('checked')).toBe(true);
        expect(defaultCb.checked).toBe(true);
        jest.useRealTimers();
    });

    it('scrolls checked period into view when filter panel opens', () => {
        jest.useFakeTimers();
        window.KANBAN_DATA = makeSampleData();
        loadClient();
        const list = document.getElementById('kanban-filter-acct-list');
        Object.defineProperty(list, 'clientHeight', {
            configurable: true,
            get() { return 160; }
        });
        let scrollTopSet = false;
        Object.defineProperty(list, 'scrollTop', {
            configurable: true,
            get() { return 0; },
            set() { scrollTopSet = true; }
        });
        fireHandler(document.getElementById('kanban-filter-trigger'), 'onclick');
        jest.advanceTimersByTime(0);
        expect(scrollTopSet).toBe(true);
        jest.useRealTimers();
    });
});
