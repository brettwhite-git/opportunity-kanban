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
                entitystatus: '6', entitystatusText: 'Proposal', probability: '50',
                expectedclosedate: '3/15/2026', closeDateGroup: 'THIS_MONTH THIS_QUARTER',
                projectedtotal: '150000', title: 'Deal A'
            },
            {
                id: '101', tranid: 'OPP-002', companyname: 'Global Industries International Corp',
                entitystatus: '7', entitystatusText: 'Negotiation', probability: '75',
                expectedclosedate: '6/1/2026', closeDateGroup: 'NEXT_QUARTER',
                projectedtotal: '2500000', title: 'Deal B'
            },
            {
                id: '102', tranid: 'OPP-003', companyname: 'Won Corp',
                entitystatus: '8', entitystatusText: 'Closed Won', probability: '100',
                expectedclosedate: '3/10/2026', closeDateGroup: 'THIS_MONTH THIS_QUARTER',
                projectedtotal: '75000', title: 'Won Deal'
            },
            {
                id: '103', tranid: 'OPP-004', companyname: 'Lost Inc',
                entitystatus: '9', entitystatusText: 'Closed Lost', probability: '0',
                expectedclosedate: '3/5/2026', closeDateGroup: 'THIS_MONTH THIS_QUARTER',
                projectedtotal: '30000', title: 'Lost Deal'
            }
        ],
        userId: 42
    }, overrides);
}

