/**
 * @NApiVersion 2.1
 * @NScriptType Portlet
 * @NModuleScope SameAccount
 */
define(['N/runtime', 'N/file', '../lib/queries'], (runtime, file, queries) => {

    const render = (params) => {
        const portletObj = params.portlet;
        portletObj.title = 'Opportunity Kanban';

        try {
            const currentUser = runtime.getCurrentUser();
            const userId = currentUser.id;

            const opportunities = queries.getOpportunitiesByUser(userId);
            const statusColumns = queries.deriveStatusColumns(opportunities);

            const kanbanData = {
                columns: statusColumns,
                opportunities: opportunities,
                userId: userId
            };

            const clientFile = file.load({
                id: '/SuiteApps/com.netsuite.opportunitykanban/portlet/kanban-client.js'
            });
            const clientUrl = clientFile.url;

            portletObj.html = buildHtml(kanbanData, clientUrl);
        } catch (e) {
            log.error({ title: 'OpportunityKanban.render', details: e.message || e });
            portletObj.html = '<div style="padding:20px;color:#c00;">Error loading kanban board. Check script logs.</div>';
        }
    };

    const buildHtml = (kanbanData, clientUrl) => {
        const styles = buildStyles();
        const safeData = JSON.stringify(kanbanData).replace(/<\//g, '<\\/');
        const cacheBust = Date.now();

        return [
            '<style>' + styles + '</style>',
            '<div id="kanban-board-container">',
            '<div id="kanban-loading" style="padding:40px;text-align:center;color:#888;">Loading board...</div>',
            '</div>',
            '<script>window.KANBAN_DATA = ' + safeData + ';</script>',
            '<script src="' + clientUrl + '&_cb=' + cacheBust + '"></script>'
        ].join('\n');
    };

    const buildStyles = () => {
        return `
#kanban-board-container {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    color: #333;
}

.kanban-toolbar {
    padding: 8px 0;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 4px;
}

.kanban-filter-btn {
    padding: 4px 12px;
    border: 1px solid #ccc;
    border-radius: 3px;
    font-size: 12px;
    font-weight: 600;
    background: #fff;
    color: #555;
    cursor: pointer;
    transition: all 0.15s ease;
    display: inline-flex;
    align-items: center;
    user-select: none;
    -webkit-user-select: none;
    line-height: 1.4;
}

.kanban-filter-btn:hover {
    background: #f0f0f0;
    border-color: #999;
}

.kanban-filter-btn:focus {
    outline: 2px solid #4a90d9;
    outline-offset: 1px;
}

.kanban-filter-btn.active {
    background: #4a90d9;
    color: #fff;
    border-color: #4a90d9;
}

.kanban-columns {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding-bottom: 8px;
    min-height: 300px;
}

.kanban-column {
    flex: 0 0 220px;
    background: #f4f5f7;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    max-height: 500px;
}

.kanban-column-header {
    padding: 10px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    border-bottom: 2px solid #ddd;
    min-width: 0;
}

.kanban-column-title {
    font-weight: 700;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #555;
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.kanban-column-count {
    background: #ddd;
    color: #666;
    border-radius: 10px;
    padding: 1px 8px;
    font-size: 11px;
    font-weight: 600;
}

.kanban-column-body {
    padding: 8px;
    overflow-y: auto;
    flex: 1;
}

.kanban-card {
    background: #fff;
    border-radius: 4px;
    padding: 10px;
    margin-bottom: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.12);
    cursor: pointer;
    transition: box-shadow 0.15s ease;
    border-left: 3px solid #4a90d9;
}

.kanban-card:hover {
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.kanban-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
}

.kanban-card-tranid {
    font-weight: 600;
    font-size: 12px;
    color: #0066cc;
    text-decoration: none;
}

.kanban-card-tranid:hover {
    text-decoration: underline;
}

.kanban-card-probability {
    font-size: 11px;
    color: #888;
    font-weight: 600;
}

.kanban-card-company {
    font-size: 13px;
    color: #333;
    margin-bottom: 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.kanban-card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.kanban-card-date {
    font-size: 11px;
    color: #888;
}

.kanban-card-amount {
    font-size: 12px;
    font-weight: 700;
    color: #2e7d32;
}

#kanban-loading {
    padding: 40px;
    text-align: center;
    color: #888;
    font-size: 14px;
}

.kanban-empty {
    padding: 40px;
    text-align: center;
    color: #888;
    font-size: 14px;
}`;
    };

    return { render };
});
