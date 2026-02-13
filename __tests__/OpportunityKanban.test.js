import portlet from 'SuiteScripts/portlet/OpportunityKanban';
import runtime from 'N/runtime';
import file from 'N/file';

// The queries module is loaded via relative path in the AMD define.
// The SuiteCloud jest transformer resolves '../lib/queries' relative to the
// portlet script, which maps to 'SuiteScripts/lib/queries'.
jest.mock('SuiteScripts/lib/queries', () => ({
    deriveStatusColumns: jest.fn(),
    getOpportunitiesByUser: jest.fn()
}));

const queries = require('SuiteScripts/lib/queries');

beforeEach(() => {
    jest.restoreAllMocks();

    // Mock runtime.getCurrentUser()
    jest.spyOn(runtime, 'getCurrentUser').mockReturnValue({ id: 42 });

    // Mock file.load() -> returns object with .url
    jest.spyOn(file, 'load').mockReturnValue({
        url: '/SuiteApps/com.netsuite.opportunitykanban/portlet/kanban-client.js?v=abc'
    });

    // Default query returns
    queries.getOpportunitiesByUser.mockReturnValue([]);
    queries.deriveStatusColumns.mockReturnValue([
        { id: '6', name: 'Proposal' }
    ]);
});

describe('OpportunityKanban portlet', () => {
    it('sets portlet title', () => {
        const portletObj = { title: '', html: '' };
        portlet.render({ portlet: portletObj });
        expect(portletObj.title).toBe('Opportunity Kanban');
    });

    it('outputs inline style block', () => {
        const portletObj = { title: '', html: '' };
        portlet.render({ portlet: portletObj });
        expect(portletObj.html).toContain('<style>');
        expect(portletObj.html).toContain('.kanban-card');
    });

    it('outputs KANBAN_DATA inline script', () => {
        const portletObj = { title: '', html: '' };
        portlet.render({ portlet: portletObj });
        expect(portletObj.html).toContain('window.KANBAN_DATA');
    });

    it('outputs external script reference', () => {
        const portletObj = { title: '', html: '' };
        portlet.render({ portlet: portletObj });
        expect(portletObj.html).toContain('kanban-client.js');
        expect(portletObj.html).toContain('_cb=');
    });

    it('fetches opportunities for current user', () => {
        const portletObj = { title: '', html: '' };
        portlet.render({ portlet: portletObj });
        expect(queries.getOpportunitiesByUser).toHaveBeenCalledWith(42);
    });

    it('sanitizes JSON to prevent script injection', () => {
        queries.getOpportunitiesByUser.mockReturnValue([{
            id: '1', tranid: 'OPP-001',
            companyname: 'Test</script><script>alert(1)',
            entitystatus: '6', entitystatusText: 'Proposal',
            probability: '50', expectedclosedate: '', projectedtotal: '0', title: ''
        }]);

        const portletObj = { title: '', html: '' };
        portlet.render({ portlet: portletObj });

        expect(portletObj.html).not.toContain('</script><script>');
        expect(portletObj.html).toContain('<\\/script>');
    });

    it('renders error message on exception', () => {
        jest.spyOn(runtime, 'getCurrentUser').mockImplementation(() => {
            throw new Error('runtime failure');
        });

        const portletObj = { title: '', html: '' };
        portlet.render({ portlet: portletObj });

        expect(portletObj.html).toContain('Error loading kanban board');
    });
});