function loadClient() {
    jest.isolateModules(() => {
        require(CLIENT_PATH);
    });
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
        expect(probs[0].textContent).toBe('50%');
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

describe('date filter', () => {
    it('renders Quick Filter buttons as divs with role="button"', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        const buttons = document.querySelectorAll('.kanban-filter-btn');
        expect(buttons.length).toBe(4);
        expect(buttons[0].textContent).toBe('This Month');
        expect(buttons[1].textContent).toBe('This Quarter');
        expect(buttons[2].textContent).toBe('Next Quarter');
        expect(buttons[3].textContent).toBe('Last Quarter');
        expect(buttons[0].tagName).toBe('DIV');
        expect(buttons[0].getAttribute('role')).toBe('button');
        expect(buttons[0].getAttribute('tabindex')).toBe('0');
        expect(buttons[0].classList.contains('active')).toBe(true);
    });

    it('has self-contained onclick attribute (no function references)', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        const btn = document.querySelector('.kanban-filter-btn[data-filter="THIS_MONTH"]');
        const onclick = btn.getAttribute('onclick');
        expect(onclick).toContain("var f='THIS_MONTH'");
        expect(onclick).toContain('querySelectorAll');
        expect(onclick).toContain('data-cg');
        expect(onclick).toContain('indexOf');
        // Must NOT reference any custom function
        expect(onclick).not.toContain('_kanbanFilter');
        expect(onclick).not.toContain('_kanbanCardClick');
    });

    it('sets aria-pressed on active filter button', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        const buttons = document.querySelectorAll('.kanban-filter-btn');
        // This Month is default active
        expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
        expect(buttons[1].getAttribute('aria-pressed')).toBe('false');
    });

    it('filters cards when switching filters', () => {
        window.KANBAN_DATA = makeSampleData({
            opportunities: [
                {
                    id: '100', tranid: 'OPP-001', companyname: 'Near Corp',
                    entitystatus: '6', entitystatusText: 'Proposal', probability: '50',
                    expectedclosedate: '2/15/2026', closeDateGroup: 'THIS_MONTH THIS_QUARTER',
                    projectedtotal: '10000', title: 'Near'
                },
                {
                    id: '101', tranid: 'OPP-002', companyname: 'Quarter Corp',
                    entitystatus: '6', entitystatusText: 'Proposal', probability: '25',
                    expectedclosedate: '3/15/2026', closeDateGroup: 'THIS_QUARTER',
                    projectedtotal: '50000', title: 'Quarter'
                }
            ]
        });
        loadClient();

        var cards = document.querySelectorAll('.kanban-card');
        // Default THIS_MONTH filter: Near visible (has THIS_MONTH), Quarter hidden
        expect(cards[0].style.display).toBe('');
        expect(cards[1].style.display).toBe('none');

        // Switch to THIS_QUARTER — both visible (inclusive)
        document.querySelector('.kanban-filter-btn[data-filter="THIS_QUARTER"]').click();
        expect(cards[0].style.display).toBe('');
        expect(cards[1].style.display).toBe('');
    });

    it('inclusive filter shows card in multiple groups', () => {
        window.KANBAN_DATA = makeSampleData({
            opportunities: [
                {
                    id: '100', tranid: 'OPP-001', companyname: 'Both Corp',
                    entitystatus: '6', entitystatusText: 'Proposal', probability: '50',
                    expectedclosedate: '2/15/2026', closeDateGroup: 'THIS_MONTH THIS_QUARTER',
                    projectedtotal: '10000', title: 'Both'
                }
            ]
        });
        loadClient();

        var card = document.querySelector('.kanban-card');

        // Visible under THIS_MONTH (default)
        expect(card.style.display).toBe('');

        // Visible under THIS_QUARTER too
        document.querySelector('.kanban-filter-btn[data-filter="THIS_QUARTER"]').click();
        expect(card.style.display).toBe('');

        // Hidden under NEXT_QUARTER
        document.querySelector('.kanban-filter-btn[data-filter="NEXT_QUARTER"]').click();
        expect(card.style.display).toBe('none');
    });

    it('updates column counts on filter', () => {
        window.KANBAN_DATA = makeSampleData({
            opportunities: [
                {
                    id: '100', tranid: 'OPP-001', companyname: 'Near Corp',
                    entitystatus: '6', entitystatusText: 'Proposal', probability: '50',
                    expectedclosedate: '2/15/2026', closeDateGroup: 'THIS_MONTH THIS_QUARTER',
                    projectedtotal: '10000', title: 'Near'
                },
                {
                    id: '101', tranid: 'OPP-002', companyname: 'Quarter Corp',
                    entitystatus: '6', entitystatusText: 'Proposal', probability: '25',
                    expectedclosedate: '3/15/2026', closeDateGroup: 'THIS_QUARTER',
                    projectedtotal: '50000', title: 'Quarter'
                }
            ]
        });
        loadClient();

        // Default THIS_MONTH: 1 card visible
        expect(document.querySelector('.kanban-column-count').textContent).toBe('1');

        // Switch to THIS_QUARTER: 2 cards visible
        document.querySelector('.kanban-filter-btn[data-filter="THIS_QUARTER"]').click();
        expect(document.querySelector('.kanban-column-count').textContent).toBe('2');
    });

    it('inline onclick filter keeps columns visible when status param is set', () => {
        window.KANBAN_DATA = makeSampleData({
            selectedStatusIds: ['6', '7', '8', '9'],
            allowedStatusIds: ['6', '7', '8', '9']
        });
        loadClient();

        const btn = document.querySelector('.kanban-filter-btn[data-filter="THIS_QUARTER"]');
        const onclick = btn.getAttribute('onclick');
        expect(onclick).toContain("cols[k].style.display=(hideEmpty&&n===0)?'none':''");

        new Function('event', onclick).call(btn, {});

        const columns = document.querySelectorAll('.kanban-column');
        expect(columns.length).toBeGreaterThan(0);
        columns.forEach((col) => {
            expect(col.style.display).not.toBe('none');
        });
    });

    it('highlights the active filter button', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        // Default: This Month is active
        var activeBtn = document.querySelector('.kanban-filter-btn.active');
        expect(activeBtn.getAttribute('data-filter')).toBe('THIS_MONTH');

        // Switch to Next Quarter
        document.querySelector('.kanban-filter-btn[data-filter="NEXT_QUARTER"]').click();
        activeBtn = document.querySelector('.kanban-filter-btn.active');
        expect(activeBtn.getAttribute('data-filter')).toBe('NEXT_QUARTER');
        expect(activeBtn.getAttribute('aria-pressed')).toBe('true');
    });

    it('hides columns with no visible cards', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        // Default THIS_MONTH: Proposal visible, Negotiation hidden, Closed Won visible, Closed Lost visible
        var cols = document.querySelectorAll('.kanban-column');
        expect(cols[0].style.display).toBe('');      // Proposal (has THIS_MONTH card)
        expect(cols[1].style.display).toBe('none');   // Negotiation (only NEXT_QUARTER)
        expect(cols[2].style.display).toBe('');       // Closed Won (THIS_MONTH)
        expect(cols[3].style.display).toBe('');       // Closed Lost (THIS_MONTH)
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
    it('renders KPI row with 3 cards', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        const kpiRow = document.querySelector('.kanban-kpi-row');
        expect(kpiRow).toBeTruthy();
        expect(kpiRow.querySelectorAll('.kanban-kpi-card').length).toBe(3);
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
        expect(document.getElementById('kpi-open').textContent).toBe('$150,000');
        expect(document.getElementById('kpi-won').textContent).toBe('$75,000');
        expect(document.getElementById('kpi-lost').textContent).toBe('$30,000');
    });

    it('updates KPI values when filter changes', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        // Switch to NEXT_QUARTER — only OPP-002 (Negotiation, $2,500,000, open)
        document.querySelector('.kanban-filter-btn[data-filter="NEXT_QUARTER"]').click();
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
                    entitystatus: '10', entitystatusText: 'Closed - Won', probability: '100',
                    expectedclosedate: '3/1/2026', closeDateGroup: 'THIS_MONTH',
                    projectedtotal: '10000', title: 'W'
                },
                {
                    id: '201', tranid: 'OPP-L', companyname: 'B',
                    entitystatus: '11', entitystatusText: 'Closed - Lost', probability: '0',
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

    it('filter onclick string includes KPI recalculation', () => {
        window.KANBAN_DATA = makeSampleData();
        loadClient();

        const btn = document.querySelector('.kanban-filter-btn[data-filter="THIS_MONTH"]');
        const onclick = btn.getAttribute('onclick');
        expect(onclick).toContain('data-status-type');
        expect(onclick).toContain('kpi-open');
        expect(onclick).toContain('kpi-won');
        expect(onclick).toContain('kpi-lost');
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

    it('ondrop recounts only visible cards for active filter', () => {
        window.KANBAN_DATA = makeSampleData({
            columns: [
                { id: '6', name: 'Proposal' },
                { id: '7', name: 'Negotiation' }
            ],
            opportunities: [
                {
                    id: '100', tranid: 'OPP-001', companyname: 'Near Corp',
                    entitystatus: '6', entitystatusText: 'Proposal', probability: '50',
                    expectedclosedate: '2/15/2026', closeDateGroup: 'THIS_MONTH THIS_QUARTER',
                    projectedtotal: '10000', title: 'Near'
                },
                {
                    id: '101', tranid: 'OPP-002', companyname: 'Quarter Corp',
                    entitystatus: '6', entitystatusText: 'Proposal', probability: '25',
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
            dataTransfer: { getData: () => '100' }
        });

        expect(sourceCount.textContent).toBe('0');
        expect(document.querySelector('.kanban-column[data-status="7"] .kanban-column-count').textContent).toBe('1');

        delete global.fetch;
    });

    it('ondrop string includes KPI recalculation', () => {
        window.KANBAN_DATA = makeSampleData({
            updateUrl: '/app/site/hosting/scriptlet.nl?script=99&deploy=1',
            allowedStatusIds: ['6', '7', '8', '9'],
            selectedStatusIds: ['6', '7', '8', '9']
        });
        loadClient();

        const ondrop = document.querySelector('.kanban-column[data-status="8"] .kanban-column-body').getAttribute('ondrop');
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
