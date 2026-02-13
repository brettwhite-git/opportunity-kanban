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
            { id: '8', name: 'Closed Won', stage: 'CUSTOMER', probability: '100' }
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
        expect(columns.length).toBe(2); // Only Proposal and Negotiation have opps

        const cards = container.querySelectorAll('.kanban-card');
        expect(cards.length).toBe(2);

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
        // OPP-001 (THIS_MONTH THIS_QUARTER) visible, OPP-002 (NEXT_QUARTER) hidden
        expect(cards[0].style.display).toBe('');
        expect(cards[1].style.display).toBe('none');
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
        // Default filter is THIS_MONTH: Proposal has 1 match, Negotiation has 0
        expect(counts[0].textContent).toBe('1');
        expect(counts[1].textContent).toBe('0');
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

        // Default THIS_MONTH: Proposal column visible, Negotiation hidden
        var cols = document.querySelectorAll('.kanban-column');
        expect(cols[0].style.display).toBe('');     // Proposal (has THIS_MONTH card)
        expect(cols[1].style.display).toBe('none');  // Negotiation (only NEXT_QUARTER)
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
